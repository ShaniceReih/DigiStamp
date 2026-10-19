# Café trial features

This version adds café-specific branding and rewards, an owner workspace, a basic cashier checkout, and server-enforced customization access. It contains no billing integration or payment collection.

## Deploy in this order

1. Ensure migrations 001–004 are already applied to the target Supabase project.
2. Apply `supabase/migrations/005_cafe_customization.sql` using the project's normal migration process or Supabase SQL Editor. Back up production before applying migrations.
3. Deploy the app with the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values. The new app requires migration 005; do not deploy it against the old schema.

No live migration is applied by building or previewing the app. No café, staff, reward, logo, or customer sample records are seeded by migration 005.

## Trial and future payment access

Existing cafés receive one calendar month of customization access starting when migration 005 is applied. Cafés created afterward receive one calendar month from their creation. Trial dates are stored in UTC and checked by the database. There is no automatic renewal.

`shop_feature_access` stores the café's status, trial expiry, and enabled customization features:

- `trial`: access ends at `trial_ends_at`.
- `active`: platform-approved continuing access, reserved for future subscriptions or manual arrangements.
- `disabled`: customization editing is locked.
- `features`: currently `custom_branding` and `custom_rewards`; each is independently checked.

Only platform administrators or trusted future billing code should change these records. Browser clients, owners, and cashiers have no write access. Future verified billing events can maintain this table without changing the café settings model. An `active` flag does not process or verify a payment by itself.

Both owner RPCs enforce ownership of the requested café, its enabled features, and its current access status. Locking buttons in the browser is only a convenience. Customers can still read saved branding, active rewards, and their balances after customization access expires. Stamp awarding is a base feature and remains available to assigned staff; the trial currently gates customization editing only.

## Owner workflow

Assign an existing account to a café in `shop_staff` with `role = 'owner'`. Owners can switch between assigned cafés, change colors and a stamp style, supply an optional HTTPS logo URL, and add/edit/pause rewards. There is no file upload or custom stamp-artwork upload yet. The neutral logo placeholder is used until a logo is supplied. The sample reward inside an unconfigured owner's preview is never saved automatically.

Rewards belong to a café and use its existing stamp balance. The next unreached active target is displayed; reached rewards are labeled. Above 20 stamps the card limits decorative stamp marks to 20 and also shows the numeric progress. Changing a reward target changes the target for existing customers; balances are not reset. Reward redemption remains unimplemented.

## Cashier workflow

Assign an existing account using `role = 'cashier'`. Cashiers can share their assigned café QR link and award one stamp for a verified receipt. They cannot edit branding or rewards. The selected café ID is passed to the existing `award_purchase_stamp` RPC, which verifies membership and prevents duplicate receipt credit within that café. Customers can copy their user ID from their wallet for the cashier to enter. Camera scanning, staff invitations, customer search, and transaction reporting are deferred.

Staff can also switch to their personal customer wallet. Each café has a separate customer balance and reward list.

## Verification

Run `npm run build` with valid deployment environment settings and `npm run lint`. Browser-only fixtures can be used for local visual review; they do not prove live Supabase connectivity.

`supabase/tests/cafe_customization.sql` is a rollback-only regression test intended for a disposable database with migrations 001–005. It checks owner/cashier/customer permissions, direct-write denial, café isolation, duplicate receipts, invalid input, trial expiry, continuing access, disabled access, and preservation of customer balances. It was exercised locally using embedded PostgreSQL with a minimal Supabase Auth schema stub; validate the migration against a staging Supabase project before production.
