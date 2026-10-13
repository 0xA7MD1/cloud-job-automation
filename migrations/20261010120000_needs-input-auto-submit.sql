-- التقديم التلقائي على أكثر من وظيفة.
--
-- needs_input: التجهيز خلص لكن فيه سؤال مطلوب بدون إجابة. ما نسمّيه «جاهز»
--              وما نفتح متصفح لين يجاوب المستخدم.
-- auto_submit: المستخدم أكّد دفعة تقديم من الواجهة (قاعدة 8): الطلب ينرسل لحاله
--              أول ما تكمل إجاباته. يكتبه الخادم بس.

alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check check (
  status in (
    'draft', 'preparing', 'needs_input', 'ready', 'queued', 'running',
    'needs_user', 'submitted', 'failed', 'cancelled'
  )
);

alter table public.applications add column auto_submit boolean not null default false;
