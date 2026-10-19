-- Unique usernames, protected administration, and auditable account management.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
UPDATE public.profiles SET username = lower(trim(username)) WHERE username IS NOT NULL;
DO $$ DECLARE p RECORD; candidate TEXT; BEGIN
  FOR p IN SELECT id, customer_code FROM public.profiles WHERE username IS NULL ORDER BY created_at, id LOOP
    candidate := 'ds_' || substring(p.customer_code FROM 4);
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) THEN candidate := 'member_' || replace(p.id::TEXT, '-', ''); END IF;
    UPDATE public.profiles SET username = candidate WHERE id = p.id;
  END LOOP;
END; $$;
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z][a-z0-9_]{2,39}$');
CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (lower(username));

CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
CREATE FUNCTION public.is_platform_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
CREATE POLICY "Read own admin status" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_platform_admin());

CREATE FUNCTION public.validate_username(p_username TEXT) RETURNS TEXT LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE value TEXT := lower(trim(p_username)); BEGIN
  IF value IS NULL OR value !~ '^[a-z][a-z0-9_]{2,39}$' THEN RAISE EXCEPTION 'Use 3-40 characters: start with a letter, then letters, numbers, or underscores'; END IF;
  IF value IN ('admin','administrator','root','support','digistamp','system','owner','cashier','customer','deleted') OR value ~ '^ds_[0-9]+$' THEN
    RAISE EXCEPTION 'This username is reserved. Please choose another';
  END IF;
  RETURN value;
END; $$;
REVOKE ALL ON FUNCTION public.validate_username(TEXT) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.username_available(p_username TEXT) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE value TEXT; BEGIN
  BEGIN value := public.validate_username(p_username); EXCEPTION WHEN raise_exception THEN RETURN false; END;
  RETURN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = value AND id IS DISTINCT FROM (SELECT auth.uid()));
END; $$;
REVOKE ALL ON FUNCTION public.username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE value TEXT; BEGIN
  -- Older clients without a username receive an editable, unique default.
  IF NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), '') IS NULL THEN
    value := 'member_' || replace(NEW.id::TEXT, '-', '');
  ELSE value := public.validate_username(NEW.raw_user_meta_data ->> 'username'); END IF;
  INSERT INTO public.profiles (id, full_name, username) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', value);
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This username is already taken. Please choose another';
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_my_profile(p_full_name TEXT, p_username TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE value TEXT; BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in to update your profile'; END IF;
  IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter a full name between 1 and 120 characters'; END IF;
  SELECT username INTO value FROM public.profiles WHERE id = (SELECT auth.uid());
  IF lower(trim(p_username)) IS DISTINCT FROM value THEN value := public.validate_username(p_username); END IF;
  UPDATE public.profiles SET full_name = trim(p_full_name), username = value WHERE id = (SELECT auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This username is already taken. Please choose another';
END; $$;
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT) TO authenticated;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (full_name, username) ON public.profiles FROM anon, authenticated;

CREATE FUNCTION public.award_purchase_stamp_by_username(p_shop_id UUID, p_username TEXT, p_receipt_reference TEXT)
RETURNS TABLE (transaction_id UUID, total_stamps INTEGER) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE customer UUID; BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_staff WHERE shop_id = p_shop_id AND user_id = (SELECT auth.uid()) AND role IN ('owner','cashier')) THEN RAISE EXCEPTION 'You are not authorized for this shop'; END IF;
  SELECT id INTO customer FROM public.profiles WHERE username = lower(trim(leading '@' FROM trim(p_username)));
  IF customer IS NULL THEN RAISE EXCEPTION 'Username not found. Check it with the customer'; END IF;
  RETURN QUERY SELECT * FROM public.award_purchase_stamp(p_shop_id, customer, p_receipt_reference);
END; $$;
REVOKE ALL ON FUNCTION public.award_purchase_stamp_by_username(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_purchase_stamp_by_username(UUID, TEXT, TEXT) TO authenticated;

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  entity TEXT NOT NULL,
  record_id UUID,
  shop_id UUID,
  operation TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_events_shop_time ON public.audit_events(shop_id, created_at DESC);
CREATE INDEX audit_events_entity_time ON public.audit_events(entity, created_at DESC);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;
CREATE POLICY "Admins read audit events" ON public.audit_events FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE FUNCTION public.record_audit_event() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row JSONB; new_row JSONB; row_data JSONB; actor UUID := (SELECT auth.uid()); BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_data := coalesce(new_row, old_row);
  IF current_setting('app.deleting_user', true) = actor::TEXT THEN actor := NULL; END IF;
  IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'DELETE' THEN old_row := jsonb_build_object('id', OLD.id, 'deleted', true); END IF;
  INSERT INTO public.audit_events(actor_id, entity, record_id, shop_id, operation, before_data, after_data, reason)
  VALUES (actor, TG_TABLE_NAME, coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'shop_id')::UUID,
    CASE WHEN TG_TABLE_NAME = 'shops' THEN (row_data ->> 'id')::UUID ELSE (row_data ->> 'shop_id')::UUID END,
    TG_OP, old_row, new_row, nullif(current_setting('app.audit_reason', true), ''));
  RETURN coalesce(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.record_audit_event() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE entity TEXT; BEGIN
  FOREACH entity IN ARRAY ARRAY['profiles','shops','shop_staff','loyalty_accounts','rewards','purchase_transactions','reward_redemptions','shop_feature_access','platform_admins'] LOOP
    EXECUTE format('CREATE TRIGGER audit_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_audit_event()', entity);
    EXECUTE format('CREATE POLICY "Platform admins read all" ON public.%I FOR SELECT TO authenticated USING (public.is_platform_admin())', entity);
  END LOOP;
END; $$;

CREATE FUNCTION public.require_platform_admin() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF; END; $$;
REVOKE ALL ON FUNCTION public.require_platform_admin() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_list(p_entity TEXT, p_shop_id UUID DEFAULT NULL, p_search TEXT DEFAULT '', p_page INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE source TEXT; result JSONB; BEGIN
  PERFORM public.require_platform_admin();
  IF p_entity NOT IN ('profiles','shops','shop_staff','loyalty_accounts','rewards','purchase_transactions','reward_redemptions','shop_feature_access','platform_admins','audit_events') THEN RAISE EXCEPTION 'Unknown admin section'; END IF;
  IF p_entity = 'profiles' THEN
    source := '(SELECT p.*, u.email, u.created_at AS registered_at, (SELECT jsonb_agg(jsonb_build_object(''shop_id'', s.shop_id, ''role'', s.role)) FROM public.shop_staff s WHERE s.user_id = p.id) AS memberships, EXISTS(SELECT 1 FROM public.platform_admins a WHERE a.user_id = p.id) AS is_admin FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id)';
    ELSE source := format('public.%I', p_entity); END IF;
  EXECUTE format('SELECT jsonb_build_object(''rows'', coalesce(jsonb_agg(x.row), ''[]''::jsonb), ''has_more'', count(*) > 50) FROM (SELECT to_jsonb(t) AS row FROM %s t WHERE ($1 IS NULL OR to_jsonb(t)->>''shop_id'' = $1::text OR (%L = ''shops'' AND to_jsonb(t)->>''id'' = $1::text) OR (%L = ''profiles'' AND EXISTS(SELECT 1 FROM public.loyalty_accounts l WHERE l.customer_id = (to_jsonb(t)->>''id'')::UUID AND l.shop_id = $1 UNION ALL SELECT 1 FROM public.shop_staff s WHERE s.user_id = (to_jsonb(t)->>''id'')::UUID AND s.shop_id = $1))) AND ($2 = '''' OR to_jsonb(t)::text ILIKE ''%%'' || $2 || ''%%'') ORDER BY coalesce(to_jsonb(t)->>''created_at'', '''') DESC, coalesce(to_jsonb(t)->>''id'',to_jsonb(t)->>''shop_id'',to_jsonb(t)->>''user_id'') LIMIT 51 OFFSET $3) x', source, p_entity, p_entity)
    INTO result USING p_shop_id, left(coalesce(p_search,''),120), greatest(0,coalesce(p_page,0))*50;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list(TEXT, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list(TEXT, UUID, TEXT, INTEGER) TO authenticated;

CREATE FUNCTION public.admin_save(p_entity TEXT, p_id UUID, p_data JSONB, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed TEXT[]; field TEXT; columns TEXT := ''; expressions TEXT := ''; assignments TEXT := ''; record_type TEXT; key_column TEXT := 'id'; count_changed INTEGER;
BEGIN
  PERFORM public.require_platform_admin();
  PERFORM pg_catalog.pg_advisory_xact_lock(773001);
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter an audit reason (5-500 characters)'; END IF;
  PERFORM set_config('app.audit_reason', trim(p_reason), true);
  CASE p_entity
    WHEN 'profiles' THEN allowed := ARRAY['full_name','username'];
    WHEN 'shops' THEN allowed := ARRAY['name','description','address','qr_code','brand_color','card_color','logo_url','stamp_icon'];
    WHEN 'shop_staff' THEN allowed := ARRAY['shop_id','user_id','role'];
    WHEN 'rewards' THEN allowed := ARRAY['shop_id','title','description','required_stamps','is_active'];
    WHEN 'loyalty_accounts' THEN allowed := ARRAY['stamps','points'];
    WHEN 'shop_feature_access' THEN allowed := ARRAY['status','trial_ends_at','features']; key_column := 'shop_id';
    ELSE RAISE EXCEPTION 'This section is read-only';
  END CASE;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR p_data = '{}'::jsonb THEN RAISE EXCEPTION 'Enter details to save'; END IF;
  IF p_entity = 'profiles' THEN
    IF p_id IS NULL THEN RAISE EXCEPTION 'Users must register through authentication'; END IF;
    IF p_data ? 'username' AND p_data->>'username' IS DISTINCT FROM (SELECT username FROM public.profiles WHERE id = p_id) THEN
      p_data := jsonb_set(p_data,'{username}',to_jsonb(public.validate_username(p_data->>'username')));
    END IF;
    IF p_data ? 'full_name' AND length(trim(coalesce(p_data->>'full_name',''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Enter a full name (1-120 characters)'; END IF;
  END IF;
  IF p_entity IN ('loyalty_accounts','shop_feature_access') AND p_id IS NULL THEN RAISE EXCEPTION 'Select an existing record'; END IF;
  IF p_entity = 'shop_staff' AND p_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shop_staff s WHERE s.id = p_id AND s.role = 'owner'
      AND ((p_data ? 'role' AND p_data->>'role' <> 'owner') OR (p_data ? 'shop_id' AND p_data->>'shop_id' <> s.shop_id::TEXT))
      AND NOT EXISTS(SELECT 1 FROM public.shop_staff other WHERE other.shop_id = s.shop_id AND other.role = 'owner' AND other.id <> s.id)
  ) THEN RAISE EXCEPTION 'Assign another owner before removing the last cafe owner'; END IF;
  FOR field IN SELECT jsonb_object_keys(p_data) LOOP
    IF NOT field = ANY(allowed) THEN RAISE EXCEPTION 'Field % is not editable', field; END IF;
    columns := columns || format('%I,',field);
    expressions := expressions || format('(jsonb_populate_record(NULL::public.%I, $1)).%I,',p_entity,field);
    assignments := assignments || format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I,',field,p_entity,field);
  END LOOP;
  IF p_entity = 'loyalty_accounts' THEN assignments := assignments || 'updated_at = now(),'; END IF;
  IF p_id IS NULL THEN
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s',p_entity,rtrim(columns,','),rtrim(expressions,',')) USING p_data;
  ELSE
    EXECUTE format('UPDATE public.%I SET %s WHERE %I = $2',p_entity,rtrim(assignments,','),key_column) USING p_data,p_id;
    GET DIAGNOSTICS count_changed = ROW_COUNT;
    IF count_changed = 0 THEN RAISE EXCEPTION 'Record not found'; END IF;
  END IF;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A unique username, cafe code, or staff assignment is already in use';
END; $$;
REVOKE ALL ON FUNCTION public.admin_save(TEXT, UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save(TEXT, UUID, JSONB, TEXT) TO authenticated;

CREATE FUNCTION public.admin_remove_staff(p_id UUID, p_reason TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE membership public.shop_staff; BEGIN
  PERFORM public.require_platform_admin(); PERFORM pg_catalog.pg_advisory_xact_lock(773001);
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter an audit reason'; END IF;
  SELECT * INTO membership FROM public.shop_staff WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff membership not found'; END IF;
  IF membership.role = 'owner' AND NOT EXISTS(SELECT 1 FROM public.shop_staff WHERE shop_id = membership.shop_id AND role = 'owner' AND id <> p_id) THEN RAISE EXCEPTION 'Assign another owner first'; END IF;
  PERFORM set_config('app.audit_reason',p_reason,true);
  DELETE FROM public.shop_staff WHERE id = p_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_remove_staff(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff(UUID,TEXT) TO authenticated;

-- Preserve transaction history when a customer deletes their authentication account.
DO $$ DECLARE constraint_row RECORD; entity TEXT; BEGIN
  FOR constraint_row IN SELECT conrelid::regclass AS relation, conname FROM pg_catalog.pg_constraint
    WHERE contype = 'f' AND ((conrelid IN ('public.purchase_transactions'::regclass,'public.reward_redemptions'::regclass) AND confrelid IN ('public.profiles'::regclass,'public.loyalty_accounts'::regclass))
      OR (conrelid = 'public.loyalty_accounts'::regclass AND confrelid = 'public.profiles'::regclass)) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',constraint_row.relation,constraint_row.conname);
  END LOOP;
  ALTER TABLE public.loyalty_accounts ADD FOREIGN KEY(customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  FOREACH entity IN ARRAY ARRAY['purchase_transactions','reward_redemptions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN customer_id DROP NOT NULL, ALTER COLUMN cashier_id DROP NOT NULL',entity);
    EXECUTE format('ALTER TABLE public.%I ADD FOREIGN KEY(customer_id) REFERENCES public.profiles(id) ON DELETE SET NULL, ADD FOREIGN KEY(cashier_id) REFERENCES public.profiles(id) ON DELETE SET NULL',entity);
  END LOOP;
END; $$;

CREATE FUNCTION public.guard_auth_account_deletion() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(773001);
  IF EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = OLD.id) AND (SELECT count(*) FROM public.platform_admins) <= 1 THEN RAISE EXCEPTION 'Assign another developer admin before deleting the last admin'; END IF;
  IF EXISTS(SELECT 1 FROM public.shop_staff s WHERE s.user_id = OLD.id AND s.role = 'owner' AND NOT EXISTS(SELECT 1 FROM public.shop_staff other WHERE other.shop_id = s.shop_id AND other.role = 'owner' AND other.user_id <> OLD.id)) THEN RAISE EXCEPTION 'Transfer cafe ownership before deleting this account'; END IF;
  PERFORM set_config('app.deleting_user',OLD.id::TEXT,true);
  DELETE FROM public.audit_events WHERE entity IN ('profiles','auth_users') AND record_id = OLD.id AND operation <> 'DELETE_REQUEST';
  UPDATE public.audit_events SET before_data = NULL, after_data = jsonb_build_object('deleted',true)
    WHERE entity = 'auth_users' AND record_id = OLD.id AND operation = 'DELETE_REQUEST';
  UPDATE public.audit_events SET actor_id = NULL WHERE actor_id = OLD.id;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.guard_auth_account_deletion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_account_deletion BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.guard_auth_account_deletion();

CREATE FUNCTION public.audit_auth_email() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    INSERT INTO public.audit_events(actor_id,entity,record_id,operation,before_data,after_data)
    VALUES ((SELECT auth.uid()),'auth_users',NEW.id,'EMAIL_UPDATE',jsonb_build_object('email',OLD.email),jsonb_build_object('email',NEW.email));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_auth_email() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_email_update AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.audit_auth_email();
CREATE FUNCTION public.get_my_account() RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB; BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in to view your account'; END IF;
  SELECT to_jsonb(p) || jsonb_build_object('roles', (
    SELECT coalesce(jsonb_agg(role), '[]'::jsonb) FROM (
      SELECT 'Customer' AS role
      UNION SELECT initcap(s.role) FROM public.shop_staff s WHERE s.user_id = p.id
      UNION SELECT 'Admin' WHERE public.is_platform_admin()
    ) roles)) INTO result FROM public.profiles p WHERE p.id = (SELECT auth.uid());
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_account() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_account() TO authenticated;

CREATE FUNCTION public.admin_set_access(p_user_id UUID, p_enabled BOOLEAN, p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.require_platform_admin(); PERFORM pg_catalog.pg_advisory_xact_lock(773001);
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 OR p_enabled IS NULL THEN RAISE EXCEPTION 'Enter an audit reason'; END IF;
  PERFORM set_config('app.audit_reason', p_reason, true);
  IF p_enabled THEN INSERT INTO public.platform_admins(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  ELSE
    IF EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id) AND (SELECT count(*) FROM public.platform_admins) <= 1 THEN RAISE EXCEPTION 'Cannot remove the last admin'; END IF;
    DELETE FROM public.platform_admins WHERE user_id = p_user_id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_access(UUID,BOOLEAN,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_access(UUID,BOOLEAN,TEXT) TO authenticated;
CREATE FUNCTION public.admin_record_account_action(p_target UUID, p_action TEXT, p_details JSONB, p_reason TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.require_platform_admin();
  IF p_action NOT IN ('EMAIL_CHANGE_REQUEST','EMAIL_CHANGED','DELETE_REQUEST','INVITE_REQUEST','INVITED') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Invalid audit action'; END IF;
  INSERT INTO public.audit_events(actor_id,entity,record_id,operation,after_data,reason) VALUES ((SELECT auth.uid()),'auth_users',p_target,p_action,jsonb_build_object('email',left(p_details->>'email',320)),p_reason);
END; $$;
REVOKE ALL ON FUNCTION public.admin_record_account_action(UUID,TEXT,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_record_account_action(UUID,TEXT,JSONB,TEXT) TO authenticated;
CREATE FUNCTION public.check_account_deletion(p_user_id UUID) RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (p_user_id IS DISTINCT FROM (SELECT auth.uid()) AND NOT public.is_platform_admin()) THEN RAISE EXCEPTION 'Not authorized to delete this account'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id) AND (SELECT count(*) FROM public.platform_admins) <= 1 THEN RAISE EXCEPTION 'Assign another developer admin before deleting the last admin'; END IF;
  IF EXISTS(SELECT 1 FROM public.shop_staff s WHERE s.user_id = p_user_id AND s.role = 'owner' AND NOT EXISTS(SELECT 1 FROM public.shop_staff other WHERE other.shop_id = s.shop_id AND other.role = 'owner' AND other.user_id <> p_user_id)) THEN RAISE EXCEPTION 'Transfer cafe ownership before deleting this account'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.check_account_deletion(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_account_deletion(UUID) TO authenticated;
COMMIT;
