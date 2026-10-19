-- Café customization and time-limited feature access. No payment integration.
BEGIN;

ALTER TABLE public.shops
  ADD COLUMN brand_color TEXT NOT NULL DEFAULT '#995F2F' CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN card_color TEXT NOT NULL DEFAULT '#FBF6E8' CHECK (card_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN logo_url TEXT CHECK (logo_url IS NULL OR (length(logo_url) <= 2048 AND logo_url ~ '^https://')),
  ADD COLUMN stamp_icon TEXT NOT NULL DEFAULT 'check' CHECK (stamp_icon IN ('check', 'star', 'cafe'));

-- Only the platform administrator (and, later, trusted billing code) manages access.
-- Owners cannot extend trials or enable their own paid features.
CREATE TABLE public.shop_feature_access (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'disabled')),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  features TEXT[] NOT NULL DEFAULT ARRAY['custom_branding', 'custom_rewards']::TEXT[]
    CHECK (features <@ ARRAY['custom_branding', 'custom_rewards']::TEXT[])
);
ALTER TABLE public.shop_feature_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_feature_access FROM anon, authenticated;
GRANT SELECT ON public.shop_feature_access TO authenticated;
CREATE POLICY "Staff can read shop feature access" ON public.shop_feature_access
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shop_staff s WHERE s.shop_id = shop_feature_access.shop_id AND s.user_id = (SELECT auth.uid()))
);
INSERT INTO public.shop_feature_access (shop_id) SELECT id FROM public.shops;

CREATE FUNCTION public.start_shop_trial() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.shop_feature_access (shop_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.start_shop_trial() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER start_shop_trial AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.start_shop_trial();

CREATE FUNCTION public.require_shop_feature(p_shop_id UUID, p_feature TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_staff WHERE shop_id = p_shop_id AND user_id = (SELECT auth.uid()) AND role = 'owner') THEN
    RAISE EXCEPTION 'Only this café owner can change these settings';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_feature_access
    WHERE shop_id = p_shop_id AND p_feature = ANY(features)
      AND (status = 'active' OR (status = 'trial' AND trial_ends_at > NOW()))
  ) THEN
    RAISE EXCEPTION 'Customization access has ended. Contact DigiStamp to continue';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_shop_feature(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.save_shop_branding(p_shop_id UUID, p_brand_color TEXT, p_card_color TEXT, p_logo_url TEXT, p_stamp_icon TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.require_shop_feature(p_shop_id, 'custom_branding');
  IF p_brand_color IS NULL OR p_brand_color !~ '^#[0-9A-Fa-f]{6}$'
     OR p_card_color IS NULL OR p_card_color !~ '^#[0-9A-Fa-f]{6}$'
     OR p_stamp_icon IS NULL OR p_stamp_icon NOT IN ('check', 'star', 'cafe') THEN
    RAISE EXCEPTION 'Choose valid colors and a stamp icon';
  END IF;
  IF NULLIF(trim(p_logo_url), '') IS NOT NULL AND (trim(p_logo_url) !~ '^https://' OR length(trim(p_logo_url)) > 2048) THEN
    RAISE EXCEPTION 'Logo URL must use HTTPS and contain at most 2048 characters';
  END IF;
  UPDATE public.shops SET brand_color = p_brand_color, card_color = p_card_color,
    logo_url = NULLIF(trim(p_logo_url), ''), stamp_icon = p_stamp_icon WHERE id = p_shop_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_shop_branding(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_shop_branding(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE FUNCTION public.save_shop_reward(p_shop_id UUID, p_reward_id UUID, p_title TEXT, p_required_stamps INTEGER, p_is_active BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public.require_shop_feature(p_shop_id, 'custom_rewards');
  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 120
     OR p_required_stamps IS NULL OR p_required_stamps NOT BETWEEN 1 AND 100
     OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Enter a reward name and a target between 1 and 100 stamps';
  END IF;
  IF p_reward_id IS NULL THEN
    INSERT INTO public.rewards (shop_id, title, required_stamps, is_active)
    VALUES (p_shop_id, trim(p_title), p_required_stamps, p_is_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.rewards SET title = trim(p_title), required_stamps = p_required_stamps, is_active = p_is_active
    WHERE id = p_reward_id AND shop_id = p_shop_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Reward not found for this café'; END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_shop_reward(UUID, UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_shop_reward(UUID, UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;

-- All customization writes must pass through the owner/feature checks above.
REVOKE INSERT, UPDATE, DELETE ON public.shops, public.rewards FROM anon, authenticated;
COMMIT;
