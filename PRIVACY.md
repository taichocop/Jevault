# Privacy

Jevault v0.1 suggests existing Vault folders for the active Markdown note and supports explicitly confirmed manual moves. This document describes the data handling implemented by the plugin.

## Data sent to TypeSafe

TypeSafe is a third-party service separate from Jevault. When you explicitly run **Jevault: Classify current note** or select **Retry**, Jevault may send the following data to the TypeSafe API:

- The active note title
- The Vault-relative note path
- The full Markdown note body
- Candidate folder paths

These fields are used to request ranked destination folder suggestions. For information about how TypeSafe handles data, see the [TypeSafe privacy policy](https://typesafe.ai/legal/privacy-policy). That policy describes TypeSafe's practices, not guarantees made by Jevault.

## Local processing

Before an explicit classification request, Jevault performs the following operations locally:

- Accesses the active note through the Obsidian API
- Enumerates existing Vault folder paths through the Obsidian API
- Builds and filters destination candidates
- Loads Jevault settings
- Looks up the selected API key through Obsidian SecretStorage

Plugin load, Settings display, and Suggestion UI display do not send note data. Jevault does not classify, retry, or upload notes in the background.

Manual candidate selection, confirmation, and move use only local Vault operations. They do not send another TypeSafe request or resend note data. The suggestion application retains the original Vault-relative path and an in-memory file identity for safe validation; the UI receives no note body, API key, or raw provider response. Nothing is persisted for move history. Obsidian may update links locally according to the user’s preferences.

## No Jevault backend

Jevault does not operate its own backend. Classification requests go from the plugin to the TypeSafe API.

## Telemetry

Jevault does not implement analytics, tracking, usage telemetry, or crash reporting.

## API key

The TypeSafe API key is managed through Obsidian SecretStorage. Jevault's plugin settings retain the selected secret reference/name, not a copy of the API key value. The key is resolved only when needed for an explicit classification request and is not logged by Jevault.
