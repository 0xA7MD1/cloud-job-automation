// يطبّق migrations على Postgres محلي (PGlite) فوق بديل مصغّر لسكيمات InsForge
// (auth.uid/auth.jwt، storage.objects، الأدوار)، ويختبر RLS والصلاحيات.
// البديل يقلّد InsForge كما في مستودعهم (migrations 036 و045)، مو نسخة منه:
// النجاح هنا ما يغني عن تجربة على المشروع الحقيقي.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const JOB = "bbbbbbbb-0000-0000-0000-000000000001";

const db = new PGlite();

type Result = { rows: Record<string, unknown>[]; error?: undefined } | { rows?: undefined; error: string };

async function as(user: string | null, sql: string): Promise<Result> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    user ? JSON.stringify({ sub: user, role: "authenticated" }) : "",
  ]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return { rows: (await db.query<Record<string, unknown>>(sql)).rows };
  } catch (error) {
    return { error: (error as Error).message };
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role project_admin nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    grant usage on schema auth to anon, authenticated, project_admin;
    grant execute on all functions in schema auth to anon, authenticated, project_admin;
    grant usage on schema public to anon, authenticated, project_admin;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema storage;
    create table storage.objects (
      bucket text not null, key text not null, uploaded_by text, primary key (bucket, key)
    );
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (regexp_split_to_array(name, '/'))[1 : array_upper(regexp_split_to_array(name, '/'), 1) - 1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values ('${A}', 'a@x.test'), ('${B}', 'b@x.test');
  `);

  const dir = path.dirname(fileURLToPath(import.meta.url));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }

  await db.exec(`
    insert into public.companies (id, name, domain, source)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'Acme', 'acme.com', 'manual');
    insert into public.jobs (id, company_id, source, external_id, title, url)
      values ('${JOB}', 'aaaaaaaa-0000-0000-0000-000000000001', 'greenhouse', '123', 'Engineer', 'https://x');
  `);
}, 60_000);

describe("profiles", () => {
  it("owner inserts with user_id defaulted from the JWT", async () => {
    const r = await as(A, "insert into public.profiles (full_name) values ('Ahmed') returning user_id");
    expect(r.rows?.[0]?.user_id).toBe(A);
  });
  it("cannot write another user's profile", async () => {
    expect((await as(A, `insert into public.profiles (user_id) values ('${B}')`)).error).toBeDefined();
  });
  it("is invisible to other users and anon", async () => {
    expect((await as(B, "select * from public.profiles")).rows).toHaveLength(0);
    expect((await as(null, "select * from public.profiles")).error).toBeDefined();
  });
});

describe("provider_keys", () => {
  it("accepts encrypted keys but never returns secret columns", async () => {
    const insert = await as(
      A,
      "insert into public.provider_keys (provider, ciphertext, iv, auth_tag, last4) values ('groq', 'c', 'i', 't', 'abcd')",
    );
    expect(insert.error).toBeUndefined();
    expect((await as(A, "select provider, last4 from public.provider_keys")).rows).toEqual([
      { provider: "groq", last4: "abcd" },
    ]);
    expect((await as(A, "select ciphertext from public.provider_keys")).error).toBeDefined();
    expect((await as(A, "select * from public.provider_keys")).error).toBeDefined();
    expect((await as(B, "select id from public.provider_keys")).rows).toHaveLength(0);
  });
});

describe("files and storage", () => {
  it("keeps every object inside the owner's folder", async () => {
    expect(
      (
        await as(
          A,
          `insert into public.files (kind, object_key, file_name, mime_type, size_bytes)
           values ('cv', '${A}/cv/x-cv.pdf', 'cv.pdf', 'application/pdf', 10)`,
        )
      ).error,
    ).toBeUndefined();
    expect(
      (
        await as(
          A,
          `insert into public.files (kind, object_key, file_name, mime_type, size_bytes)
           values ('cv', '${B}/cv/x.pdf', 'cv.pdf', 'application/pdf', 10)`,
        )
      ).error,
    ).toBeDefined();

    const up = (bucket: string, key: string) =>
      as(A, `insert into storage.objects (bucket, key, uploaded_by) values ('${bucket}', '${key}', '${A}')`);
    expect((await up("user-files", `${A}/cv/x-cv.pdf`)).error).toBeUndefined();
    expect((await up("user-files", `${B}/cv/evil.pdf`)).error).toBeDefined();
    expect((await up("other", `${A}/x.pdf`)).error).toBeDefined();
  });

  it("lets the owner read server-written objects and hides them from others", async () => {
    await db.exec(
      `insert into storage.objects (bucket, key, uploaded_by) values ('user-files', '${A}/evidence/proof.png', null)`,
    );
    expect((await as(A, "select key from storage.objects")).rows).toHaveLength(2);
    expect((await as(B, "select key from storage.objects")).rows).toHaveLength(0);
    expect((await as(B, `delete from storage.objects where key like '${A}%' returning key`)).rows).toHaveLength(0);
  });
});

describe("shared tables", () => {
  it("are readable but not writable by users", async () => {
    expect((await as(A, "select title from public.jobs")).rows).toHaveLength(1);
    expect(
      (await as(A, "insert into public.jobs (source, external_id, title, url) values ('manual', 'z', 't', 'u')")).error,
    ).toBeDefined();
    expect((await as(A, "update public.companies set name = 'x'")).error).toBeDefined();
  });
});

describe("chats", () => {
  it("rejects messages into someone else's chat", async () => {
    const chat = await as(A, "insert into public.chats (title) values ('c') returning id");
    const chatId = chat.rows?.[0]?.id as string;
    const msg = (user: string) =>
      as(user, `insert into public.messages (id, chat_id, role, parts) values ('m-${user}', '${chatId}', 'user', '[]')`);
    expect((await msg(B)).error).toBeDefined();
    expect((await msg(A)).error).toBeUndefined();
  });
});

describe("applications and quota", () => {
  let appId = "";

  it("users edit answers only; status, submit flags and deletes are server-side", async () => {
    const created = await as(A, `insert into public.applications (job_id) values ('${JOB}') returning id, status`);
    expect(created.rows?.[0]?.status).toBe("draft");
    appId = created.rows?.[0]?.id as string;

    expect((await as(A, `update public.applications set answers = '{"q":"a"}' where id = '${appId}'`)).error).toBeUndefined();
    expect((await as(A, `update public.applications set status = 'submitted' where id = '${appId}'`)).error).toBeDefined();
    expect(
      (await as(A, `update public.applications set submit_attempted_at = null where id = '${appId}'`)).error,
    ).toBeDefined();
    expect((await as(A, `delete from public.applications where id = '${appId}'`)).error).toBeDefined();
    expect(
      (
        await as(
          A,
          `insert into public.application_events (application_id, user_id, type) values ('${appId}', '${A}', 'submitted')`,
        )
      ).error,
    ).toBeDefined();
  });

  it("counts this month's submit attempts against the limit", async () => {
    await db.exec(`
      insert into public.application_events (application_id, user_id, type) values
        ('${appId}', '${A}', 'submit_attempted'),
        ('${appId}', '${A}', 'submit_attempted'),
        ('${appId}', '${A}', 'submitted');
      insert into public.application_events (application_id, user_id, type, created_at)
        values ('${appId}', '${A}', 'submit_attempted', now() - interval '40 days');
    `);
    const usage = await as(A, "select * from public.monthly_apply_usage()");
    expect(usage.rows?.[0]).toMatchObject({ used: 2, apply_limit: 500 });
    expect((await as(B, `select * from public.monthly_apply_usage('${A}')`)).rows?.[0]).toMatchObject({ used: 0 });
    expect((await as(null, "select * from public.monthly_apply_usage()")).error).toBeDefined();
  });

  it("only the admin can raise a limit", async () => {
    await db.exec(`insert into public.entitlements (user_id, plan, monthly_apply_limit) values ('${A}', 'owner', 2000)`);
    expect((await as(A, "select * from public.monthly_apply_usage()")).rows?.[0]).toMatchObject({ apply_limit: 2000 });
    expect((await as(A, "update public.entitlements set monthly_apply_limit = 999999")).error).toBeDefined();
  });
});
