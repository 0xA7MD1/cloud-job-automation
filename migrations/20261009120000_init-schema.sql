-- السكيمة الأولى لبوت التقديم.
--
-- القواعد:
-- 1. جداول المستخدم مقفولة على صاحبها بـRLS: (select auth.uid()) = user_id.
-- 2. الجداول المشتركة (companies, jobs) قراءة بس للمستخدم. الكتابة من الخادم
--    بمفتاح الأدمن (project_admin يتجاوز RLS).
-- 3. نسحب كل الصلاحيات من anon وauthenticated ونعطي بالضبط الي نحتاجه، وبعض
--    الجداول بصلاحيات على مستوى العمود (provider_keys, applications).

-- ---------------------------------------------------------------------------
-- updated_at تلقائي
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: بيانات المستخدم الي تتعبّى في نماذج التقديم
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 200),
  phone text check (char_length(phone) <= 40),
  city text check (char_length(city) <= 120),
  country text check (char_length(country) <= 120),
  headline text check (char_length(headline) <= 300),
  summary text check (char_length(summary) <= 5000),
  years_experience smallint check (years_experience between 0 and 60),
  linkedin_url text check (char_length(linkedin_url) <= 500),
  github_url text check (char_length(github_url) <= 500),
  portfolio_url text check (char_length(portfolio_url) <= 500),
  -- بنك الإجابات: أسئلة النماذج المتكررة (التأشيرة، الراتب المتوقع، مدة الإشعار...)
  answers jsonb not null default '{}'::jsonb,
  -- الأدوار والمدن المطلوبة، عن بعد، لغة الـCV...
  preferences jsonb not null default '{}'::jsonb,
  default_cv_file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entitlements: الخطة وحد التقديم الشهري. يكتبها الأدمن بس.
-- ما فيه صف ⇒ الحد الافتراضي 500 (شوف monthly_apply_usage).
-- ---------------------------------------------------------------------------
create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid', 'owner')),
  monthly_apply_limit integer not null default 500 check (monthly_apply_limit >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- provider_keys: مفاتيح BYOK مشفّرة (AES-256-GCM في الخادم).
-- المستخدم ما يقدر يقرأ ciphertext/iv/auth_tag. الواجهة تشوف المزود وآخر 4 أحرف.
-- ---------------------------------------------------------------------------
create table public.provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (
    provider in ('groq', 'openrouter', 'openai', 'anthropic', 'google', 'exa', 'tavily', 'steel')
  ),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version smallint not null default 1 check (key_version > 0),
  last4 text not null check (char_length(last4) <= 4),
  -- إعدادات غير سرية: النموذج الافتراضي، «حل الكابتشا مفعّل عندي في Steel»...
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'unverified' check (status in ('unverified', 'valid', 'invalid')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- files: بيانات الملفات. الملف نفسه في InsForge Storage، bucket "user-files".
-- المسار يبدأ دائمًا بمعرّف المالك: <user_id>/<kind>/<uuid>-<name>
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('cv', 'cover_letter', 'document', 'evidence', 'other')),
  bucket text not null default 'user-files',
  object_key text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 255),
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  constraint files_object_key_owned check (split_part(object_key, '/', 1) = user_id::text)
);

alter table public.profiles
  add constraint profiles_default_cv_file_id_fkey
  foreign key (default_cv_file_id) references public.files (id) on delete set null;

-- ---------------------------------------------------------------------------
-- companies: مشتركة بين كل المستخدمين
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 300),
  -- بالأحرف الصغيرة وبدون www
  domain text unique check (domain = lower(domain)),
  website_url text,
  careers_url text,
  ats text not null default 'unknown' check (
    ats in ('greenhouse', 'lever', 'ashby', 'workday', 'other', 'unknown')
  ),
  ats_slug text,
  country text,
  city text,
  description text,
  source text not null check (source in ('exa', 'tavily', 'ats', 'places', 'manual')),
  -- Google Places: المعرّف بس (شروطهم)
  place_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ats, ats_slug)
);

-- ---------------------------------------------------------------------------
-- jobs: مشتركة. صف واحد لكل وظيفة، فريد بالمصدر + المعرّف الخارجي.
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  source text not null check (source in ('greenhouse', 'lever', 'ashby', 'careers_page', 'manual')),
  external_id text not null,
  title text not null check (char_length(title) between 1 and 500),
  location text,
  workplace_type text check (workplace_type in ('onsite', 'remote', 'hybrid')),
  employment_type text,
  department text,
  description text,
  url text not null,
  apply_url text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  raw jsonb,
  unique (source, external_id)
);

create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_open_last_seen_idx on public.jobs (last_seen_at desc) where closed_at is null;

-- ---------------------------------------------------------------------------
-- chats / messages: المحادثات بصيغة UIMessage من AI SDK (id نصي + parts)
-- ---------------------------------------------------------------------------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chats_user_updated_idx on public.chats (user_id, updated_at desc);

create table public.messages (
  id text primary key check (char_length(id) between 1 and 100),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  parts jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index messages_chat_created_idx on public.messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- searches: كل بحث ينحفظ بمعرّف ومصدر وتاريخ، والشات يرجع له بدل ما يعيده.
-- ---------------------------------------------------------------------------
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chat_id uuid references public.chats (id) on delete set null,
  kind text not null check (kind in ('companies', 'jobs')),
  provider text not null,
  query text not null check (char_length(query) between 1 and 2000),
  params jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create index searches_user_created_idx on public.searches (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- user_jobs: ربط المستخدم بالوظيفة المشتركة (فرز: جديدة/محفوظة/مستبعدة)
-- ---------------------------------------------------------------------------
create table public.user_jobs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'saved', 'dismissed')),
  match_score smallint check (match_score between 0 and 100),
  match_reason text,
  search_id uuid references public.searches (id) on delete set null,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index user_jobs_job_id_idx on public.user_jobs (job_id);

-- ---------------------------------------------------------------------------
-- applications: طلب تقديم واحد لكل (مستخدم، وظيفة).
-- المستخدم يعدّل الإجابات والملفات بس. الحالة والإرسال والدليل يكتبها الخادم.
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete restrict,
  status text not null default 'draft' check (
    status in (
      'draft', 'preparing', 'ready', 'queued', 'running',
      'needs_user', 'submitted', 'failed', 'cancelled'
    )
  ),
  answers jsonb not null default '{}'::jsonb,
  cv_file_id uuid references public.files (id) on delete set null,
  cover_letter_file_id uuid references public.files (id) on delete set null,
  browser_provider text,
  trigger_run_id text,
  -- قاعدة 7: ينكتب قبل الضغط على «إرسال». لو موجود ⇒ تحقّق من الدليل، لا تعيد الإرسال.
  submit_attempted_at timestamptz,
  submitted_at timestamptz,
  confirmation_ref text,
  -- قاعدة 6: النجاح = دليل محفوظ
  evidence_file_id uuid references public.files (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index applications_user_status_idx on public.applications (user_id, status);

-- ---------------------------------------------------------------------------
-- application_events: سجل لا يُحذف. منه نحسب الحصة الشهرية.
-- ---------------------------------------------------------------------------
create table public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'created', 'prepared', 'queued', 'started', 'needs_user',
      'submit_attempted', 'submitted', 'failed', 'cancelled', 'evidence_saved'
    )
  ),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index application_events_application_idx on public.application_events (application_id, created_at);
create index application_events_quota_idx on public.application_events (user_id, created_at)
  where type = 'submit_attempted';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();
create trigger provider_keys_set_updated_at before update on public.provider_keys
  for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger chats_set_updated_at before update on public.chats
  for each row execute function public.set_updated_at();
create trigger user_jobs_set_updated_at before update on public.user_jobs
  for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- الصلاحيات + RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.provider_keys enable row level security;
alter table public.files enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.searches enable row level security;
alter table public.user_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

revoke all on
  public.profiles, public.entitlements, public.provider_keys, public.files,
  public.companies, public.jobs, public.chats, public.messages, public.searches,
  public.user_jobs, public.applications, public.application_events
from anon, authenticated;

grant all on
  public.profiles, public.entitlements, public.provider_keys, public.files,
  public.companies, public.jobs, public.chats, public.messages, public.searches,
  public.user_jobs, public.applications, public.application_events
to project_admin;

-- profiles: المالك يقرأ ويضيف ويعدّل
grant select, insert, update on public.profiles to authenticated;
create policy profiles_owner_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_owner_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_owner_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- entitlements: قراءة بس
grant select on public.entitlements to authenticated;
create policy entitlements_owner_select on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()));

-- provider_keys: الأعمدة السرية تنكتب ولا تنقرأ
grant select (
  id, user_id, provider, key_version, last4, settings, status, verified_at, created_at, updated_at
) on public.provider_keys to authenticated;
grant insert (
  user_id, provider, ciphertext, iv, auth_tag, key_version, last4, settings
) on public.provider_keys to authenticated;
grant update (
  ciphertext, iv, auth_tag, key_version, last4, settings, status, verified_at
) on public.provider_keys to authenticated;
grant delete on public.provider_keys to authenticated;
create policy provider_keys_owner_select on public.provider_keys for select to authenticated
  using (user_id = (select auth.uid()));
create policy provider_keys_owner_insert on public.provider_keys for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy provider_keys_owner_update on public.provider_keys for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy provider_keys_owner_delete on public.provider_keys for delete to authenticated
  using (user_id = (select auth.uid()));

-- files
grant select, insert, delete on public.files to authenticated;
create policy files_owner_select on public.files for select to authenticated
  using (user_id = (select auth.uid()));
create policy files_owner_insert on public.files for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy files_owner_delete on public.files for delete to authenticated
  using (user_id = (select auth.uid()));

-- companies / jobs: مشتركة، قراءة بس
grant select on public.companies, public.jobs to authenticated;
create policy companies_read on public.companies for select to authenticated using (true);
create policy jobs_read on public.jobs for select to authenticated using (true);

-- chats
grant select, insert, update, delete on public.chats to authenticated;
create policy chats_owner_select on public.chats for select to authenticated
  using (user_id = (select auth.uid()));
create policy chats_owner_insert on public.chats for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy chats_owner_update on public.chats for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy chats_owner_delete on public.chats for delete to authenticated
  using (user_id = (select auth.uid()));

-- messages: لازم المحادثة نفسها ترجع للمستخدم
grant select, insert, delete on public.messages to authenticated;
create policy messages_owner_select on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy messages_owner_insert on public.messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = (select auth.uid())
    )
  );
create policy messages_owner_delete on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

-- searches
grant select, insert, delete on public.searches to authenticated;
create policy searches_owner_select on public.searches for select to authenticated
  using (user_id = (select auth.uid()));
create policy searches_owner_insert on public.searches for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy searches_owner_delete on public.searches for delete to authenticated
  using (user_id = (select auth.uid()));

-- user_jobs
grant select, insert, update, delete on public.user_jobs to authenticated;
create policy user_jobs_owner_select on public.user_jobs for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_jobs_owner_insert on public.user_jobs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_jobs_owner_update on public.user_jobs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_jobs_owner_delete on public.user_jobs for delete to authenticated
  using (user_id = (select auth.uid()));

-- applications: بدون حذف (عشان الحصة ما تتصفّر)، والتعديل على أعمدة محددة
grant select on public.applications to authenticated;
grant insert (user_id, job_id, answers, cv_file_id, cover_letter_file_id)
  on public.applications to authenticated;
grant update (answers, cv_file_id, cover_letter_file_id)
  on public.applications to authenticated;
create policy applications_owner_select on public.applications for select to authenticated
  using (user_id = (select auth.uid()));
create policy applications_owner_insert on public.applications for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy applications_owner_update on public.applications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- application_events: قراءة بس. الكتابة من مهام Trigger.dev
grant select on public.application_events to authenticated;
create policy application_events_owner_select on public.application_events for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- الحصة الشهرية: عدد محاولات الإرسال من بداية الشهر (UTC) والحد.
-- security invoker: المستخدم يشوف حصته بس (RLS)، والأدمن يمرّر أي p_user_id.
-- ---------------------------------------------------------------------------
create or replace function public.monthly_apply_usage(p_user_id uuid default auth.uid())
returns table (used integer, apply_limit integer, period_start timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('month', now() at time zone 'utc') at time zone 'utc') as start_at
  )
  select
    (
      select count(*)::integer
      from public.application_events e
      where e.user_id = p_user_id
        and e.type = 'submit_attempted'
        and e.created_at >= (select start_at from bounds)
    ) as used,
    coalesce(
      (select en.monthly_apply_limit from public.entitlements en where en.user_id = p_user_id),
      500
    ) as apply_limit,
    (select start_at from bounds) as period_start;
$$;

revoke execute on function public.monthly_apply_usage(uuid) from public, anon;
grant execute on function public.monthly_apply_usage(uuid) to authenticated, project_admin;
