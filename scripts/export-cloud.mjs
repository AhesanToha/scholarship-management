// Prepare local records for a NEW Cloudflare R2 bucket. This script never uploads.
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const bucket=process.argv[2]||'scholarship-seat-desk-data';
if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Enter a valid R2 bucket name.');
const source=path.resolve('.local-data/storage.json');
if(!existsSync(source))throw Error('No .local-data/storage.json found. Run this from your existing project folder.');
const records=JSON.parse(readFileSync(source,'utf8')),output=path.resolve('.cloud-export');mkdirSync(output,{recursive:true});
const quote=value=>"'"+value.replaceAll("'","''")+"'";
let commands=["$ErrorActionPreference = 'Stop'",'# Run once against your NEW, empty R2 bucket. Existing remote objects will be replaced.'];let count=0;
for(const [key,record] of Object.entries(records)){
 if(!/^scholarship\/(?:state\.json|auth\/[a-zA-Z0-9_-]+\.json|photos\/[a-zA-Z0-9_-]+)$/.test(key))continue;
 if(typeof record.value!=='string')throw Error('Invalid local record: '+key);
 JSON.parse(record.value);
 const file=path.join(output,String(++count).padStart(5,'0')+'.json');writeFileSync(file,record.value);
 commands.push('& npx.cmd --yes wrangler@latest r2 object put '+quote(bucket+'/'+key)+' --file '+quote(file)+' --remote');
 commands.push("if ($LASTEXITCODE -ne 0) { throw 'Upload failed. Stop and check the error.' }");
}
if(!count)throw Error('No state, school accounts or photos found.');
writeFileSync(path.join(output,'UPLOAD_TO_R2.ps1'),commands.join('\r\n')+'\r\n');
console.log('Prepared '+count+' records in .cloud-export. Keep this directory private.');
console.log('Uploads have NOT run. Follow DEPLOY_CLOUDFLARE.md before using UPLOAD_TO_R2.ps1.');
