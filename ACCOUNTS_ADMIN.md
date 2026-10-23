# Usernames, settings, and developer administration

This release requires database migration 007 and the `account-management` Supabase Edge Function. Do not deploy the new frontend against migrations 001–006 alone.

## Deployment

1. Back up the target database and validate against a staging Supabase project first. Apply migrations 001–006 if not already installed, then apply `supabase/migrations/007_usernames_settings_admin.sql` once. Migration 007 is transactional; it is not intended to be rerun after success.
2. Deploy `supabase/functions/account-management/index.ts` as the `account-management` Edge Function. With a linked Supabase CLI project, run `supabase functions deploy account-management`. Alternatively create that named function in Supabase's dashboard and paste its source. Keep the platform JWT gateway setting consistent with `supabase/config.toml`: the gateway check is disabled because the function independently validates every bearer token using Auth's `getUser` before performing any operation.
3. The function uses Supabase's server-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never add the service key to Vite environment variables or browser code. Verify the deployed function has these standard runtime variables.
4. Confirm the Auth Site URL and allowed redirect URLs point to the intended Vercel site, and verify email delivery for signup, email changes, and invitations.
5. Bootstrap the first developer admin using the SQL Editor. Replace the placeholder with the developer's own existing customer code, then check the returned row:

```sql
INSERT INTO public.platform_admins (user_id)
SELECT id FROM public.profiles
WHERE customer_code = 'REPLACE_WITH_DEVELOPER_CUSTOMER_CODE'
ON CONFLICT DO NOTHING
RETURNING user_id;
```

6. Open Account settings using the profile icon. The selected developer should now see an Admin badge and Open admin panel. Test a non-admin account too. Additional developer admins can be granted through Users → View / edit → Account administration, with an audit reason.
7. Deploy the frontend only after migration and function verification. No SQL migration or Edge Function is applied automatically by a Git push or Vercel build.

## Profile photos (migration 008)

Apply `supabase/migrations/008_profile_photos.sql` in the Supabase SQL Editor after 007, then redeploy the `account-management` Edge Function before publishing the updated frontend. This migration creates a private `profile-photos` bucket, owner-scoped storage policies, the protected `avatar_path` column, and `update_my_avatar`. The existing `get_my_account` function includes the new column automatically. Git pushes and frontend deployments do not apply this migration or redeploy the function.

Account settings provides photo preview, save, cancel, replacement, and removal. Accept JPG/PNG/WebP files up to 5 MB; the browser strips metadata and creates a 512px square JPEG before upload. Stored files are capped at 1 MB. Signed photo links expire after an hour and refresh while the app stays open. Photos remain private to their account. The header and customer Account screen display the photo with an initial as fallback.

Account deletion removes the user's fixed photo path through the Storage API after checking owner/admin deletion guards and before deleting the Auth account. Storage cleanup errors stop deletion so it can be retried. Test `supabase/tests/profile_photos.sql` only against a disposable database; it rolls back its fixture rows. Local verification uses an embedded database with a simulated Storage schema and mocked browser uploads; real Supabase Storage uploads still require staging verification.

## Usernames and cashier lookup

Apply `supabase/migrations/009_profile_identity_sync.sql` after 008 to synchronize current usernames and full names into Auth user metadata. It also repairs existing stale metadata, preserving unrelated metadata keys. Both self-service and developer-admin edits run the same database trigger. Profiles remain the canonical identity source; UUIDs, customer codes, memberships, balances, and purchase references do not change. Audit snapshots retain the original values so username changes remain traceable.

Successful profile edits notify the current page and other open tabs. Account headers, customer QR username labels, and admin lists refresh on those notifications and when a tab regains focus. Read-only admin details refresh with their list; unsaved edit fields remain intact. Other devices retrieve current values when returning to the app or refreshing. This does not require a Realtime publication.

Usernames are case-insensitive, stored in lowercase, unique across DigiStamp, and contain 3–40 characters: a starting letter followed by letters, numbers, or underscores. Platform-like names are reserved. The signup form checks availability, and the database unique index remains authoritative during concurrent registrations or edits.

Existing accounts receive editable usernames such as `ds_000001`. An existing custom username is normalized, not silently reassigned; conflicting pre-existing usernames stop migration. Legacy signups without a username receive a unique editable fallback. Users change their assigned default through Account settings. Supabase UUIDs and DS customer codes remain unchanged.

Cashiers can enter `@username`, `username`, `DS-000001`, or scan a customer QR. Existing UUID QR codes still work. Username resolution happens in the database only after verifying the cashier's membership of the selected café. It does not expose a public customer directory or award stamps without a receipt. Changing a username does not invalidate the customer's QR, because the QR uses the stable DS customer code.

## Settings and roles

Profile icon → Account settings is available from customer and merchant screens, including a café visit. Account in the bottom navigation also contains an Account settings link. Users can change full name and username, request an email change through Supabase Auth, and see their Customer, Cashier, Owner, and/or Admin roles. The new email does not become the sign-in address until the configured confirmation flow completes. Roles come from `shop_staff` and `platform_admins`; user-editable Auth metadata never grants permissions.

## Deletion and retention

Deletion requires the authenticated caller and the exact confirmation `DELETE`. Self-deletion always targets the caller, ignoring any supplied target ID. The Edge Function uses the server-side Auth Admin API; browser clients never receive elevated credentials.

Deleting an account removes its Auth login, profile, memberships, and stamp balances. Purchases and redemptions remain with customer/cashier references set to null. Profile/email audit snapshots for that account are removed; a developer's deletion request retains accountability with identifying email data removed. Ledger IDs and receipt references remain. Audit recording starts when migration 007 is installed; earlier history remains in the existing transaction tables and Auth registration timestamps.

A sole café owner must transfer ownership first. The last developer admin cannot be deleted or demoted. A database deletion trigger enforces these rules even for Auth Admin deletion, with an advisory lock shared by staff/admin management to avoid concurrent removals bypassing the checks.

## Developer panel

The panel separates People, Cafés & rewards, and Activity. Choose a section in the desktop sidebar or the mobile Admin section menu. Each section has its own searchable, paginated list. View opens a read-only details screen; Edit opens a separate form. Returning to the list preserves its café filter, search, and page. Invitations and new staff/café/reward forms also open separately. Staff lists resolve account names, and cashier assignment checks usernames or customer codes while typing. Assigning another person creates a separate membership and preserves the existing owner.

The admin panel has paginated search and café filtering for users, cafés, staff assignments, rewards, stamp balances, purchases, redemptions, customization access, developer admins, and the audit trail. Users are registered globally; café filtering identifies their staff or loyalty-account associations rather than inventing a café-specific registration event.

Admins can invite users, edit full names/usernames, request sign-in email corrections with confirmation, delete eligible accounts, assign/remove staff, grant/remove other developer admins, create/edit cafés and rewards, adjust stamp/point balances, and manage customization access. Mutations record a time, affected record, applicable before/after values, and actor when available. Auth-service actions can have a null actor; admin Auth operations additionally record the authenticated administrator's request. Admin edits require a reason. Invitations create customers; staff/admin access is assigned separately.

Purchases, redemptions, generated identifiers, and audit records are read-only in the panel. Correct a mistaken stamp balance through an audited balance adjustment instead of rewriting purchase history. Pause rewards rather than deleting referenced history. Café records with historical activity are retained; the interface does not offer destructive café/history deletion.

## Verification

- `npm test`: username normalization, QR compatibility, server-function authentication boundaries, deletion confirmation/guards, and non-admin denial.
- `npm run build` and `npm run lint`: frontend checks. Build with the deployment's Supabase variables (local visual fixtures may use placeholders).
- `deno check --no-config --no-lock --node-modules-dir=none supabase/functions/account-management/index.ts`: Edge Function type check.
- `supabase/tests/accounts_admin.sql`: rollback-only regression suite for a disposable database with migrations 001–007. Covers duplicate registration and edits, privilege escalation denial, username stamping, café isolation, audited balance changes, all admin listing sections, admin grants, last-admin/owner guards, and anonymized account deletion.

Local browser fixtures exercised signup, profile editing, email confirmation messages, role visibility, username checkout, and admin editing at 320px, 390px, and 1440px. The database suite ran in embedded PostgreSQL with a minimal Auth schema. Edge Function tests mock the Auth API; real email delivery, invitations, and account deletion still need staging verification after deployment. They have not been run against the production project.
