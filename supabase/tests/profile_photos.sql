-- Disposable database only, migrations 001–008 required. No files are uploaded.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('81000000-0000-0000-0000-000000000001','photo_one@example.test','{"username":"photo_one"}'),
('81000000-0000-0000-0000-000000000002','photo_two@example.test','{"username":"photo_two"}');
INSERT INTO storage.objects(bucket_id,name) VALUES ('profile-photos','81000000-0000-0000-0000-000000000002/profile.jpg');
SELECT set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name) VALUES ('profile-photos','81000000-0000-0000-0000-000000000001/profile.jpg');
SELECT public.update_my_avatar('81000000-0000-0000-0000-000000000001/profile.jpg');
DO $$ BEGIN
  IF public.get_my_account()->>'avatar_path' <> '81000000-0000-0000-0000-000000000001/profile.jpg' THEN RAISE EXCEPTION 'TEST: own photo was not saved'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE name='81000000-0000-0000-0000-000000000002/profile.jpg') THEN RAISE EXCEPTION 'TEST: another account photo is readable'; END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name) VALUES ('profile-photos','81000000-0000-0000-0000-000000000002/other.jpg');
    RAISE EXCEPTION 'TEST: cross-account upload accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.update_my_avatar('81000000-0000-0000-0000-000000000002/profile.jpg');
    RAISE EXCEPTION 'TEST: another account photo can be assigned';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.profiles SET avatar_path=NULL WHERE id=auth.uid();
    RAISE EXCEPTION 'TEST: direct avatar write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM storage.objects WHERE name='81000000-0000-0000-0000-000000000002/profile.jpg';
  IF FOUND THEN RAISE EXCEPTION 'TEST: another account photo was deleted'; END IF;
  PERFORM public.update_my_avatar(NULL);
  IF public.get_my_account()->>'avatar_path' IS NOT NULL THEN RAISE EXCEPTION 'TEST: photo removal failed'; END IF;
END; $$;
DELETE FROM storage.objects WHERE name='81000000-0000-0000-0000-000000000001/profile.jpg';
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.update_my_avatar(NULL);
    RAISE EXCEPTION 'TEST: anonymous avatar write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
ROLLBACK;
