// Isolated audit fixture only. Never reads the application's DATABASE_URL.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/audit@127\.0\.0\.1:55439\/medikiosk_audit$/.test(url)) throw new Error('Use the isolated medikiosk_audit database on port 55439.');
(async () => {
 const admin = new Client({connectionString: url.replace('/medikiosk_audit', '/postgres')});
 await admin.connect();
 const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'medikiosk_audit'");
 if (existing.rows.length) throw new Error('Audit database already exists; refusing to overwrite it.');
 await admin.query('CREATE DATABASE medikiosk_audit');
 await admin.end();
 const db = new Client({connectionString:url}); await db.connect();
 await db.query("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text primary key, name text, public boolean)");
 const dir = path.resolve(__dirname, '../../../../supabase/migrations');
 for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) {
   let sql = fs.readFileSync(path.join(dir,file), 'utf8');
   // This machine has no pgvector extension: exercise relational behavior only.
   sql = sql.replace('CREATE EXTENSION IF NOT EXISTS vector;', '-- pgvector unavailable in local audit').replace('VECTOR(384)', 'REAL[]');
   await db.query(sql); console.log('Applied',file);
 }
 await db.end();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
