# v0.1 release checklist

Complete this checklist from a clean checkout and use only a dedicated, isolated test Vault for manual verification.

## Automated verification

- [ ] `npm install`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Confirm the production `main.js` passes the full third-party license notice verification (`npm run verify:licenses`); repeat the bundled-dependency license audit after dependency updates.

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
- [ ] The only intentional Vault mutation is an explicitly confirmed manual move through Obsidian; no automatic move or custom content rewrite exists.
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
- [ ] Compare the fixture Vault before and after testing: only explicitly confirmed moves and Obsidian-managed link updates are allowed.

## Manual move verification (isolated synthetic Vault only)

- [ ] Clicking a numbered candidate and pressing its number select the same candidate and show source, destination folder, and target path; selection alone does not move.
- [ ] Invalid numbers, modifier shortcuts, key repeat, and editable focus do not trigger selection.
- [ ] Enter before selection does not move; Enter after selection explicitly confirms.
- [ ] Cancel / Esc / Close before confirmation do not move.
- [ ] Explicit confirmation moves the exact classified note, even after switching the active note.
- [ ] Filename, extension, and content hash are preserved for a fixture without links requiring Obsidian updates.
- [ ] Collision (including case-equivalent names) does not overwrite or auto-rename either note.
- [ ] Source deletion, rename, move, or replacement at the same path fails safely.
- [ ] Destination disappearance or replacement by a file fails safely without folder creation.
- [ ] Already-in-folder produces feedback and zero move calls.
- [ ] Repeated Move / Enter while pending executes once; completed suggestions cannot be reused.
- [ ] Unload before move prevents mutation; Close/unload after API start causes no rollback or stale UI.
- [ ] Manual selection/confirmation/move makes no new TypeSafe request.
- [ ] Compare click and number-key flows; retain both for project-owner UX review.
- [ ] Verify supported Obsidian collision behavior for on-disk conflicts and external changes around the API call.

## Release assets and publishing

- [ ] `manifest.json` is present and valid.
- [ ] A production `main.js` has been generated.
- [ ] Include `styles.css` for the scoped suggestion spacing and button layout; verify candidate spacing and long-path wrapping in the test Vault.
- [ ] Verify the GitHub release contains `manifest.json`, `main.js`, and `styles.css` as binary attachments.
- [ ] Use release tag `0.1.0`, exactly matching the manifest version; do not use `v0.1.0`.
- [ ] Perform final diff, dependency, secret, Vault-mutation, and scope reviews before publishing.
