-- سياسات bucket "user-files" (خاص). أنشئ الـbucket قبلها أو بعدها:
--   npx @insforge/cli storage create-bucket user-files --private
--
-- InsForge يرفض كل شي على storage.objects افتراضيًا في المشاريع الجديدة.
-- القاعدة: أول جزء من المسار = معرّف المستخدم (من JWT)، فكل واحد يشوف مجلده بس.
-- القراءة والحذف بالمجلد بس، لأن الخادم (مهام Trigger.dev) يكتب للمستخدم
-- مستندات وأدلة تقديم في مجلده، وهذي uploaded_by فيها مو المستخدم.

create policy user_files_owner_select on storage.objects for select to authenticated
  using (
    bucket = 'user-files'
    and (storage.foldername(key))[1] = (select auth.jwt() ->> 'sub')
  );

create policy user_files_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket = 'user-files'
    and uploaded_by = (select auth.jwt() ->> 'sub')
    and (storage.foldername(key))[1] = (select auth.jwt() ->> 'sub')
  );

create policy user_files_owner_update on storage.objects for update to authenticated
  using (
    bucket = 'user-files'
    and (storage.foldername(key))[1] = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket = 'user-files'
    and (storage.foldername(key))[1] = (select auth.jwt() ->> 'sub')
  );

create policy user_files_owner_delete on storage.objects for delete to authenticated
  using (
    bucket = 'user-files'
    and (storage.foldername(key))[1] = (select auth.jwt() ->> 'sub')
  );
