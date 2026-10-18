
-- DIGISTAMP DATABASE SCHEMA
-- PART 1: USERS, SHOPS, AND STAFF

-- 1. Customer and staff profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Partner shops
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    qr_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shop staff and permissions
CREATE TABLE IF NOT EXISTS public.shop_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shop_id UUID NOT NULL
        REFERENCES public.shops(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    role TEXT NOT NULL
        CHECK (role IN ('owner', 'cashier')),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(shop_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shops
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shop_staff
ENABLE ROW LEVEL SECURITY;

-- Customers can read only their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (select auth.uid()));

-- Customers can update only their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

-- Registered users can view participating shops
CREATE POLICY "Authenticated users can view shops"
ON public.shops
FOR SELECT
TO authenticated
USING (true);

-- Staff can see their own staff memberships
CREATE POLICY "Staff can view own memberships"
ON public.shop_staff
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));
