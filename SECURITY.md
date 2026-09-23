# Security

## Reporting a vulnerability

Jevault uses **GitHub Private Vulnerability Reporting** as its security-reporting channel.

GitHub makes Private Vulnerability Reporting available for public repositories. After this repository is made public, the project owner will enable the feature before Community Plugin submission. Once enabled, report vulnerabilities through the repository's **Security → Report a vulnerability** form.

Until the repository is public and Private Vulnerability Reporting has been enabled, do not include sensitive vulnerability details, API keys, note contents, or other secrets in a public issue.

## Secrets

- Do not hard-code or commit API keys.
- Do not log API keys or SecretStorage values.
- Do not dump SecretStorage or a full process environment.
- Do not put real secrets in fixtures, snapshots, `.env` files, or documentation.
- Keep API keys in Obsidian SecretStorage. Plugin settings may retain only the selected secret reference/name.

## Vault safety

Jevault supports a manual move only after the user selects a displayed candidate and explicitly confirms **Move**. Candidate selection, classification completion, plugin load, and settings changes never move notes automatically.

- Validate the original classified Markdown file by its captured path and in-memory identity; never fall back to the active note.
- Revalidate the existing destination folder immediately before moving.
- Preserve the filename and extension. Refuse an existing target, including case/Unicode-equivalent names; never overwrite, delete, or automatically rename.
- Block repeated confirmations and concurrent moves involving the same source or target.
- Cancel before the move API starts on Close or plugin unload. Once the API starts, handle its actual result without custom rollback.
- Use `FileManager.renameFile`; Obsidian controls standard link updates according to user preferences. Do not implement custom link, note-body, frontmatter, or tag rewriting.
- Do not create folders, delete notes, or add automatic/background moves.

Vault access must use Obsidian APIs. Tests must never operate on a real user Vault.

## Network safety

Jevault communicates with TypeSafe only after the user explicitly runs classification or selects **Retry**. Manual move does not make another TypeSafe request. It does not implement background classification, background retry, automatic upload, telemetry, or analytics.

TypeSafe SDK usage must remain inside `TypeSafeAdapter`, behind the classifier interface. Error handling must not expose provider responses, credentials, or note bodies.

## Testing

Unit tests must use fakes and make no network calls. Vault-related tests must use isolated fixtures or fake Vaults, never a real user Vault. A real TypeSafe integration test may run only when explicitly invoked with a safely supplied secret; it is not part of the ordinary unit test suite.
