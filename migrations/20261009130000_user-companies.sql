-- الشركات الي يتابعها المستخدم. الفحص الدوري (Trigger.dev) يمر عليها ويضيف
-- الوظائف الجديدة المطابقة لـuser_jobs.

create table public.user_companies (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- كلمات المسمى المطلوبة لهذه الشركة. فاضية ⇒ نستخدم target_roles من الملف الشخصي
  keywords text[] not null default '{}' check (cardinality(keywords) <= 20),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index user_companies_company_idx on public.user_companies (company_id);

-- آخر فحص لكل شركة (يكتبه الخادم)
alter table public.companies add column last_scanned_at timestamptz;

alter table public.user_companies enable row level security;
revoke all on public.user_companies from anon, authenticated;
grant all on public.user_companies to project_admin;
grant select, insert, update, delete on public.user_companies to authenticated;

create policy user_companies_owner_select on public.user_companies for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_companies_owner_insert on public.user_companies for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_companies_owner_update on public.user_companies for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_companies_owner_delete on public.user_companies for delete to authenticated
  using (user_id = (select auth.uid()));
