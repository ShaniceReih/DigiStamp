# Billing overview

The owner workspace includes a read-only Billing area. It reports the selected cafe's actual customization access and shows explicitly that subscription terms, payment collection, and invoice history are not configured. It does not create a subscription, collect payment details, issue invoices, or change feature access.

## Data and permissions

- Reads the existing `shop_feature_access` record already loaded by `MerchantHome`; there are no new queries, tables, environment variables, dependencies, or migrations.
- Billing navigation and content render only when the current user's assignment for the selected cafe is `owner`. Cashiers and customers do not see it. Existing Supabase RLS remains unchanged.
- `trial` access expires at `trial_ends_at`, using the existing `featureEnabled` predicate. Trial dates are shown in Manila time. Missing or invalid dates are flagged for review rather than treated as free or paid access.
- `active` means platform-approved access, not proof of a payment. `disabled` does not enable customization.
- Only configured `custom_branding` and `custom_rewards` permissions are displayed. Feature descriptions describe access, not a newly invented paid plan.
- Refresh reloads the existing workspace data. On failure, stale billing details are hidden and the workspace's retry action remains available.
- Copy billing summary copies the selected cafe's access, trial date, feature availability, and unset commercial terms; clipboard rejection gives a manual fallback.

## Package catalog and unconfigured billing

The product-owner-supplied package prices are Starter PHP499, Growth PHP899, and Premium PHP1,499 per month per branch. Packages use finished customer-facing copy without draft or implementation labels. Prices and feature inclusions live in src/lib/billingCatalog.ts; one-time fees use the supplied ranges and quotations. No catalog package is assigned to a cafe by viewing this page.

Games and summaries/analytics use concise Coming soon labels. Premium-specific feature claims remain withheld until available. The catalog's capabilities do not change the cafe's existing permissions.

Actual subscriptions, taxes, renewal dates, invoices, and payment records remain unconfigured. Unset values are not zero balances or free subscriptions. No payment-method form, upgrade/cancel action, fake invoice, or payment-success state is included.

Future subscription records must be authoritative and separate from feature access; granting access must not fabricate a paid invoice. Future payment integrations must verify transactions on the server before changing entitlements.

## Validation and preview

Run `npm run build`, `npm run lint`, and `node --experimental-strip-types --test tests/billing.test.mjs`. Browser fixtures in the ignored `.taste-skill` directory cover owner states and non-owner visibility without contacting production Supabase. They do not verify live database connectivity.

Use the owner workspace's Billing button in the app. Local sample screenshots are available through `.taste-skill/preview.html`; they are not shipped with the app.
