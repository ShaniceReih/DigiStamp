# Changelog

Release versions use semantic versioning. Dates use Asia/Manila time.

## [0.1.0] - 2026-10-19

### Café Customization & App Navigation

- Add café-specific colors, logo placeholders, stamp styles, rewards, and stamp targets.
- Add an owner workspace with café switching, branding previews, and reward management.
- Replace the development-only demo cashier panel with assigned-café stamp awarding and QR sharing.
- Enforce owner permissions and time-limited customization access in Supabase; reserve continuing access for future subscription integration.
- Add separate customer Home, Rewards, Play, and Account views, compact navigation, and café-specific reward tickets.
- Expand the merchant desktop layout with sidebar navigation and a side-by-side branding preview.
- Mark unimplemented games, redemption, and reports clearly; preserve the earth-tone visual identity.
- Add database regression tests for access control, trial expiry, café isolation, and duplicate receipts.

### Deployment requirement

Apply `supabase/migrations/005_cafe_customization.sql` after migrations 001–004 **before deploying this version**. Existing cafés receive one calendar month of customization access when migration 005 is applied. No live migration runs automatically and no payment processing is included. See `CAFE_FEATURES.md`.

### Validation

- Production build and lint passed.
- Customer, owner, cashier, and expired/disabled-access views checked at 320px, 390px, and 1440px using isolated browser fixtures.
- Database regression tests passed in disposable embedded PostgreSQL; production Supabase connectivity is not verified.

## Earlier history

Earlier commits were unversioned. Commit `2479b1b` aligned app screens with the welcome page design and is the baseline before v0.1.0.
