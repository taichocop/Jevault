# Jevault

Jevault is an Obsidian desktop plugin that will suggest destination folders for Markdown notes using the existing structure of a vault.

This initial `0.1.0` skeleton contains only the plugin lifecycle and development tooling. It does not scan or modify a vault, send network requests, collect telemetry, or require an API key.

## Development

Requirements: an active Node.js LTS release (20, 22, or 24 and later) and npm.

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
```

For local development, run `npm run dev` to rebuild `main.js` when source files change.

## Manual installation

Build the plugin, then copy `manifest.json`, `versions.json`, and `main.js` into `.obsidian/plugins/jevault/` in a dedicated test vault. Reload Obsidian and enable **Jevault** under Community plugins.
