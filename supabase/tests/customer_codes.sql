-- Disposable database only, after migrations 001–006. Rolls back all test rows.
BEGIN;
INSERT INTO auth.users (id, raw_user_meta_data) VALUES
 ('30000000-0000-0000-0000-000000000001', '{}'),
 ('30000000-0000-0000-0000-000000000002', '{}');
INSERT INTO public.shops (id, name) VALUES
 ('40000000-0000-0000-0000-000000000001', 'Code test café'),
 ('40000000-0000-0000-0000-000000000002', 'Unassigned café');
INSERT INTO public.shop_staff (shop_id, user_id, role) VALUES
 ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'cashier');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE customer_code IS NULL OR customer_code !~ '^DS-[0-9]{6,}$') THEN RAISE EXCEPTION 'TEST: codes missing or invalid'; END IF;
  IF (SELECT count(*) FROM public.profiles) <> (SELECT count(DISTINCT customer_code) FROM public.profiles) THEN RAISE EXCEPTION 'TEST: duplicate codes'; END IF;
END; $$;
SELECT set_config('test.customer_code', (SELECT customer_code FROM public.profiles WHERE id = '30000000-0000-0000-0000-000000000002'), true);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000001', lower(current_setting('test.customer_code')), 'CODE-RECEIPT');
  IF (SELECT stamps FROM public.loyalty_accounts WHERE shop_id = '40000000-0000-0000-0000-000000000001' AND customer_id = '30000000-0000-0000-0000-000000000002') <> 1 THEN RAISE EXCEPTION 'TEST: wrong account credited'; END IF;
  BEGIN
    PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000001', current_setting('test.customer_code'), 'CODE-RECEIPT');
    RAISE EXCEPTION 'TEST: duplicate receipt allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000002', current_setting('test.customer_code'), 'CODE-RECEIPT-2');
    RAISE EXCEPTION 'TEST: unauthorized café credited';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000001', 'DS-OOOOO1', 'CODE-RECEIPT-3');
    RAISE EXCEPTION 'TEST: invalid code accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000001', 'DS-9999999999999999999', 'CODE-RECEIPT-4');
    RAISE EXCEPTION 'TEST: unknown code accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 THEN RAISE EXCEPTION 'TEST: profile codes exposed to other customers'; END IF;
  BEGIN
    UPDATE public.profiles SET customer_code = DEFAULT WHERE id = (SELECT auth.uid());
    RAISE EXCEPTION 'TEST: customer can change ID';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.profiles SET full_name = 'Updated name' WHERE id = (SELECT auth.uid());
  BEGIN
    PERFORM public.award_purchase_stamp_by_code('40000000-0000-0000-0000-000000000001', current_setting('test.customer_code'), 'CODE-RECEIPT-5');
    RAISE EXCEPTION 'TEST: customer can award stamps';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
END; $$;
RESET ROLE;
ROLLBACK;
