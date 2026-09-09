require("dotenv").config();
const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, "../../migrations/20260909100000_create_teleconsultations_and_messages.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");
        console.log("Running migration: 20260909100000_create_teleconsultations_and_messages.sql");
        await pool.query(sql);
        console.log("Teleconsultation tables migration successfully applied! ✅");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigration();
