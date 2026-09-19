# Backup and restore drill

Run this drill only with a separate, disposable PostgreSQL database. It intentionally restores with `pg_restore --clean`, so the target database is overwritten.

Required environment variables:

- `DATABASE_URL`: source database to back up.
- `BACKUP_RESTORE_VERIFY_DATABASE_URL`: separate restore-test database. It must not match the source host and database path.
- `BACKUP_RESTORE_CONFIRM=restore-verify`: explicit overwrite acknowledgement.
- `BACKUP_RESTORE_RECORD_PATH`: optional JSON result path. If omitted, the script writes under `backend/backup-restore-results/`.

On Windows, the script automatically finds a standard PostgreSQL installation under `C:\\Program Files\\PostgreSQL`. For a custom installation, set `POSTGRES_BIN_DIR`, or use `PG_DUMP_BIN` and `PG_RESTORE_BIN` to point to the two executables.

From `backend/`, run:

```powershell
npm run backup:restore-verify
```

The generated JSON record contains `status`, UTC start/end timestamps and `recoverySeconds`. Attach that result to the operational change record after each drill. Never commit connection URLs, dump files or drill records containing sensitive operational data.
