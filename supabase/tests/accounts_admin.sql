-- Disposable database only, migrations 001–007 required.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('50000000-0000-0000-0000-000000000001','admin@example.test','{"username":"dev_alex","full_name":"Alex"}'),
 ('50000000-0000-0000-0000-000000000002','customer@example.test','{"username":"shanice","full_name":"Shanice","is_admin":true}'),
 ('50000000-0000-0000-0000-000000000003','cashier@example.test','{"username":"cashier_lee","full_name":"Lee"}'),
 ('50000000-0000-0000-0000-000000000004','owner@example.test','{"username":"owner_sam","full_name":"Sam"}');
DO $$ BEGIN
  BEGIN
    INSERT INTO auth.users(id,raw_user_meta_data) VALUES('50000000-0000-0000-0000-000000000005','{"username":"SHANICE"}');
    RAISE EXCEPTION 'TEST: duplicate signup username accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
INSERT INTO public.platform_admins(user_id) VALUES('50000000-0000-0000-0000-000000000001');
INSERT INTO public.shops(id,name) VALUES('60000000-0000-0000-0000-000000000001','Username café'),('60000000-0000-0000-0000-000000000002','Other café');
INSERT INTO public.shop_staff(shop_id,user_id,role) VALUES
 ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','cashier'),
 ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004','owner');
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.is_platform_admin() THEN RAISE EXCEPTION 'TEST: metadata grants admin'; END IF;
  IF public.username_available('DEV_ALEX') THEN RAISE EXCEPTION 'TEST: username check case sensitive'; END IF;
  IF NOT public.username_available('shanice') THEN RAISE EXCEPTION 'TEST: own username unavailable'; END IF;
  IF NOT (public.get_my_account()->'roles' ? 'Customer') THEN RAISE EXCEPTION 'TEST: customer role missing'; END IF;
  PERFORM public.update_my_profile('Shanice Updated','shanice_new');
  BEGIN
    PERFORM public.update_my_profile('Bad','DEV_ALEX');
    RAISE EXCEPTION 'TEST: duplicate profile username accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.profiles SET username='admin' WHERE id=(SELECT auth.uid());
    RAISE EXCEPTION 'TEST: direct profile write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.platform_admins(user_id) VALUES((SELECT auth.uid()));
    RAISE EXCEPTION 'TEST: direct admin escalation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.admin_list('profiles');
    RAISE EXCEPTION 'TEST: customer can list admin data';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.admin_save('profiles','50000000-0000-0000-0000-000000000001','{"full_name":"hacked"}','unauthorized change');
    RAISE EXCEPTION 'TEST: customer can edit admin records';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.check_account_deletion('50000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'TEST: customer can inspect other deletion permissions';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.award_purchase_stamp_by_username('60000000-0000-0000-0000-000000000001','@SHANICE_NEW','USERNAME-0001');
  BEGIN
    PERFORM public.award_purchase_stamp_by_username('60000000-0000-0000-0000-000000000001','shanice_new','USERNAME-0001');
    RAISE EXCEPTION 'TEST: duplicate receipt credited';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.award_purchase_stamp_by_username('60000000-0000-0000-0000-000000000002','shanice_new','USERNAME-0002');
    RAISE EXCEPTION 'TEST: username bypasses café membership';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE section TEXT; balance_id UUID; BEGIN
  FOREACH section IN ARRAY ARRAY['profiles','shops','shop_staff','loyalty_accounts','rewards','purchase_transactions','reward_redemptions','shop_feature_access','platform_admins','audit_events'] LOOP
    PERFORM public.admin_list(section);
    PERFORM public.admin_list(section,'60000000-0000-0000-0000-000000000001');
  END LOOP;
  SELECT id INTO balance_id FROM public.loyalty_accounts WHERE customer_id='50000000-0000-0000-0000-000000000002';
  PERFORM public.admin_save('loyalty_accounts',balance_id,'{"stamps":4,"points":20}','Correct test balance');
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE actor_id=(SELECT auth.uid()) AND entity='loyalty_accounts' AND reason='Correct test balance' AND after_data->>'stamps'='4') THEN RAISE EXCEPTION 'TEST: admin changes not audited'; END IF;
  BEGIN
    PERFORM public.admin_save('profiles','50000000-0000-0000-0000-000000000002','{"customer_code":"DS-999999"}','Try changing code');
    RAISE EXCEPTION 'TEST: immutable admin field accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.admin_set_access((SELECT auth.uid()),false,'Remove last admin');
    RAISE EXCEPTION 'TEST: last admin removed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.check_account_deletion((SELECT auth.uid()));
    RAISE EXCEPTION 'TEST: last admin can delete account';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  PERFORM public.admin_set_access('50000000-0000-0000-0000-000000000003',true,'Add another test admin');
  PERFORM public.admin_record_account_action('50000000-0000-0000-0000-000000000002','DELETE_REQUEST','{"email":"customer@example.test"}','Delete a test customer');
END; $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    DELETE FROM auth.users WHERE id='50000000-0000-0000-0000-000000000004';
    RAISE EXCEPTION 'TEST: sole owner deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
DELETE FROM auth.users WHERE id='50000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id='50000000-0000-0000-0000-000000000002') OR EXISTS(SELECT 1 FROM public.loyalty_accounts WHERE customer_id='50000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'TEST: deleted customer data remains'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.purchase_transactions WHERE receipt_reference='USERNAME-0001' AND customer_id IS NULL) THEN RAISE EXCEPTION 'TEST: anonymized purchase history lost'; END IF;
  IF EXISTS(SELECT 1 FROM public.audit_events WHERE entity='profiles' AND record_id='50000000-0000-0000-0000-000000000002' AND before_data ? 'username') THEN RAISE EXCEPTION 'TEST: deleted username remains in profile audit'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE operation='DELETE_REQUEST' AND actor_id='50000000-0000-0000-0000-000000000001' AND record_id='50000000-0000-0000-0000-000000000002' AND after_data='{"deleted":true}'::jsonb) THEN RAISE EXCEPTION 'TEST: deletion accountability lost or email retained'; END IF;
END; $$;
DELETE FROM auth.users WHERE id='50000000-0000-0000-0000-000000000003';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.purchase_transactions WHERE receipt_reference='USERNAME-0001' AND cashier_id IS NOT NULL) THEN RAISE EXCEPTION 'TEST: deleted cashier still linked'; END IF;
  BEGIN
    DELETE FROM auth.users WHERE id='50000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'TEST: last admin deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
ROLLBACK;
