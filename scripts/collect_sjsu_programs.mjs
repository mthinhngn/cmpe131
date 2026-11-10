import {chromium} from 'file:///C:/Users/thinh/AppData/Local/npm-cache/_npx/2334a3ea0ef73d73/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const dir='data/sjsu/2026-2027/programs',links=JSON.parse(fs.readFileSync(dir+'/directory-raw.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/thinh/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'}),context=await browser.newContext(),page=await context.newPage();
await page.goto('https://catalog.sjsu.edu/content.php?catoid=23&navoid=8470',{waitUntil:'domcontentloaded'});await page.locator('a[href*="preview_program"]').first().waitFor();let index=0,done=0,failed=[];
async function worker(){const fallback=await context.newPage();while(index<links.length){const item=links[index++],id=new URL(item.url).searchParams.get('poid'),file=dir+'/sources/'+id+'.html';
if(fs.existsSync(file)){done++;continue}
try{let r=await context.request.get(item.url,{timeout:30000}),html=await r.text();
if(r.status()!==200||!html.includes('acalog-core')){await fallback.goto(item.url,{waitUntil:'domcontentloaded',timeout:30000});await fallback.locator('.block_content h1').first().waitFor({timeout:12000});html=await fallback.content()}
if(!html.includes('block_content'))throw Error('No program content');fs.writeFileSync(file,html);done++;if(done%40===0)console.log('Saved '+done+'/'+links.length)}
catch(e){failed.push({id,title:item.title,url:item.url,error:e.message.slice(0,100)});}
await new Promise(r=>setTimeout(r,150));
}await fallback.close()}
try{await Promise.all(Array.from({length:4},worker));fs.writeFileSync(dir+'/fetch-report.json',JSON.stringify({fetchedAt:new Date().toISOString(),total:links.length,saved:done,failed},null,2));console.log(JSON.stringify({total:links.length,saved:done,failed:failed.length}))}finally{await browser.close()}
