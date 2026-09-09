const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const fixtures=JSON.parse(fs.readFileSync('/private/tmp/medikiosk-audit-fixtures.json'));
 const results=[];
 const routes={patient:['dashboard','medical-id','history','documents','appointments','doctor','schedule','account','mail','teleconsult','assessment'],doctor:['dashboard','appointments','patients','team','doctor','account','departments','mail','teleconsult'],receptionist:['dashboard','appointments','patients','doctor','account','departments','mail'],nurse:['dashboard','appointments','patients','account'],admin:['dashboard','account']};
 for(const [role,pages] of Object.entries(routes)){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(token=>localStorage.setItem('medikiosk_token',token),fixtures[role].token);
  const page=await ctx.newPage();let errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))errors.push(`${r.status()} ${r.url()}`);});
  for(const route of pages){
   errors=[];const portal=['nurse','admin'].includes(role)?'receptionist':role;
   await page.goto(`http://127.0.0.1:55173/${portal}/${route}`);await page.waitForTimeout(700);
   results.push({role,route,url:page.url(),errors:[...errors],buttons:await page.locator('button').allTextContents(),body:(await page.locator('body').innerText()).slice(0,3000)});
  }
  await ctx.close();
 }
 fs.writeFileSync('/private/tmp/medikiosk-browser-audit/routes.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(({role,route,url,errors,body})=>({role,route,url,errors,body:body.slice(-300)})),null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
