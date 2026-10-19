# DigiStamp visual system

The welcome screen is the visual reference for every screen. DigiStamp is a compact, mobile-first app for collecting stamps, visiting partner cafés, and managing café transactions.

## Palette and typography

Shared tokens live in `src/index.css`: dark brown `#622B14` for headings and focus, caramel `#995F2F` for primary actions and stamped ink, olive `#978F66` for stamp outlines and perforations, and cream `#E4D6A9` for the brand emblem. White surfaces, warm neutral canvas, and pale paper keep operational screens readable. Error and success messages retain distinct semantic colors.

Use self-hosted Manrope for app text and controls, and Fraunces for the DigiStamp wordmark. Headings stay compact. Use tabular numerals for balances and counts.

## Layout and components

- Keep screens in a single column, at most 440px wide. On mobile the white app surface fills the viewport; on desktop it sits on a warm neutral canvas.
- Use the stamp emblem, circular outline stamps, and paper loyalty cards as the brand vocabulary. Only the welcome illustration tilts; real loyalty cards stay level for reading.
- Primary actions use caramel with white text and a brown hover state. Secondary actions use brown text and restrained outlines. Sign-out remains secondary to the wallet and merchant tasks.
- Give inputs and interactive controls at least 44px of height, visible keyboard focus, and clear labels. Keep loading, empty, error, success, and disabled states consistent.
- QR codes keep a white background and dark brown modules. Their destinations and Supabase authentication, permissions, and transaction behavior remain owned by the existing application logic.

## Validation

Run the production build and lint after UI changes. Check the welcome, authentication, wallet, café visit, merchant QR, and cashier screens at mobile and desktop widths, including long content and empty states. Visual fixtures must stay separate from production data and permissions.
