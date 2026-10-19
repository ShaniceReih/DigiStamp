-- Human-readable customer IDs. UUID relationships and existing balances are unchanged.
BEGIN;
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE v_column RECORD;
BEGIN
  SELECT data_type, is_generated, column_default INTO v_column
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'customer_code';

  IF NOT FOUND THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS customer_number BIGINT GENERATED ALWAYS AS IDENTITY;
    ALTER TABLE public.profiles ADD COLUMN customer_code TEXT GENERATED ALWAYS AS (
      'DS-' || lpad(customer_number::TEXT, greatest(6, length(customer_number::TEXT)), '0')
    ) STORED;
  ELSE
    -- Preserve existing assigned IDs and the existing generate_digistamp_code() default.
    IF v_column.data_type NOT IN ('text', 'character varying') THEN
      RAISE EXCEPTION 'Existing customer_code must be text. No existing IDs were changed';
    END IF;
    IF v_column.is_generated = 'NEVER' AND v_column.column_default IS NULL THEN
      RAISE EXCEPTION 'Existing customer_code needs an automatic generator. No existing IDs were changed';
    END IF;
    UPDATE public.profiles SET customer_code = DEFAULT WHERE customer_code IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE customer_code IS NULL OR customer_code !~ '^DS-[0-9]{6,19}$') THEN
    RAISE EXCEPTION 'Some customer codes are missing or have a different format. Review them before migrating; existing IDs have not been replaced';
  END IF;
  IF EXISTS (SELECT customer_code FROM public.profiles GROUP BY customer_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate customer codes exist. Resolve duplicates before migrating; existing IDs have not been replaced';
  END IF;
  ALTER TABLE public.profiles ALTER COLUMN customer_code SET NOT NULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attname = 'customer_code'
    WHERE i.indrelid = 'public.profiles'::regclass AND i.indisunique AND i.indisvalid
      AND i.indpred IS NULL AND i.indnkeyatts = 1 AND i.indkey[0] = a.attnum
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_customer_code_unique UNIQUE (customer_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_customer_code_format') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_customer_code_format CHECK (customer_code ~ '^DS-[0-9]{6,19}$');
  END IF;
END;
$$;

-- A customer may edit their name, but not their assigned code or account identity.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (customer_code) ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
DO $$
DECLARE v_sequence TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'customer_number') THEN
    REVOKE UPDATE (customer_number) ON public.profiles FROM anon, authenticated;
    v_sequence := pg_catalog.pg_get_serial_sequence('public.profiles', 'customer_number');
    IF v_sequence IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', v_sequence);
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_purchase_stamp_by_code(p_shop_id UUID, p_customer_code TEXT, p_receipt_reference TEXT)
RETURNS TABLE (transaction_id UUID, total_stamps INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_customer_id UUID; v_code TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_staff
    WHERE shop_id = p_shop_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'cashier')
  ) THEN RAISE EXCEPTION 'You are not authorized for this shop'; END IF;
  v_code := upper(trim(p_customer_code));
  IF v_code IS NULL OR v_code !~ '^DS-[0-9]{6,}$' OR length(v_code) > 22 THEN
    RAISE EXCEPTION 'Enter a valid customer ID, for example DS-000001';
  END IF;
  SELECT id INTO v_customer_id FROM public.profiles WHERE customer_code = v_code;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Customer ID not found. Check the code and try again'; END IF;
  RETURN QUERY SELECT * FROM public.award_purchase_stamp(p_shop_id, v_customer_id, p_receipt_reference);
END;
$$;
REVOKE ALL ON FUNCTION public.award_purchase_stamp_by_code(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_purchase_stamp_by_code(UUID, TEXT, TEXT) TO authenticated;
COMMIT;
