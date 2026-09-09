const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
if (process.env.TEST_DATABASE_URL !== 'postgresql://audit@127.0.0.1:55439/medikiosk_audit') throw new Error('Explicit isolated test database required.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_SSL = 'disable';
process.env.JWT_SECRET = 'isolated-audit-secret-not-for-deployment-2026';
process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';
process.env.NODE_ENV = 'test';
process.chdir('/private/tmp'); // Do not load real provider credentials via dotenv.
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');
const ml = require('../../services/mlService');
ml.processDocumentOCR = async () => { throw new Error('Simulated OCR outage'); };
ml.askDocumentQuestion = async (patientId) => ({ patientId, answer: 'Grounded test response' });
ml.deleteDocumentVectors = async () => {};
ml.searchDocuments = async () => ({results:[]});
const app = require('../../server');
let server, base, count = 0;
const fixtures = {};
const check = (name, fn) => fn().then(()=>{count++;console.log(`PASS ${name}`);});
async function request(role, method, path, body) {
 const res = await fetch(base + path, {method,headers:{...(role ? {Authorization:`Bearer ${fixtures[role].token}`} : {}),...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'}:{})}, body:body ? body instanceof FormData ? body : JSON.stringify(body) : undefined});
 const data = await res.json().catch(()=>({})); return {status:res.status,data};
}
(async()=>{
 for (const [key,role] of Object.entries({patient:'patient',otherPatient:'patient',doctor:'doctor',otherDoctor:'doctor',receptionist:'receptionist',nurse:'nurse',admin:'admin'})) {
  const id = crypto.randomUUID();
  await pool.query("INSERT INTO users (id,first_name,last_name,email,role,login_method,created_by_doctor_id) VALUES ($1,$2,'Audit',$3,$4,'email',$5)",[id,key,`${id}@example.invalid`,role,['receptionist','nurse','admin'].includes(role)?fixtures.doctor.id:null]);
  if(role==='patient') await pool.query("INSERT INTO patient_profiles (user_id,state,preferred_language,interaction_mode,accessibility_preference) VALUES ($1,'Maharashtra','en','touch','none')",[id]);
  if(role==='doctor') await pool.query("INSERT INTO doctor_profiles (user_id,registration_number,specialization,verification_status) VALUES ($1,$2,'General Medicine','verified')",[id,id]);
  fixtures[key] = {id,token:jwt.sign({sub:id,role},process.env.JWT_SECRET)};
 }
 const p=fixtures.patient.id,d=fixtures.doctor.id,od=fixtures.otherDoctor.id;
 const appt = (await pool.query("INSERT INTO appointments (patient_id,doctor_id,scheduled_at,reason) VALUES ($1,$2,CURRENT_TIMESTAMP+interval '2 days','Private complaint') RETURNING id",[p,d])).rows[0].id;
 const otherAppt = (await pool.query("INSERT INTO appointments (patient_id,doctor_id,scheduled_at) VALUES ($1,$2,CURRENT_TIMESTAMP+interval '3 days') RETURNING id",[fixtures.otherPatient.id,od])).rows[0].id;
 const session = (await pool.query("INSERT INTO clinical_sessions (patient_id,chief_complaint,language,status,current_state,consultation_type) VALUES ($1,'Private symptom','en','active','{}','allopathic') RETURNING id",[p])).rows[0].id;
 const relation = (await pool.query("INSERT INTO patient_doctor_relationships (patient_id,doctor_id,status,consent_method) VALUES ($1,$2,'active','qr_scan') RETURNING id",[p,d])).rows[0].id;
 server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); base=`http://127.0.0.1:${server.address().port}`;
 await check('authentication required',async()=>assert.equal((await request(null,'GET','/api/patient/history')).status,401));
 for (const key of Object.keys(fixtures)) await check(`${key} identity`,async()=>assert.equal((await request(key,'GET','/api/auth/me')).status,200));
 await check('patient cannot cancel another patient appointment',async()=>assert.equal((await request('otherPatient','PATCH',`/api/appointments/${appt}/status`,{status:'cancelled'})).status,403));
 await check('unassigned doctor cannot update appointment',async()=>assert.equal((await request('otherDoctor','PATCH',`/api/appointments/${appt}/status`,{status:'completed'})).status,403));
 await check('patient cannot mark consultation completed',async()=>assert.equal((await request('patient','PATCH',`/api/appointments/${appt}/status`,{status:'completed'})).status,403));
 await check('receptionist cannot read clinical appointment detail',async()=>assert.equal((await request('receptionist','GET',`/api/appointments/${appt}`)).status,403));
 await check('receptionist cannot read unified history',async()=>assert.equal((await request('receptionist','GET',`/api/doctor/patient/${p}/unified-history`)).status,403));
 await check('doctor without relationship cannot read unified history',async()=>assert.equal((await request('otherDoctor','GET',`/api/doctor/patient/${p}/unified-history`)).status,403));
 await check('standalone intake remains retrievable by owner',async()=>assert.equal((await request('patient','GET',`/api/sessions/${session}`)).status,200));
 await check('other patient cannot read intake',async()=>assert.equal((await request('otherPatient','GET',`/api/sessions/${session}`)).status,403));
 await check('staff cannot start intake for patient',async()=>assert.equal((await request('receptionist','POST','/api/sessions/start',{patientId:p})).status,403));
 await check('doctor cannot verify other doctors',async()=>assert.equal((await request('doctor','PATCH',`/api/doctor/admin/verify/${od}`,{action:'verify'})).status,403));
 await check('receptionist list contains no clinical notes and only own practice',async()=>{
  const res=await request('receptionist','GET','/api/receptionist/appointments');assert.equal(res.status,200);assert.equal(res.data.appointments.length,1);assert.ok(!JSON.stringify(res.data).includes('Private complaint'));assert.ok(!JSON.stringify(res.data).includes('aiSummary'));
 });
 await check('staff cannot check in another practice appointment',async()=>assert.equal((await request('receptionist','POST',`/api/receptionist/check-in/${otherAppt}`)).status,404));
 let docId;
 await check('OCR outage preserves original without invented clinical records',async()=>{
  const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'audit.png');
  const res=await request('patient','POST','/api/documents/upload',form);assert.equal(res.status,201);assert.equal(res.data.ocr.status,'failed');assert.equal(res.data.ocr.extractedText,'');docId=res.data.document.id;
  assert.equal((await pool.query('SELECT * FROM medical_history WHERE patient_id=$1',[p])).rows.length,0);
 });
 for(const role of ['otherPatient','doctor','otherDoctor','receptionist','nurse']) {
  for(const endpoint of [`/api/documents/${docId}`,`/api/documents/${docId}/url`]) await check(`${role} blocked from private ${endpoint.endsWith('url')?'download':'OCR'}`,async()=>assert.equal((await request(role,'GET',endpoint)).status,403));
  await check(`${role} blocked from document deletion`,async()=>assert.equal((await request(role,'DELETE',`/api/documents/${docId}`)).status,403));
 }
 await check('connected doctor has no implicit document access',async()=>{const r=await request('doctor','GET',`/api/doctor/patient/${p}/unified-history`);assert.equal(r.status,200);assert.equal(r.data.unifiedHistory.documents.length,0);});
 await check('owner can retrieve local original',async()=>{const r=await request('patient','GET',`/api/documents/${docId}/url`);assert.equal(r.data.localDownload,true);const file=await fetch(base+`/api/documents/${docId}/file`,{headers:{Authorization:`Bearer ${fixtures.patient.token}`}});assert.equal(file.status,200);assert.ok((await file.arrayBuffer()).byteLength>0);});
 await check('owner grants view permission',async()=>assert.equal((await request('patient','PUT',`/api/documents/${docId}/access`,{doctorId:d,accessType:'view'})).status,200));
 await check('view grant permits extracted record',async()=>assert.equal((await request('doctor','GET',`/api/documents/${docId}`)).status,200));
 await check('view grant does not permit download',async()=>assert.equal((await request('doctor','GET',`/api/documents/${docId}/url`)).status,403));
 await pool.query("UPDATE document_ocr SET status='completed', extracted_text='Source text supplied by the test fixture.' WHERE document_id=$1",[docId]);
 await check('view grant sends actual patient identity to document QA',async()=>{const r=await request('doctor','POST',`/api/documents/${docId}/ask`,{question:'What does it say?'});assert.equal(r.status,200);assert.equal(r.data.patientId,p);});
 await check('owner upgrades grant to download',async()=>{await request('patient','PUT',`/api/documents/${docId}/access`,{doctorId:d,accessType:'download'});assert.equal((await request('doctor','GET',`/api/documents/${docId}/url`)).status,200);});
 await check('revoking patient relationship removes document access',async()=>{await request('patient','DELETE',`/api/patient/connected-doctors/${relation}`);assert.equal((await request('doctor','GET',`/api/documents/${docId}`)).status,403);});
 await check('deactivated staff token stops working immediately',async()=>{await pool.query('UPDATE users SET is_active=false WHERE id=$1',[fixtures.nurse.id]);assert.equal((await request('nurse','GET','/api/auth/me')).status,401);await pool.query('UPDATE users SET is_active=true WHERE id=$1',[fixtures.nurse.id]);});
 await check('failed retrieval cleanup preserves the record for retry',async()=>{
  ml.deleteDocumentVectors=async()=>{throw new Error('Simulated retrieval outage');};
  try {assert.equal((await request('patient','DELETE',`/api/documents/${docId}`)).status,503);assert.equal((await pool.query('SELECT id FROM documents WHERE id=$1',[docId])).rows.length,1);}
  finally {ml.deleteDocumentVectors=async()=>{};}
 });
 await check('owner deletes original and metadata',async()=>{const row=(await pool.query('SELECT storage_path FROM documents WHERE id=$1',[docId])).rows[0];assert.equal((await request('patient','DELETE',`/api/documents/${docId}`)).status,200);assert.equal(await require('../../services/supabaseStorageService').getLocalDocumentPath(row.storage_path),null);});
 await check('past appointment booking rejected before assessment lookup',async()=>assert.equal((await request('patient','POST','/api/appointments',{doctorId:d,scheduledAt:'2020-01-01'})).status,400));
 await check('malformed availability date rejected',async()=>assert.equal((await request('patient','GET',`/api/appointments/available?doctorId=${d}&date=banana`)).status,400));
 await check('RLS blocks browser roles',async()=>{await pool.query('SET ROLE anon');try{await assert.rejects(pool.query('SELECT * FROM documents'),{code:'42501'});}finally{await pool.query('RESET ROLE');}});
 await check('database rejects overlapping bookings',async()=>{
  await assert.rejects(pool.query("INSERT INTO appointments(patient_id,doctor_id,scheduled_at,duration_minutes) SELECT patient_id,doctor_id,scheduled_at+interval '10 minutes',30 FROM appointments WHERE id=$1",[appt]),{code:'23P01'});
 });
 await check('past date has no available slots',async()=>{const r=await request('patient','GET',`/api/appointments/available?doctorId=${d}&date=2020-01-01`);assert.equal(r.status,200);assert.ok(r.data.slots.every(s=>!s.available));});
 await check('single-use QR cannot connect two doctors concurrently',async()=>{
  const qr=await request('patient','POST','/api/patient/medical-id/qr');assert.equal(qr.status,200);
  const tokenRow=(await pool.query('SELECT token_display_code FROM patient_qr_pairing_tokens WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1',[p])).rows[0];
  const results=await Promise.all(['doctor','otherDoctor'].map(role=>request(role,'POST','/api/doctor/patients/pair/confirm',{pairingCode:tokenRow.token_display_code})));
  assert.equal(results.filter(r=>r.status===200).length,1);
 });
 await check('clinic admin cannot verify doctors',async()=>assert.equal((await request('admin','PATCH',`/api/doctor/admin/verify/${od}`,{action:'verify'})).status,403));
 const call=(await pool.query("INSERT INTO teleconsult_sessions(patient_id,doctor_id,channel_name,status) VALUES ($1,$2,$3,'approved') RETURNING id",[p,d,crypto.randomUUID()])).rows[0].id;
 await check('patient cannot forge doctor notes when ending call',async()=>assert.equal((await request('patient','POST',`/api/teleconsult/${call}/end`,{doctorNotes:'forged',prescription:'forged'})).status,403));
 await check('patient cannot post a prescription message',async()=>assert.equal((await request('patient','POST',`/api/teleconsult/${call}/messages`,{message:'forged',messageType:'prescription'})).status,403));
 await check('doctor cannot impersonate system messages',async()=>assert.equal((await request('doctor','POST',`/api/teleconsult/${call}/messages`,{message:'forged',messageType:'system'})).status,403));
 await check('other patient cannot read call messages',async()=>assert.equal((await request('otherPatient','GET',`/api/teleconsult/${call}/messages`)).status,403));
 await check('patient and doctor can exchange consultation messages',async()=>{assert.equal((await request('patient','POST',`/api/teleconsult/${call}/messages`,{message:'Fixture message'})).status,201);const r=await request('doctor','GET',`/api/teleconsult/${call}/messages`);assert.equal(r.status,200);assert.ok(JSON.stringify(r.data).includes('Fixture message'));});
 await check('doctor can complete call with clinical notes',async()=>assert.equal((await request('doctor','POST',`/api/teleconsult/${call}/end`,{doctorNotes:'Fixture notes'})).status,200));
 await check('completed call cannot be completed again',async()=>assert.equal((await request('patient','POST',`/api/teleconsult/${call}/end`,{})).status,409));
 await check('doctor can provision a nurse allowed by schema',async()=>assert.equal((await request('doctor','POST','/api/doctor/staff/create',{firstName:'Fixture nurse',email:`${crypto.randomUUID()}@example.invalid`,password:'Audit-only-password-2026!',role:'nurse'})).status,201));
 fixtures.appointmentId=appt;fixtures.sessionId=session;
 fs.writeFileSync('/private/tmp/medikiosk-audit-fixtures.json',JSON.stringify(fixtures),{mode:0o600});
 console.log(`${count} audit checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));await pool.end();});
