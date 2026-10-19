# Release and commit conventions

Use semantic versions while DigiStamp is in pilot development:

- `0.x.0`: a new feature release.
- `0.x.y`: a fix or refinement to that feature release.
- `1.0.0`: a separately agreed stable launch.

Keep `package.json`, `package-lock.json`, and `CHANGELOG.md` consistent. Each published release gets an annotated Git tag `vX.Y.Z` with a descriptive title, such as `v0.1.0 — Café Customization & App Navigation`.

Use descriptive conventional commit subjects:

- `feat(scope): ...` for new behavior.
- `fix(scope): ...` for corrections.
- `style(ui): ...` for presentation-only adjustments.
- `docs: ...` for documentation.
- `chore(release): prepare vX.Y.Z` for release bookkeeping without feature changes.

Release commits that include a completed feature set may use `feat(release): vX.Y.Z — <release title>`.

`main` is the deployment branch connected to Vercel. If a required database migration has not been confirmed, push to `release/vX.Y.Z` for review first. Record the migration requirement in the changelog. After it is applied and validated, merge the same release commit into `main` without rewriting its history, and push. Never force-push a published version tag.

Local screenshots, PDF extraction, browser fixtures, and temporary testing tools belong in ignored directories and are excluded from releases. Commit neither environment secrets nor generated build output.
