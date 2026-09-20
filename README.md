# Jevault

Jevault is an Obsidian desktop plugin that will suggest destination folders for Markdown notes using the existing structure of a vault.

The production plugin remains suggestion-only and does not scan or modify a vault, send network requests, or collect telemetry. An explicit integration spike is available for testing the replaceable TypeSafe adapter.

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
