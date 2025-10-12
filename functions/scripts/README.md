Migration script: migrate_users_to_users_by_phone.js

Purpose
- Create `users_by_phone` documents from existing `users` collection documents when the project previously stored phone as E.164 on the `users` doc or used doc ids like `+{E164}`.

Usage
- Dry run (default):
  node scripts/migrate_users_to_users_by_phone.js

- Apply changes (writes):
  node scripts/migrate_users_to_users_by_phone.js --apply --force

Options
- --apply : actually write mapping documents (default is dry-run)
- --force : overwrite existing mappings
- --limit N : only process first N user docs
- --batchSize N : commit mapping writes in batches (default 400)

Notes
- The script uses Application Default Credentials. Ensure GOOGLE_APPLICATION_CREDENTIALS is set to a service account JSON with appropriate Firestore permissions, or run it in an environment that already has ADC set.
- Always run with dry-run first to review actions.
- Backup your Firestore or test on a staging project before applying to production.

Full migration
--
A more robust migration tool is provided: `migrate_users_to_users_by_phone_full.js`.

Features:
- Pagination (safe for very large collections)
- Dry-run by default, `--apply` to write
- `--force` to overwrite existing mappings
- `--startAfter <docId>` to resume from a specific user document
- `--limit <N>` to process only N users
- `--batchSize <N>` and `--pageSize <N>` to tune performance
- `--exportCsv <path>` to export candidate mappings to CSV

Usage examples:

Dry-run whole collection:
```
node scripts/migrate_users_to_users_by_phone_full.js
```

Apply with CSV export:
```
node scripts/migrate_users_to_users_by_phone_full.js --apply --force --exportCsv mappings.csv
```

Notes:
- This script is safe to run repeatedly; use `--startAfter`/`--limit` to do staged runs.
- Always perform a dry-run first and inspect the CSV before applying to production.

Test helper
--
There is a small helper to create test documents used by `sendOtp` validation:

```
node scripts/create_test_user_by_phone.js --countryCode 48 --phoneNumber 692481995 --displayName "홍길동" --uid test-user-1 --createUsersDoc
```

Use `--useEmulator` when testing against the local Firestore emulator.
