
-- DIGISTAMP DATABASE SCHEMA
-- PART 3: DIGITAL LOYALTY SYSTEM

-- 1. Customer loyalty balances for each shop
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL
        REFERENCES public.shops(id),

    customer_id UUID NOT NULL
        REFERENCES public.profiles(id),

    stamps INTEGER NOT NULL DEFAULT 0
        CHECK (stamps >= 0),

    points INTEGER NOT NULL DEFAULT 0
        CHECK (points >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (shop_id, customer_id)
);

-- 2. Rewards configured by participating shops
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL
        REFERENCES public.shops(id),

    title TEXT NOT NULL,
    description TEXT,

    required_stamps INTEGER NOT NULL
        CHECK (required_stamps > 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (shop_id, id)
);

-- 3. Cashier-verified purchase records
CREATE TABLE IF NOT EXISTS public.purchase_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL
        REFERENCES public.shops(id),

    customer_id UUID NOT NULL
        REFERENCES public.profiles(id),

    cashier_id UUID NOT NULL
        REFERENCES public.profiles(id),

    receipt_reference TEXT NOT NULL
        CHECK (length(trim(receipt_reference)) BETWEEN 4 AND 80),

    stamps_awarded INTEGER NOT NULL DEFAULT 1
        CHECK (stamps_awarded = 1),

    points_awarded INTEGER NOT NULL DEFAULT 0
        CHECK (points_awarded >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (shop_id, receipt_reference),

    FOREIGN KEY (shop_id, customer_id)
        REFERENCES public.loyalty_accounts(shop_id, customer_id)
);

-- 4. Reward redemption history
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    reward_id UUID NOT NULL,

    cashier_id UUID NOT NULL
        REFERENCES public.profiles(id),

    stamps_spent INTEGER NOT NULL
        CHECK (stamps_spent > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (shop_id, customer_id)
        REFERENCES public.loyalty_accounts(shop_id, customer_id),

    FOREIGN KEY (shop_id, reward_id)
        REFERENCES public.rewards(shop_id, id)
);

-- 5. Enable Row Level Security
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- 6. Remove direct write privileges from browser clients
REVOKE ALL ON TABLE
    public.loyalty_accounts,
    public.rewards,
    public.purchase_transactions,
    public.reward_redemptions
FROM anon, authenticated;

GRANT SELECT ON TABLE
    public.loyalty_accounts,
    public.rewards,
    public.purchase_transactions,
    public.reward_redemptions
TO authenticated;

-- 7. Customers see only their loyalty accounts.
-- Authorized shop staff may also see their shop's accounts.
CREATE POLICY "Read permitted loyalty accounts"
ON public.loyalty_accounts
FOR SELECT TO authenticated
USING (
    customer_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.shop_staff ss
        WHERE ss.shop_id = loyalty_accounts.shop_id
          AND ss.user_id = (SELECT auth.uid())
    )
);

-- 8. Customers can see active rewards.
-- Staff can also see inactive rewards at their shop.
CREATE POLICY "Read permitted rewards"
ON public.rewards
FOR SELECT TO authenticated
USING (
    is_active = TRUE
    OR EXISTS (
        SELECT 1 FROM public.shop_staff ss
        WHERE ss.shop_id = rewards.shop_id
          AND ss.user_id = (SELECT auth.uid())
    )
);

-- 9. Restrict access to purchase histories
CREATE POLICY "Read permitted purchases"
ON public.purchase_transactions
FOR SELECT TO authenticated
USING (
    customer_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.shop_staff ss
        WHERE ss.shop_id = purchase_transactions.shop_id
          AND ss.user_id = (SELECT auth.uid())
    )
);

-- 10. Restrict access to redemption histories
CREATE POLICY "Read permitted redemptions"
ON public.reward_redemptions
FOR SELECT TO authenticated
USING (
    customer_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.shop_staff ss
        WHERE ss.shop_id = reward_redemptions.shop_id
          AND ss.user_id = (SELECT auth.uid())
    )
);
