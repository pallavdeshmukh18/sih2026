require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const FormData = require("form-data");
const pool = require("../config/db");
const app = require("../server");
const vectorService = require("../services/vectorService");

const JWT_SECRET = process.env.JWT_SECRET || "medikiosk_jwt_secret_key_change_in_production";

async function runDocumentTests() {
    console.log("=== STARTING MEDICAL DOCUMENT PIPELINE INTEGRATION TESTS ===");

    let server;
    const PORT = 5096;
    await new Promise((resolve) => {
        server = app.listen(PORT, () => {
            console.log(`Test server running on port ${PORT}`);
            resolve();
        });
    });

    const baseUrl = `http://localhost:${PORT}`;

    const createdIds = { users: [], documents: [] };

    try {
        const timestamp = Date.now();

        // 1. Setup Patient
        const patientEmail = `patient_doc_${timestamp}@example.com`;
        const patientRes = await pool.query(
            `INSERT INTO users (first_name, last_name, email, login_method, role, is_active)
             VALUES ('Anil', 'Kumar', $1, 'email', 'patient', true)
             RETURNING id, role;`,
            [patientEmail]
        );
        const patient = patientRes.rows[0];
        createdIds.users.push(patient.id);

        await pool.query(
            `INSERT INTO patient_profiles (user_id, date_of_birth, gender)
             VALUES ($1, '1978-11-20', 'male');`,
            [patient.id]
        );

        const patientToken = jwt.sign({ sub: patient.id, role: patient.role }, JWT_SECRET, { expiresIn: "1h" });

        // TEST 1: Upload Medical Document (PNG Image buffer)
        console.log("\n[TEST 1] Uploading medical document (image/png)...");
        const form = new FormData();
        const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
        form.append("file", dummyPng, { filename: "prescription_sample.png", contentType: "image/png" });
        form.append("documentType", "prescription");

        const uploadRes = await new Promise((resolve, reject) => {
            const url = new URL("/api/documents/upload", baseUrl);
            const headers = {
                ...form.getHeaders(),
                Authorization: `Bearer ${patientToken}`,
            };
            const req = http.request(url, { method: "POST", headers }, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    let parsed = null;
                    try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on("error", reject);
            form.pipe(req);
        });

        console.log(`Status: ${uploadRes.status}`, uploadRes.body);
        if (uploadRes.status !== 201 || !uploadRes.body.document?.id) {
            throw new Error(`Failed to upload document: ${JSON.stringify(uploadRes.body)}`);
        }
        const documentId = uploadRes.body.document.id;
        createdIds.documents.push(documentId);
        console.log(`✅ [TEST 1 PASSED] Document uploaded successfully with ID: ${documentId}`);

        // TEST 2: Fetch Patient Document List
        console.log("\n[TEST 2] Fetching patient document list...");
        const listRes = await new Promise((resolve, reject) => {
            const url = new URL(`/api/documents/patient/${patient.id}`, baseUrl);
            const req = http.request(url, { method: "GET", headers: { Authorization: `Bearer ${patientToken}` } }, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
                });
            });
            req.on("error", reject);
            req.end();
        });

        console.log(`Status: ${listRes.status}, Document Count: ${listRes.body.documents?.length}`);
        if (listRes.status !== 200 || listRes.body.documents.length === 0) {
            throw new Error(`Failed to list documents: ${JSON.stringify(listRes.body)}`);
        }
        console.log("✅ [TEST 2 PASSED] Document list retrieved.");

        // TEST 3: Get Signed Download URL
        console.log("\n[TEST 3] Fetching document download URL...");
        const urlRes = await new Promise((resolve, reject) => {
            const url = new URL(`/api/documents/${documentId}/url`, baseUrl);
            const req = http.request(url, { method: "GET", headers: { Authorization: `Bearer ${patientToken}` } }, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
                });
            });
            req.on("error", reject);
            req.end();
        });

        console.log(`Status: ${urlRes.status}`, urlRes.body);
        if (urlRes.status !== 200 || !urlRes.body.downloadUrl) {
            throw new Error(`Failed to obtain download URL: ${JSON.stringify(urlRes.body)}`);
        }
        console.log("✅ [TEST 3 PASSED] Download URL generated.");

        // TEST 4: Vector Service Chunking
        console.log("\n[TEST 4] Testing text chunking & embedding service...");
        const sampleText = "Patient presents with acute bronchitis. Prescribed Amoxicillin 500mg TDS for 5 days. Follow up after 1 week if cough persists.";
        const chunks = vectorService.chunkText(sampleText, 10, 2);
        console.log(`Chunks generated: ${chunks.length}`);
        if (chunks.length === 0) {
            throw new Error("Vector chunkText failed to produce chunks.");
        }
        console.log("✅ [TEST 4 PASSED] Vector chunking verified.");

        console.log("\n🎉 ALL MEDICAL DOCUMENT INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n");
    } catch (err) {
        console.error("❌ Test failed:", err.message);
        process.exitCode = 1;
    } finally {
        for (const docId of createdIds.documents) {
            await pool.query(`DELETE FROM documents WHERE id = $1`, [docId]);
        }
        for (const userId of createdIds.users) {
            await pool.query(`DELETE FROM medical_history WHERE patient_id = $1`, [userId]);
            await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        }
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runDocumentTests().then(() => process.exit(process.exitCode || 0));
}

module.exports = runDocumentTests;
