-- Keep current Auth identity labels consistent with the canonical profile.
-- UUID relationships and historical audit snapshots remain unchanged.
BEGIN;
CREATE FUNCTION public.sync_profile_identity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::JSONB)
    || jsonb_build_object('username',NEW.username,'full_name',NEW.full_name)
  WHERE id = NEW.id AND (
    raw_user_meta_data->>'username' IS DISTINCT FROM NEW.username
    OR raw_user_meta_data->>'full_name' IS DISTINCT FROM NEW.full_name
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_profile_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_profile_identity AFTER INSERT OR UPDATE OF username,full_name
ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_identity();

UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data,'{}'::JSONB)
  || jsonb_build_object('username',p.username,'full_name',p.full_name)
FROM public.profiles p WHERE p.id=u.id AND (
  u.raw_user_meta_data->>'username' IS DISTINCT FROM p.username
  OR u.raw_user_meta_data->>'full_name' IS DISTINCT FROM p.full_name
);
COMMIT;
