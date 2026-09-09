# Historical migration copies

The canonical, ordered migration history is **`supabase/migrations/`** at the repository root. These older copies are retained for compatibility and reference. Do not apply both directories, add new migrations here, or treat this directory as a complete bootstrap schema.

Use the Supabase CLI migration workflow for deployed databases. `backend/src/utils/runMigration.js` now requires an explicit canonical filename instead of silently running one hardcoded migration; it is a manual troubleshooting helper and does not maintain Supabase CLI history.
