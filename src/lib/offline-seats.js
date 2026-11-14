// Offline pack storage on the volunteer's phone (IndexedDB).
// localStorage is too small and synchronous for ~1,500 records; IndexedDB
// is the right store. Every load re-verifies the checksum, so a corrupt or
// tampered pack is discarded instead of showing a wrong seat.
import {verifyOfflinePack,offlineSeatResult,offlineRollForToken} from './offline-pack.js';
export {verifyOfflinePack,offlineSeatResult,offlineRollForToken};

const DB='science-quest-offline',STORE='packs',KEY='current';

function openDb(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Could not open offline storage.'));
 });
}

function request(req){
 return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Offline storage failed.'))});
}

async function withStore(mode,fn){
 if(typeof indexedDB==='undefined')throw Error('Offline storage is not available in this browser.');
 const db=await openDb();
 try{const result=await fn(db.transaction(STORE,mode).objectStore(STORE));db.close();return result}
 catch(e){try{db.close()}catch{}throw e}
}

// Save a downloaded pack. Verifies the checksum first — a bad pack is
// never stored. Returns the stored record (pack + downloadedAt).
export async function savePack(pack){
 if(!(await verifyOfflinePack(pack)))throw Error('This offline pack failed its integrity check. Download it again.');
 const record={...pack,downloadedAt:new Date().toISOString()};
 await withStore('readwrite',store=>request(store.put(record,KEY)));
 return record;
}

// Load the saved pack, or null when there is none, storage is unavailable,
// or the stored pack fails its checksum (corrupt packs are cleared).
export async function loadPack(){
 try{
  const record=await withStore('readonly',store=>request(store.get(KEY)));
  if(!record)return null;
  if(!(await verifyOfflinePack(record))){await clearPack().catch(()=>{});return null}
  return record;
 }catch{return null}
}

export async function clearPack(){
 try{await withStore('readwrite',store=>request(store.delete(KEY)))}catch{}
}

// Small summary for the badge: version, size, exam date, download time.
export async function packMeta(){
 const pack=await loadPack();
 return pack?{version:pack.version,totalCount:pack.totalCount,examDate:pack.examDate,downloadedAt:pack.downloadedAt}:null;
}
