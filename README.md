# Jevault

Jevault is an Obsidian desktop plugin that suggests destination folders for Markdown notes from the folders that already exist in your vault.

```text
Active Markdown note
        ↓
Existing Vault folders
        ↓
TypeSafe Jev
        ↓
Ranked destination folder suggestions
```

Jevault v0.1 is suggestion-only and read-only. It displays candidates for review and does not move, rename, modify, or delete notes or folders.

## Requirements

- Obsidian Desktop 1.11.4 or later
- A TypeSafe account
- A TypeSafe API key that you provide (bring your own key, or BYOK)

Jevault uses the TypeSafe API for classification, so it does not provide an offline classification mode.

## Setup

Open **Settings → Community plugins → Jevault**, then configure:

- **TypeSafe API key**: Select or create an Obsidian secret containing your TypeSafe API key. Jevault stores only the secret name in its plugin settings; do not paste an API key into ordinary plugin settings or repository files.
- **Inbox folder**: Set the Vault-relative folder path to exclude that folder and its descendants from destination suggestions.
- **Number of suggestions**: Set how many ranked folder suggestions to display.
- **Ignored folders**: Enter Vault-relative folder paths to exclude, one per line.

## Usage

1. Open a Markdown note.
2. Open the Command Palette.
3. Run **Jevault: Classify current note**.
4. Wait for classification to finish.
5. Review the ranked folder suggestions.
6. Close the modal.

If a retryable error is shown, selecting **Retry** explicitly starts another classification request. In v0.1, candidates are displayed only: selecting a candidate cannot move, rename, or modify a note.

## Privacy and external services

Jevault uses TypeSafe, a third-party service, to classify notes. When you explicitly run **Jevault: Classify current note** or select **Retry**, Jevault may send the following data to the TypeSafe API:

- The active note title
- The Vault-relative note path
- The full Markdown note body
- Candidate folder paths

Plugin load, Settings display, and Suggestion UI display do not send note data. Jevault has no backend of its own and implements no telemetry, analytics, tracking, background classification, or background upload.

See [PRIVACY.md](PRIVACY.md) for details and the [TypeSafe privacy policy](https://typesafe.ai/legal/privacy-policy) for information about the separate third-party service.

## Limitations

- Desktop only
- Suggestion only; no automatic or manual move action
- Does not modify notes, folders, frontmatter, tags, or links
- Can only suggest existing, non-excluded Vault folders
- Depends on TypeSafe API availability

## Manual installation

Build the plugin, then copy `manifest.json` and `main.js` into `.obsidian/plugins/jevault/` in a dedicated test vault. Reload Obsidian and enable **Jevault** under Community plugins.

## Development

Requirements: Node.js 20.19+, 22.13+, or 24+ and npm.

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

For local development, run `npm run dev` to rebuild `main.js` when source files change.

### TypeSafe integration spike

Create a local `.env.1password` containing only a 1Password Secret Reference, never a plaintext credential. The file is ignored by Git.

```dotenv
TYPESAFE_API_KEY=op://YOUR_VAULT/YOUR_ITEM/YOUR_FIELD
```

Run the explicit network integration test through 1Password CLI:

```bash
op run --env-file=.env.1password -- npm run spike:typesafe
```
