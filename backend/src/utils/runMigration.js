// Historical convenience runner. Supabase CLI is the canonical migration workflow.
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function runMigration() {
    const filename = process.argv[2];
    if (!filename || !/^\d{14}_[a-z0-9_]+\.sql$/.test(filename)) {
        throw new Error("Specify an exact filename from supabase/migrations. No migration is run by default.");
    }
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    const sqlPath = path.resolve(__dirname, "../../../supabase/migrations", filename);
    const sql = fs.readFileSync(sqlPath, "utf8");
    const pool = require("../config/db");
    try {
        await pool.query(sql);
        console.log(`Applied ${filename}. This manual runner does not update Supabase CLI migration history.`);
    } finally { await pool.end(); }
}
if (require.main === module) runMigration().catch(error => { console.error(error.message); process.exitCode = 1; });
