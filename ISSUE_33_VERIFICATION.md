# Issue #33 verification

Date: 2026-09-23. Base: `0a8a8bd47ba88c318323ba3651aa453741134d9f`.

## Architecture and API decision

`NoteService` captures `NoteSource` before awaiting `Vault.read`. The source contains the original Vault-relative path and a private in-memory reference to the original `TFile`. The classification result carries that identity without the note body or credentials. The classifier receives the existing `NoteState`, without the identity object.

`SuggestionModal` renders and handles input. `SuggestionSession` owns the common selection/confirmation state. `NoteMoveService` validates the displayed destination, source identity, folder type, path, same-folder case, and collisions, then invokes the sole mutation API. `main.ts` only wires these dependencies. The session can submit once; the shared service also locks involved source/target paths while pending.

Installed `obsidian@1.13.1` typings and the current [official API declaration](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) identify `FileManager.renameFile` as the supported move/rename API that updates links according to user preferences. `Vault.rename` explicitly points to it for link updates. The [official plugin checklist](https://docs.obsidian.md/oo/plugin) recommends `normalizePath`, type checks, and Vault APIs over Adapter APIs. No direct filesystem/Adapter mutation or custom link rewriting is added.

Path construction is centralized. Unsafe or noncanonical paths are rejected rather than interpreted as a different destination; root, nested, and Japanese paths are covered. Runtime suggestions exclude the Vault root as before. If the root is explicitly provided as a candidate, the move boundary handles it.

## Acceptance criteria

Every row below maps to one Issue #33 acceptance criterion. “Automated” means network-free tests and/or direct source/diff inspection; Desktop evidence is identified separately below.

| Criterion | Result / evidence |
| --- | --- |
| Click candidate selection | PASS — automated and Desktop |
| Number-key selection | PASS — automated and Desktop |
| Candidate numbers visible | PASS — automated and Desktop |
| Click/number share selection flow | PASS — both call `selectCandidate`; same confirmation verified |
| Undisplayed numbers ignored | PASS — automated; Desktop invalid `4` caused no move |
| Editable focus ignored | PASS — automated |
| Selection alone cannot mutate | PASS — automated and Desktop, all fixture hashes checked before confirmation |
| Explicit confirmation before move | PASS — automated and Desktop |
| Cancel/Close cannot start move | PASS — automated; Desktop Cancel and Esc |
| Only confirmation starts move | PASS — automated and Desktop |
| Clear success feedback | PASS — Desktop `Moved to Projects` |
| Retain classified source identity | PASS — capture before read; path + object identity |
| Active-note switch cannot move wrong note | PASS — automated and Desktop A/B fixture |
| Renamed/moved/deleted source fails | PASS — automated |
| No active-file fallback | PASS — move boundary has no workspace dependency |
| Only displayed candidates accepted | PASS — automated |
| Recheck destination existence | PASS — automated |
| Require TFolder | PASS — automated |
| Do not create folders | PASS — boundary exposes no folder creation API |
| Preserve filename/extension | PASS — automated uppercase/Japanese fixture; Desktop |
| Already-in-folder is no-op | PASS — automated, dedicated feedback, zero API calls |
| No overwrite when target exists | PASS — automated file/folder/case conflicts; Desktop collision hashes unchanged |
| Never delete existing target | PASS — no delete API; Desktop target unchanged |
| No automatic rename/suffix | PASS — target uses captured filename only |
| Safe conflict message | PASS — automated and Desktop |
| No direct fs mutation | PASS — production source inspection |
| No direct Adapter mutation | PASS — production source inspection |
| Supported Obsidian API | PASS — installed and official declarations; Desktop 1.13.7 |
| Follow path normalization guidance | PASS — centralized `normalizePath` with strict validation |
| Modal does not operate Vault API | PASS — source inspection |
| TypeSafeAdapter has no move responsibility | PASS — unchanged |
| ClassificationService has no mutation detail | PASS — only adds source identity to result |
| Dedicated move application boundary | PASS — `NoteMoveService` |
| Repeated confirm does not duplicate | PASS — automated pending click/Enter and cross-session locks |
| Cancel/unload before start prevents mutation | PASS — automated, including final pre-API cancellation check |
| Completed suggestion cannot be reused | PASS — automated stale callbacks and reopen |
| No unhandled move rejection | PASS — automated boundary failure and late resolve/reject after close/unload |
| No extra TypeSafe request for move | PASS — integrated fake-classifier call count remains one; boundary has no classifier dependency |
| No API key in move state | PASS — source inspection and integrated privacy assertion |
| No note body in move UI/log | PASS — source inspection and integrated privacy assertion |
| No telemetry | PASS — source/dependency inspection |
| README matches manual move behavior | PASS — updated |
| Remove obsolete read-only/no-manual-move contract | PASS — tracked product/security/review documentation updated |
| Explicitly document no automatic move | PASS — README/SECURITY/AGENTS |
| Document required confirmation | PASS — README/SECURITY |
| Synchronize security/release docs | PASS — SECURITY/PRIVACY/RELEASE_CHECKLIST/AGENTS |
| Existing tests pass | PASS — full ordinary suite |
| New move regression tests pass | PASS — 66 new cases |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |

## Desktop manual verification

Obsidian Desktop 1.13.7, separate synthetic Vault, no real user notes. A temporary fixture plugin bundles the production `NoteService`, `ClassificationService`, `ClassificationCommand`, `SuggestionSession`, `SuggestionModal`, and `NoteMoveService`. The classifier/credential providers are synthetic and perform no network requests. The active-note-switch fixture opens B after classifying A and before displaying A's suggestions. This is not a real TypeSafe end-to-end test or a production-plugin installation test.

- Clicked candidate #1, inspected source/destination/target, verified no file/hash changed, then Cancel.
- Classified again, pressed `1`, verified the same confirmation as click, then Esc. Original remained unchanged.
- Enter before selection and an invalid number did not move.
- Classified `Inbox/keyboard-move.md`, pressed `2`, inspected confirmation, pressed Enter. Only `Projects/keyboard-move.md` appeared; original path disappeared; SHA-256, filename, extension, and frontmatter were preserved.
- Classified `Inbox/switch-source.md`, switched the workspace to `Inbox/switch-other.md` through the fixture hook, selected Projects and clicked Move. Only the original source moved; active B remained at its path with its original hash.
- Attempted `Inbox/collision.md` → `Projects/collision.md`. A safe conflict notice appeared. Both source and pre-existing target remained at their original paths with unchanged SHA-256 hashes.
- Reloaded the fixture with the final scoped stylesheet and inspected the actual suggestion screen: separate full-width buttons, clear vertical gaps, visible shortcuts, and native focus indication.

NOT VERIFIED — real TypeSafe classification plus manual move in the final production plugin. Ordinary regression tests cover the adapter; this Desktop run intentionally used a local synthetic classifier.

NOT VERIFIED — Desktop source/destination disappearance, repeated pending confirmations, editable focus, close/unload races, and standard link updates. These lifecycle/failure cases are covered by deterministic unit tests where listed above; no Desktop coverage is claimed for them. Desktop long-path wrapping across themes is not verified.

NOT VERIFIED — atomic behavior against external filesystem/sync changes after calling Obsidian's API. Jevault performs synchronous final validation and no overwrite fallback; the API exposes no abort, compare-and-move, or exclusive-create parameter. Once called, completion and standard link updates are owned by Obsidian. No custom rollback is attempted.

## Click versus number-key assessment

Both were exercised against the same first candidate and reached the same confirmation. Click provides direct spatial selection; numbered keys reduce pointer movement and make `2` then Enter quick. Both retain a visible review step with the three paths. Candidate spacing was widened following owner feedback; neither input method was removed.

## Validation and scope

- `npm test`: PASS, 17 files / 199 tests (including 66 new move cases), no real API/network.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run verify:licenses`: PASS, full TypeSafe notice retained.
- `git diff --check`: PASS.
- No dependency or lockfile changes; no background/automatic behavior, folder creation, filename generation, deletion, telemetry, or new external data flow.
- Production mutation is limited to `FileManager.renameFile` in `NoteMoveService`.
- No release, tag, public-repository change, or Obsidian submission performed.
