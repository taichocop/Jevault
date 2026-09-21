# v0.1 release checklist

Complete this checklist from a clean checkout and use only a dedicated, isolated test Vault for manual verification.

## Automated verification

- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

## Metadata and documentation

- [ ] `manifest.json`, `package.json`, and `versions.json` use the same current plugin version.
- [ ] `versions.json` maps the current plugin version to the intended minimum Obsidian version.
- [ ] The manifest description is 250 characters or fewer, uses correct capitalization, and ends with a period.
- [ ] `README.md` has been reviewed as end-user documentation.
- [ ] `LICENSE` exists and contains the project-owner-selected MIT License.
- [ ] `PRIVACY.md` has been reviewed.
- [ ] `SECURITY.md` has been reviewed.
- [ ] GitHub Private Vulnerability Reporting is enabled after the repository becomes public and before Community Plugin submission.
- [ ] The repository's **Security → Report a vulnerability** flow is visible after Private Vulnerability Reporting is enabled.
- [ ] The TypeSafe data disclosure lists the note title, Vault-relative note path, full Markdown note body, and candidate folder paths.
- [ ] The TypeSafe account and bring-your-own API key requirements are disclosed.

## Safety and submission compliance

- [ ] The plugin implements no telemetry, analytics, tracking, or crash reporting.
- [ ] No secret values, tracked plaintext `.env` files, SecretStorage dumps, note-body logs, or full environment dumps are present.
- [ ] No unexpected Vault mutation is present; v0.1 remains suggestion-only and read-only.
- [ ] Command IDs do not repeat the plugin ID; the classification command ID is `classify-current-note`.
- [ ] The repository contains no sample code, ads, self-update behavior, dynamic remote code, or dependency auto-install behavior.
- [ ] External TypeSafe network use and account requirements are disclosed in `README.md`.
- [ ] Desktop-only metadata remains correct.

## Clean-install manual verification

- [ ] Install the production build into a dedicated test Vault.
- [ ] Enable the plugin without a runtime error.
- [ ] Open Jevault Settings and confirm the secret selector is present.
- [ ] Confirm the Command Palette contains **Jevault: Classify current note**.
- [ ] Confirm a missing API key produces safe error UI without a network request.
- [ ] Disable and re-enable the plugin without a runtime error.
- [ ] Compare the fixture Vault before and after testing and confirm its notes and folders are unchanged.

## Release assets and publishing

- [ ] `manifest.json` is present and valid.
- [ ] A production `main.js` has been generated.
- [ ] Do not create or attach an empty `styles.css`; include it only if the plugin actually uses one.
- [ ] Verify the GitHub release contains `manifest.json` and `main.js` as binary attachments.
- [ ] Use release tag `0.1.0`, exactly matching the manifest version; do not use `v0.1.0`.
- [ ] Perform final diff, dependency, secret, Vault-mutation, and scope reviews before publishing.
