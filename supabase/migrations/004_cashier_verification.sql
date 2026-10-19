
-- DIGISTAMP MIGRATION 004
-- Secure cashier verification and stamp awarding

CREATE OR REPLACE FUNCTION public.award_purchase_stamp(
    p_shop_id UUID,
    p_customer_id UUID,
    p_receipt_reference TEXT
)
RETURNS TABLE (
    transaction_id UUID,
    total_stamps INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cashier_id UUID;
    v_receipt TEXT;
    v_transaction_id UUID;
    v_total_stamps INTEGER;
BEGIN

    -- 1. Identify the logged-in employee
    v_cashier_id := (SELECT auth.uid());

    IF v_cashier_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Validate inputs
    IF p_shop_id IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Shop and customer are required';
    END IF;

    v_receipt := UPPER(TRIM(p_receipt_reference));

    IF v_receipt IS NULL
       OR LENGTH(v_receipt) NOT BETWEEN 4 AND 80 THEN
        RAISE EXCEPTION 'Invalid receipt reference';
    END IF;

    -- 3. Verify owner or cashier permissions
    IF NOT EXISTS (
        SELECT 1
        FROM public.shop_staff
        WHERE shop_id = p_shop_id
          AND user_id = v_cashier_id
          AND role IN ('owner', 'cashier')
    ) THEN
        RAISE EXCEPTION
            'You are not authorized for this shop';
    END IF;

    -- 4. Verify customer exists
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_customer_id
    ) THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    -- 5. Create loyalty account if needed
    INSERT INTO public.loyalty_accounts (
        shop_id,
        customer_id
    )
    VALUES (
        p_shop_id,
        p_customer_id
    )
    ON CONFLICT (shop_id, customer_id)
    DO NOTHING;

    -- 6. Record verified purchase
    -- Unique receipt constraint prevents duplicates
    INSERT INTO public.purchase_transactions (
        shop_id,
        customer_id,
        cashier_id,
        receipt_reference,
        stamps_awarded,
        points_awarded
    )
    VALUES (
        p_shop_id,
        p_customer_id,
        v_cashier_id,
        v_receipt,
        1,
        0
    )
    RETURNING id INTO v_transaction_id;

    -- 7. Award one stamp
    UPDATE public.loyalty_accounts
    SET
        stamps = stamps + 1,
        updated_at = NOW()
    WHERE shop_id = p_shop_id
      AND customer_id = p_customer_id
    RETURNING stamps INTO v_total_stamps;

    IF v_total_stamps IS NULL THEN
        RAISE EXCEPTION 'Failed to update stamp balance';
    END IF;

    -- 8. Return successful transaction
    RETURN QUERY
    SELECT v_transaction_id, v_total_stamps;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION
            'This receipt has already been credited';
END;
$$;

-- Only authenticated users may invoke the function.
-- The function itself checks shop staff permissions.

REVOKE ALL ON FUNCTION
public.award_purchase_stamp(UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.award_purchase_stamp(UUID, UUID, TEXT)
TO authenticated;
