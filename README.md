# Jevault

Jevault is an Obsidian desktop plugin that will suggest destination folders for Markdown notes using the existing structure of a vault.

Jevault v0.1 is suggestion-only and read-only. It reads folder paths locally and does not move, rename, modify, or delete notes or folders.

## Privacy and external services

Jevault uses the TypeSafe API to classify notes. A TypeSafe account and API key are required.

When you explicitly run `Jevault: Classify current note`, Jevault sends the active note title, Vault-relative note path, full Markdown note body, and candidate folder paths to TypeSafe. Plugin load, Settings display, and Suggestion UI display do not send note data.

Jevault does not operate its own backend, does not collect telemetry or analytics, and does not perform classification or network requests in the background.

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

## Manual installation

Build the plugin, then copy `manifest.json`, `versions.json`, and `main.js` into `.obsidian/plugins/jevault/` in a dedicated test vault. Reload Obsidian and enable **Jevault** under Community plugins.
