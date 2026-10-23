-- Disposable database only, migrations 001–009 required.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
('82000000-0000-0000-0000-000000000001','identity_admin@example.test','{"username":"identity_admin","full_name":"Admin"}'),
('82000000-0000-0000-0000-000000000002','identity_member@example.test','{"username":"identity_old","full_name":"Member","theme":"olive"}');
INSERT INTO public.platform_admins(user_id) VALUES ('82000000-0000-0000-0000-000000000001');
INSERT INTO public.shops(id,name) VALUES ('83000000-0000-0000-0000-000000000001','Identity café');
INSERT INTO public.shop_staff(shop_id,user_id,role) VALUES
('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','owner'),
('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','cashier');
SELECT set_config('request.jwt.claim.sub','82000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.award_purchase_stamp_by_username('83000000-0000-0000-0000-000000000001','identity_old','IDENTITY-BEFORE');
RESET ROLE;
CREATE TEMP TABLE identity_before AS SELECT id,customer_code FROM public.profiles WHERE username='identity_old';
SELECT set_config('request.jwt.claim.sub','82000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.update_my_profile('Member Updated','identity_new');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='82000000-0000-0000-0000-000000000002' AND raw_user_meta_data->>'username'='identity_new' AND raw_user_meta_data->>'full_name'='Member Updated' AND raw_user_meta_data->>'theme'='olive') THEN RAISE EXCEPTION 'TEST: Auth metadata did not synchronize'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN identity_before b USING(id,customer_code) WHERE p.username='identity_new') THEN RAISE EXCEPTION 'TEST: stable identity changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.purchase_transactions WHERE customer_id='82000000-0000-0000-0000-000000000002' AND receipt_reference='IDENTITY-BEFORE') THEN RAISE EXCEPTION 'TEST: purchase association lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.shop_staff WHERE user_id='82000000-0000-0000-0000-000000000002' AND role='cashier') THEN RAISE EXCEPTION 'TEST: staff membership lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE entity='profiles' AND before_data->>'username'='identity_old' AND after_data->>'username'='identity_new') THEN RAISE EXCEPTION 'TEST: historical username transition lost'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','82000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT * FROM public.award_purchase_stamp_by_username('83000000-0000-0000-0000-000000000001','identity_new','IDENTITY-AFTER');
DO $$ BEGIN
  BEGIN
    PERFORM public.award_purchase_stamp_by_username('83000000-0000-0000-0000-000000000001','identity_old','IDENTITY-OLD');
    RAISE EXCEPTION 'TEST: replaced username still resolves';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
SELECT public.admin_save('profiles','82000000-0000-0000-0000-000000000002','{"username":"identity_admin_edit"}','Rename account by administrator');
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='82000000-0000-0000-0000-000000000002' AND raw_user_meta_data->>'username'='identity_admin_edit') THEN RAISE EXCEPTION 'TEST: admin rename not synchronized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.loyalty_accounts WHERE customer_id='82000000-0000-0000-0000-000000000002' AND stamps=2) THEN RAISE EXCEPTION 'TEST: balance changed during rename'; END IF;
END; $$;
ROLLBACK;
