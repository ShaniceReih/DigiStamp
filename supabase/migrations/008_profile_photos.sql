-- Private profile photos. Apply after migration 007, before deploying the UI.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN avatar_path TEXT;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_path CHECK (avatar_path IS NULL OR avatar_path = id::TEXT || '/profile.jpg');
REVOKE UPDATE (avatar_path) ON public.profiles FROM anon, authenticated;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('profile-photos','profile-photos',false,1048576,ARRAY['image/jpeg']);

CREATE POLICY profile_photo_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::TEXT || '/profile.jpg');
CREATE POLICY profile_photo_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::TEXT || '/profile.jpg');
CREATE POLICY profile_photo_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::TEXT || '/profile.jpg')
WITH CHECK (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::TEXT || '/profile.jpg');
CREATE POLICY profile_photo_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND name = (SELECT auth.uid())::TEXT || '/profile.jpg');

CREATE FUNCTION public.update_my_avatar(p_path TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller UUID := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Sign in to update your photo'; END IF;
  IF p_path IS NOT NULL THEN
    IF p_path <> caller::TEXT || '/profile.jpg' OR NOT EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id = 'profile-photos' AND name = p_path
    ) THEN RAISE EXCEPTION 'Upload your profile photo first'; END IF;
  END IF;
  UPDATE public.profiles SET avatar_path = p_path WHERE id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account profile not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_my_avatar(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_avatar(TEXT) TO authenticated;
COMMIT;
