# Universal Books

A free ebook and document reader for every platform: read EPUB, PDF, MOBI, CBZ and more with full annotation tools, cloud sync, and AI features, on desktop, web and mobile.

## Contact

Questions or feedback? Reach us on Telegram: [@johnconstantine570](https://t.me/johnconstantine570)

## Building

Requires Node.js and Rust:

```
pnpm install
pnpm --filter universalbooks tauri dev
```

## Sync

`.github/workflows/sync.yml` pulls upstream changes daily, re-applies the Universal Books branding via `scripts/migrate.py`, and pushes.
