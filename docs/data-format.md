# Data format and upgrades

Students' grades live only in their browser (`localStorage`, key `lycee-tracker`) and in the JSON files they export. Both use the **same format**, versioned by `SCHEMA_VERSION` in [`src/store/schema.ts`](../src/store/schema.ts). Any change to the app must keep that data loading, or students lose their grades.

## Export file

```json
{
  "app": "lycee-tracker",
  "schemaVersion": 1,
  "exportedAt": "2026-11-14T16:00:00.000Z",
  "profiles": [ /* Profile, see src/domain/types.ts */ ]
}
```

A sample of every released version is kept in [`src/store/fixtures/`](../src/store/fixtures/).

## How data is loaded

Browser data (on every page load) and imported files go through the same path:

1. **Version check:** data from a *newer* version is refused with a message. It is never overwritten.
2. **Migrations:** `MIGRATIONS[n]` turns version `n` into `n + 1`. They run in a chain up to the current version.
3. **Repair** (`sanitizeProfiles`): fills defaults (for example, a missing weight becomes 1), drops only the entries that can't be read and lists them as warnings, swaps unknown choices for a valid one, and **keeps unknown fields**.
4. **Safety copies:** before a migration, the raw browser data is copied to `lycee-tracker:pre-v<n>:<date>`. If it can't be read at all, it's copied to `lycee-tracker:unreadable:<date>` before the app starts empty.

## Changing the format: checklist

- **Adding an optional field:** nothing to do. Old data simply doesn't have it, so give it a default in `sanitizeProfiles` if needed.
- **Renaming, moving or changing the meaning of a field, or renaming a discipline/option id:**
  1. Bump `SCHEMA_VERSION`.
  2. Add `MIGRATIONS[old]` converting the old shape.
  3. Add `src/store/fixtures/backup-v<new>.json` and **keep the old fixtures**.
  4. `npm test`: every fixture must import without warnings or loss.
- Never reuse an id (discipline, option, branch) for something else. Add a new id and migrate the old one.
