require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET || 'medikiosk_jwt_secret_key_change_in_production';

async function runReceptionistRBACTest() {
    console.log('\n========================================');
    console.log('🧪 RUNNING RECEPTIONIST RBAC TEST SUITE');
    console.log('========================================\n');

    let server;
    const port = 5099;
    const baseUrl = 'http://127.0.0.1:' + port;

    let doctorUserId = null;
    let receptionistUserId = null;
    let patientUserId = null;
    let receptionistToken = null;
    let patientToken = null;

    function request(method, path, body, headers) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, baseUrl);
            const reqHeaders = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
            const req = http.request(url, { method, headers: reqHeaders }, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        parsed = data;
                    }
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    try {
        await new Promise((resolve) => {
            server = app.listen(port, '127.0.0.1', resolve);
        });

        // 1. Create Mock Doctor
        const docRes = await pool.query(
            "INSERT INTO users (first_name, last_name, email, role, login_method, is_active) VALUES ('Super', 'Doctor', 'doc_test_' || gen_random_uuid() || '@medikiosk.com', 'doctor', 'email', true) RETURNING id;"
        );
        doctorUserId = docRes.rows[0].id;

        await pool.query(
            "INSERT INTO doctor_profiles (user_id, registration_number, specialization, department, verification_status) VALUES ($1, 'MCI-REC-' || floor(random()*1000000), 'General Medicine', 'OPD', 'verified');",
            [doctorUserId]
        );

        // 2. Create Mock Receptionist (Created by doctor)
        const recRes = await pool.query(
            "INSERT INTO users (first_name, last_name, email, role, login_method, is_active, created_by_doctor_id) VALUES ('Front', 'Desk', 'rec_test_' || gen_random_uuid() || '@medikiosk.com', 'receptionist', 'email', true, $1) RETURNING id;",
            [doctorUserId]
        );
        receptionistUserId = recRes.rows[0].id;

        // 3. Create Mock Patient
        const patRes = await pool.query(
            "INSERT INTO users (first_name, last_name, phone, role, login_method, is_active) VALUES ('Regular', 'Patient', '+91999' || floor(1000000 + random()*9000000), 'patient', 'phone', true) RETURNING id;"
        );
        patientUserId = patRes.rows[0].id;

        await pool.query(
            "INSERT INTO patient_profiles (user_id) VALUES ($1);",
            [patientUserId]
        );

        // Generate Tokens
        receptionistToken = jwt.sign(
            { sub: receptionistUserId, role: 'receptionist', doctorId: doctorUserId },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        patientToken = jwt.sign(
            { sub: patientUserId, role: 'patient' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('✅ Mock users and credentials created.');

        // Test 1: Receptionist fetches stats
        const statsRes = await request('GET', '/api/receptionist/stats', null, {
            Authorization: 'Bearer ' + receptionistToken,
        });

        if (statsRes.status === 200 && statsRes.body.success) {
            console.log('✅ Test 1 Passed: Receptionist fetched front-desk stats successfully.');
        } else {
            throw new Error('Test 1 Failed: Status ' + statsRes.status + ' - ' + JSON.stringify(statsRes.body));
        }

        // Test 2: Receptionist registers walk-in patient
        const walkInRes = await request('POST', '/api/receptionist/patients/walk-in', {
            firstName: 'WalkIn',
            lastName: 'Patient',
            phone: '+91988' + Math.floor(1000000 + Math.random() * 9000000),
            doctorId: doctorUserId,
            reason: 'Acute Fever',
        }, {
            Authorization: 'Bearer ' + receptionistToken,
        });

        if (walkInRes.status === 201 && walkInRes.body.success && walkInRes.body.appointment && walkInRes.body.appointment.status === 'confirmed') {
            console.log('✅ Test 2 Passed: Receptionist registered and checked in walk-in patient.');
        } else {
            throw new Error('Test 2 Failed: Status ' + walkInRes.status + ' - ' + JSON.stringify(walkInRes.body));
        }

        // Test 3: Receptionist fetches hospital appointments list
        const apptsRes = await request('GET', '/api/receptionist/appointments', null, {
            Authorization: 'Bearer ' + receptionistToken,
        });

        if (apptsRes.status === 200 && Array.isArray(apptsRes.body.appointments)) {
            console.log('✅ Test 3 Passed: Receptionist retrieved ' + apptsRes.body.appointments.length + ' appointments.');
        } else {
            throw new Error('Test 3 Failed: Status ' + apptsRes.status);
        }

        // Test 4: Security Check - Patient denied access to receptionist endpoints (403 Forbidden)
        const deniedRes = await request('GET', '/api/receptionist/stats', null, {
            Authorization: 'Bearer ' + patientToken,
        });

        if (deniedRes.status === 403) {
            console.log('✅ Test 4 Passed: Patient blocked from receptionist route with 403 Forbidden.');
        } else {
            throw new Error('Test 4 Failed: Expected 403 but got ' + deniedRes.status);
        }

        // Test 5: Receptionist fetches patient directory
        const patientsListRes = await request('GET', '/api/receptionist/patients', null, {
            Authorization: 'Bearer ' + receptionistToken,
        });

        if (patientsListRes.status === 200 && Array.isArray(patientsListRes.body.patients)) {
            console.log('✅ Test 5 Passed: Receptionist retrieved ' + patientsListRes.body.patients.length + ' patients from directory.');
        } else {
            throw new Error('Test 5 Failed: Status ' + patientsListRes.status);
        }

        console.log('\n🎉 ALL RECEPTIONIST RBAC TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
        console.error('❌ Test Suite Error:', err.message);
        process.exitCode = 1;
    } finally {
        if (receptionistUserId) await pool.query('DELETE FROM users WHERE id = $1;', [receptionistUserId]).catch(() => {});
        if (doctorUserId) await pool.query('DELETE FROM users WHERE id = $1;', [doctorUserId]).catch(() => {});
        if (patientUserId) await pool.query('DELETE FROM users WHERE id = $1;', [patientUserId]).catch(() => {});
        if (server) server.close();
        await pool.end();
    }
}

if (require.main === module) {
    runReceptionistRBACTest();
}
