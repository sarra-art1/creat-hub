-- =====================================================================
-- CreatHub – ÉTAPE 2/3 : donner le rôle admin à UN compte existant
-- 1) Créez d'abord le compte via signup.html et confirmez son e-mail.
-- 2) Supabase > Authentication > Users : copiez l'UUID de ce compte.
-- 3) Remplacez VOTRE-UUID ci-dessous, puis exécutez dans SQL Editor.
-- Cette opération ne se fait JAMAIS depuis le navigateur.
-- =====================================================================
insert into public.user_roles (user_id, role)
values ('8eca3827-826e-4751-a189-e594cff37a5a'::uuid, 'admin')
on conflict (user_id) do update set role = 'admin';
