# Changelog

Release versions use semantic versioning. Dates use Asia/Manila time.

## [0.4.1] - 2026-10-20

### App Design Refinements

- Preserve the approved earth-tone palette, Manrope app type, Fraunces wordmark, and tilted perforated welcome card while refining spacing and paper details.
- Improve customer navigation, stamp balance hierarchy, form readability, loading placeholders, and account and unavailable-cafe screen titles.
- Refine merchant tool navigation and desktop reward-editor layouts while keeping ownership, trial access, authentication, and transaction behavior intact.
- Keep browser fixtures, design inspections, and visual previews out of releases. No new database migration is required.

## [0.4.0] - 2026-10-19

### Usernames, Account Settings, and Developer Administration

- Add globally unique, case-insensitive usernames with signup availability feedback and editable defaults for existing accounts.
- Let cashiers award verified purchase stamps using usernames as well as customer IDs and QRs.
- Add account settings for names, usernames, email changes, role badges, and confirmed account deletion.
- Add protected developer administration for users, cafés, staff, rewards, balances, transactions, feature access, and audit history; require reasons for admin edits.
- Add migration 007, account-management Edge Function, role/username/account-deletion tests, and deployment instructions in ACCOUNTS_ADMIN.md. These must be deployed before the frontend; live Auth/email behavior still requires staging verification.

## [0.3.2] - 2026-10-19

### Stamp Collection Design

- Refine café stamp cards with a compact identity header, readable stamp balance and target badge, numbered empty slots, a clear next-reward summary, and café links. Preserve earned icons when no reward is configured.

## [0.3.1] - 2026-10-19

### Earned Stamp Visibility

- Show earned stamp icons even when a café has no published reward. Only configured rewards show empty target slots; large balances retain their full count with up to 20 icons displayed.

## [0.3.0] - 2026-10-19

### Short Customer IDs

- Assign sequential public customer IDs such as DS-000001 while preserving internal UUIDs, balances, and staff relationships.
- Display/copy the shorter ID and encode it in new customer QRs. Accept short IDs at checkout and continue reading existing UUID QRs.
- Require migration 006_customer_codes.sql before deploying this change.
- Preserve existing customer_code columns and generators; validate formats and uniqueness without renumbering existing customers. Database tests cover fresh schemas, existing generators, and migration reruns.

## [0.2.1] - 2026-10-19

### QR Scan Confirmation

- Show a brief successful-scan confirmation before moving to receipt entry, while stopping camera capture immediately. Cancel the delayed handoff if the scanner is closed or navigated away from.

## [0.2.0] - 2026-10-19

### Customer QR & Cashier Scanning

- Add customer QR codes to Account and camera scanning to cashier checkout, retaining manual customer ID entry.
- Validate customer-specific QR payloads and stop the camera on success, close, navigation, or page hiding. Scanning never awards stamps automatically; existing staff permissions and receipt validation still apply.
- Add automated QR validation tests, permission-denial handling, and manual-entry fallback. No database migration is required.
- Verified real QR decoding with virtual camera frames, camera cleanup including cancelled startup, and explicit receipt submission. Physical-device camera testing remains pending.

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
