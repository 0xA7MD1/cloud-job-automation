-- تجهيز الطلب ومحرّك التقديم (الخطوات 7–9).
--
-- form:      أسئلة نموذج التقديم كما جبناها من نظام التوظيف (الخادم يكتبها)
-- cover_letter_text: نص خطاب التقديم. المستخدم يعدّله، والمهمة تولّد منه PDF/Word
-- outreach:  مسودات بريد وواتساب (الخادم يكتبها، والإرسال يدوي دائمًا)
-- status_detail: سبب الحالة الحالية بكلام المستخدم (ينتظر تدخلك لأن...)

alter table public.applications
  add column form jsonb not null default '{}'::jsonb,
  add column cover_letter_text text check (char_length(cover_letter_text) <= 12000),
  add column cover_letter_docx_file_id uuid references public.files (id) on delete set null,
  add column outreach jsonb not null default '{}'::jsonb,
  add column status_detail text check (char_length(status_detail) <= 1000),
  add column prepared_at timestamptz;

grant update (cover_letter_text) on public.applications to authenticated;

-- بريد المستخدم لنماذج التقديم. مهام Trigger.dev تقرأه بعميل الأدمن بس
-- (ما نمرّره في مدخلات التشغيل لأن Trigger.dev يحفظها).
create or replace function public.user_email(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email from auth.users u where u.id = p_user_id
$$;

revoke execute on function public.user_email(uuid) from public, anon, authenticated;
grant execute on function public.user_email(uuid) to project_admin;
