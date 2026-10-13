import http from 'node:http';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const entry=path.join(root,'dist/server/index.js');
if(!existsSync(entry)){console.error('Run npm run build first.');process.exit(1)}
const {default:worker}=await import(pathToFileURL(entry).href);
const directory=process.env.SEAT_DESK_DATA_DIR||path.join(root,'.local-data');mkdirSync(directory,{recursive:true});
const file=path.join(directory,'storage.json');
const records=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
const persist=()=>{writeFileSync(file+'.tmp',JSON.stringify(records));renameSync(file+'.tmp',file)};
const BUCKET={
 async get(key){const item=records[key];return item?{etag:item.etag,json:async()=>JSON.parse(item.value)}:null},
 async head(key){return records[key]?{etag:records[key].etag}:null},
 async put(key,value,options={}){const old=records[key];if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=createHash('sha256').update(value+Date.now()+Math.random()).digest('hex');records[key]={value,etag};persist();return {etag}},
 async delete(key){delete records[key];persist()}
};
const port=Number(process.env.SEAT_DESK_PORT||3000);
const server=http.createServer(async(incoming,outgoing)=>{try{
 const chunks=[];let size=0;for await(const chunk of incoming){size+=chunk.length;if(size>8000000){outgoing.writeHead(413);outgoing.end('Request too large');return}chunks.push(chunk)}
 const url='http://localhost:'+port+incoming.url;
 const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value)headers.set(key,Array.isArray(value)?value.join(', '):value);
 const request=new Request(url,{method:incoming.method,headers,...(!['GET','HEAD'].includes(incoming.method)?{body:Buffer.concat(chunks)}:{})});
 const response=await worker.fetch(request,{BUCKET,TESTING_MODE:'true',ADMIN_EMAIL:'local-test@example.org'});
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
 }catch{outgoing.writeHead(500);outgoing.end('Local server error. Run npm run build and restart.')}
});
server.listen(port,'127.0.0.1',()=>{console.log('Seat Desk local test: http://localhost:'+port+'/dashboard');console.log('Volunteer desk: http://localhost:'+port+'/volunteer');console.log('Demo mode. Local data is saved in .local-data; live Site data is not loaded.');});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 3000 is busy. Close the previous server, or set SEAT_DESK_PORT.':error.message);process.exit(1)});
