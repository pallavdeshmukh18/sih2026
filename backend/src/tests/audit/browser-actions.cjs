const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {Client}=require('pg');
const fixtures=JSON.parse(fs.readFileSync('/private/tmp/medikiosk-audit-fixtures.json'));
const checks=[];
let browser;
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS',name);};
(async()=>{
 const db=new Client({connectionString:'postgresql://audit@127.0.0.1:55439/medikiosk_audit'});await db.connect();
 await db.query("INSERT INTO clinical_sessions(patient_id,consultation_type,chief_complaint,status,summary) VALUES ($1,'allopathic','Browser test assessment','completed','Fixture summary')",[fixtures.patient.id]);
 await db.end();
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(token=>localStorage.setItem('medikiosk_token',token),fixtures.patient.token);
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:55173/patient/doctor');
 await check('directory profile opens and closes',async()=>{await page.getByRole('button',{name:'View Profile',exact:true}).first().click();await page.getByRole('button',{name:'Close doctor profile'}).click();});
 await check('directory search filters doctors',async()=>{const search=page.getByPlaceholder('Search by doctor name, specialty, or hospital...');await search.fill('does-not-exist');await page.getByText('No verified doctors match your search.').waitFor();await search.fill('');});
 await check('directory does not invent ratings',async()=>assert.ok(!(await page.locator('body').innerText()).includes('years experience')));
 await check('booking shows actual slots and completed assessment',async()=>{
  await page.getByRole('button',{name:'Book Appointment',exact:true}).first().click();
  await page.getByLabel('Appointment date',{exact:true}).fill('2026-12-15');
  await page.waitForFunction(()=>document.querySelector('select[aria-label="Available time"]')?.options.length>1);
  const options=await page.getByLabel('Available time',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
  await page.getByLabel('Available time',{exact:true}).selectOption(options.find(Boolean));
  await page.getByLabel('Reason for visit').fill('Browser fixture consultation');
  await page.getByRole('button',{name:'Confirm Appointment',exact:true}).click();
  await page.getByText(/Appointment booked with/).waitFor();
 });
 await page.goto('http://127.0.0.1:55173/patient/appointments');
 await check('appointment page renders dates and filters',async()=>{
  await page.getByText('Your Appointment History').waitFor();assert.ok(!(await page.locator('body').innerText()).includes('Invalid Date'));
  await page.getByRole('button',{name:'Cancelled',exact:true}).click();await page.getByRole('button',{name:'All Appointments',exact:true}).click();
 });
 await page.goto('http://127.0.0.1:55173/patient/schedule');
 await check('calendar previous next and today work',async()=>{await page.getByRole('button',{name:'Previous month'}).click();await page.getByRole('button',{name:'Next month'}).click();await page.getByRole('button',{name:'Today',exact:true}).click();});
 await check('reminder accurately discloses temporary behavior',async()=>{await page.getByRole('button',{name:'Add Reminder',exact:true}).first().click();await page.getByLabel('Reminder title').fill('Browser reminder');await page.getByRole('button',{name:'Save Reminder'}).click();await page.getByText('Reminder added for this visit.',{exact:false}).waitFor();});
 await page.goto('http://127.0.0.1:55173/patient/account');
 await check('patient profile edits persist',async()=>{await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Last name',{exact:true}).fill('Browser Audit');await page.getByRole('button',{name:'Save Changes'}).click();await page.getByText('Profile updated successfully.').waitFor();await page.reload();await page.getByRole('heading',{name:'patient Browser Audit'}).waitFor();});
 await page.goto('http://127.0.0.1:55173/patient/documents');
 await check('document upload reports OCR outage and preserves original',async()=>{
  await page.locator('input[type=file]').first().setInputFiles({name:'browser-audit.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')});
  await page.getByText('browser-audit.png',{exact:true}).first().waitFor();
  assert.ok(!(await page.locator('body').innerText()).includes('Amoxicillin'));
 });
 await page.screenshot({path:'/private/tmp/medikiosk-browser-audit/documents.png',fullPage:true});
 await page.goto('http://127.0.0.1:55173/patient/medical-id');
 await check('medical ID QR regeneration works',async()=>{await page.getByRole('button',{name:'Generate New QR'}).click();await page.getByText('QR expires in',{exact:false}).waitFor();});
 await page.goto('http://127.0.0.1:55173/patient/mail');
 await check('unfinished mailbox cannot pretend to send',async()=>assert.equal(await page.getByRole('button',{name:'Compose message'}).isDisabled(),true));
 await ctx.close();
 for(const role of ['nurse','admin','receptionist']){
  const staff=await browser.newContext();await staff.addInitScript(token=>localStorage.setItem('medikiosk_token',token),fixtures[role].token);const p=await staff.newPage();await p.goto('http://127.0.0.1:55173/receptionist/account');
  await check(`${role} does not expose nonworking patient edit`,async()=>{await p.getByRole('button',{name:'Edit',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Edit',exact:true}).isDisabled(),true);});await staff.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844}});await mobile.addInitScript(token=>localStorage.setItem('medikiosk_token',token),fixtures.patient.token);const mp=await mobile.newPage();await mp.goto('http://127.0.0.1:55173/patient/medical-id');await mp.getByRole('button',{name:'Generate New QR'}).waitFor();await mp.screenshot({path:'/private/tmp/medikiosk-browser-audit/medical-id-mobile.png',fullPage:true});await mobile.close();
 await check('no JavaScript exceptions during patient interactions',async()=>assert.deepEqual(errors,[]));
 console.log(`${checks.length} browser interaction checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close()});
