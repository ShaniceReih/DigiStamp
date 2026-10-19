-- Run against a disposable database after migrations 001–005. Always rolls back.
BEGIN;
INSERT INTO auth.users (id, raw_user_meta_data) VALUES
 ('10000000-0000-0000-0000-000000000001', '{}'),
 ('10000000-0000-0000-0000-000000000002', '{}'),
 ('10000000-0000-0000-0000-000000000003', '{}');
INSERT INTO public.shops (id, name) VALUES
 ('20000000-0000-0000-0000-000000000001', 'Test café A'),
 ('20000000-0000-0000-0000-000000000002', 'Test café B');
INSERT INTO public.shop_staff (shop_id, user_id, role) VALUES
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'cashier');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE reward UUID;
BEGIN
  PERFORM public.save_shop_branding('20000000-0000-0000-0000-000000000001', '#226644', '#F0F8EF', '', 'cafe');
  reward := public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Test reward', 5, true);
  IF reward IS NULL THEN RAISE EXCEPTION 'TEST: owner cannot create reward'; END IF;
  BEGIN
    PERFORM public.save_shop_branding('20000000-0000-0000-0000-000000000002', '#226644', '#FFFFFF', '', 'star');
    RAISE EXCEPTION 'TEST: cross-café branding allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000002', reward, 'Wrong café', 5, true);
    RAISE EXCEPTION 'TEST: cross-café reward allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.shop_feature_access SET status = 'active';
    RAISE EXCEPTION 'TEST: owner can unlock access';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.shops SET brand_color = '#000000';
    RAISE EXCEPTION 'TEST: direct branding write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Invalid', 0, true);
    RAISE EXCEPTION 'TEST: invalid target allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_shop_branding('20000000-0000-0000-0000-000000000001', '#INVALID', '#FFFFFF', '', 'star');
    RAISE EXCEPTION 'TEST: invalid branding allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.shop_feature_access) <> 1 THEN RAISE EXCEPTION 'TEST: access records leak across cafés'; END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Cashier reward', 5, true);
    RAISE EXCEPTION 'TEST: cashier can customize';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  PERFORM public.award_purchase_stamp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'TEST-RECEIPT');
  BEGIN
    PERFORM public.award_purchase_stamp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'TEST-RECEIPT');
    RAISE EXCEPTION 'TEST: duplicate receipt credited';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.award_purchase_stamp('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'OTHER-RECEIPT');
    RAISE EXCEPTION 'TEST: cashier awarded another café stamp';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;

RESET ROLE;
UPDATE public.shop_feature_access SET trial_ends_at = NOW() - INTERVAL '1 second';
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Expired', 5, true);
    RAISE EXCEPTION 'TEST: expired trial can customize';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
UPDATE public.shop_feature_access SET status = 'active', features = ARRAY['custom_rewards'];
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Active access', 8, true);
  BEGIN
    PERFORM public.save_shop_branding('20000000-0000-0000-0000-000000000001', '#226644', '#FFFFFF', '', 'star');
    RAISE EXCEPTION 'TEST: missing feature can customize';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
UPDATE public.shop_feature_access SET status = 'disabled';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Disabled', 5, true);
    RAISE EXCEPTION 'TEST: disabled access can customize';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT stamps FROM public.loyalty_accounts WHERE shop_id = '20000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'TEST: customer balance lost after expiry';
  END IF;
  IF (SELECT count(*) FROM public.rewards WHERE is_active) <> 2 THEN RAISE EXCEPTION 'TEST: customer rewards lost after expiry'; END IF;
  BEGIN
    PERFORM public.save_shop_reward('20000000-0000-0000-0000-000000000001', NULL, 'Customer', 5, true);
    RAISE EXCEPTION 'TEST: customer can customize';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
ROLLBACK;
