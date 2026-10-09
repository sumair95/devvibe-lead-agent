# Security and privacy

This repository is designed to contain documentation and safe examples only.

Never commit API keys, bot tokens, SMTP/IMAP passwords, SSH keys, n8n encryption keys, environment files, database/volume backups, raw workflow exports, pinned node data, execution logs or real prospect records. Credentials belong in the n8n credential store or an approved private secret manager. Public configuration samples must use placeholders.

Before publication, inspect an explicit file allowlist and staged diff, scan for secrets, and extract/check PDF text. `.gitignore` is preventive, not a substitute for inspection. Never stage the parent ChatGPT project or its read-only `sources/` directory.

If adding workflow exports later, remove credential objects/IDs, instance/table IDs, identifying webhook routes, email bodies, recipients, Telegram chat/user IDs, pinned data and execution data. Review embedded Code and HTTP headers independently. Keep exports inactive until configured privately.

Validate the Telegram reviewer and chat, bind callbacks to the persisted draft, and claim eligible sends atomically or serialize processing. Block private-network destinations and revalidate website redirects. Treat fetched website content as untrusted AI input.

If a secret is exposed, revoke/rotate it immediately, identify affected systems, then remove the exposed material and review Git history. Deleting the latest file is insufficient. Do not post a leaked secret in a public issue. Use the owner's established private security channel; no reporting address is invented here.

The successful duplicate-click test does not prove concurrent exactly-once delivery. Uncertain SMTP outcomes require reconciliation, not blind retries.
