import React,{useEffect,useRef,useState} from 'react';
import {Paper,Group,Text,Title,Badge,Button,TextInput,Alert} from '@mantine/core';
import {IconQrcode,IconSearch,IconRefresh,IconSchool,IconDownload} from '@tabler/icons-react';
import QRScanner from '../components/QRScanner.jsx';
import SeatResult from '../components/SeatResult.jsx';
import {normalizedDigits} from '../lib/form-validation.js';
import {savePack,loadPack,clearPack,offlineSeatResult,offlineRollForToken} from '../lib/offline-seats.js';

const timeNow=()=>new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const timeOf=iso=>{try{return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}catch{return ''}};

export default function Volunteer(){
 const [roll,setRoll]=useState(''),[result,setResult]=useState(null),[source,setSource]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[scanning,setScanning]=useState(false),[query,setQuery]=useState(null),[updated,setUpdated]=useState('');
 const [pack,setPack]=useState(null),[packBusy,setPackBusy]=useState(false),[packError,setPackError]=useState(''),[packNotice,setPackNotice]=useState(''),[stale,setStale]=useState(false),[online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine!==false);
 const active=useRef(null),input=useRef(null),packRef=useRef(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 // Load any saved offline pack. If one exists and we are online, check
 // whether the live seating version moved on — a changed plan makes the
 // saved pack stale. No fetch happens when there is no pack, so the page
 // never phones home just by opening it.
 useEffect(()=>{
  let alive=true;
  loadPack().then(saved=>{
   if(!alive||!saved)return;
   packRef.current=saved;
   setPack({version:saved.version,totalCount:saved.totalCount,examDate:saved.examDate,downloadedAt:saved.downloadedAt});
   fetch('/api/volunteer/offline-pack?version=1',{cache:'no-store'}).then(r=>r.json()).then(info=>{if(alive&&info.version&&info.version!==saved.version)setStale(true)}).catch(()=>{});
  }).catch(()=>{});
  const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);
  window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);
  return ()=>{alive=false;window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)};
 },[]);
 async function lookupOffline(next){
  const saved=packRef.current||await loadPack();
  if(!saved)return null;
  packRef.current=saved;
  let rollNumber=next.roll;
  if(next.token){rollNumber=await offlineRollForToken(saved,next.token);if(!rollNumber)return null}
  return offlineSeatResult(saved,rollNumber);
 }
 async function lookup(next){
  active.current?.abort();const controller=new AbortController();active.current=controller;
  setScanning(false);setBusy(true);setError('');setResult(null);setSource('');setUpdated('');setQuery(next);
  let live=null,liveError=null;
  try{
   const path=next.token?'/api/seat/'+encodeURIComponent(next.token):'/api/volunteer/seat?roll='+encodeURIComponent(next.roll);
   const response=await fetch(path,{cache:'no-store',signal:controller.signal}),data=await response.json();
   if(response.ok)live=data;
   else if(response.status>=500)liveError=null;
   else liveError=data.error||"Seat not found.";
  }catch(e){if(e.name==='AbortError')return;liveError=null}
  if(controller.signal.aborted)return;
  if(live){setResult(live);setSource('live');setRoll(live.roll);setUpdated(timeNow());setBusy(false);return}
  if(liveError){setError(liveError);setBusy(false);return}
  // Live lookup unreachable (offline, or the server errored): fall back to
  // the downloaded pack. QR and roll both work offline — QR resolves to a
  // roll through the pack's token-hash map first.
  let offline=null;
  try{offline=await lookupOffline(next)}catch{offline=null}
  if(controller.signal.aborted)return;
  if(offline){setResult(offline);setSource('offline');setRoll(offline.roll);setUpdated(timeNow())}
  else setError("You appear to be offline, and this roll is not in the downloaded offline pack. Download the pack while online, or check the roll and try again.");
  setBusy(false);
 }
 function find(e){e.preventDefault();const value=normalizedDigits(roll);if(!/^[0-9]{1,30}$/.test(value)){active.current?.abort();setBusy(false);setResult(null);setQuery(null);setError("Enter a valid exam roll.");return}lookup({roll:value})}
 function reset(){active.current?.abort();setBusy(false);setScanning(false);setRoll('');setResult(null);setSource('');setError('');setQuery(null);setUpdated('');input.current?.focus()}
 async function downloadPack(){
  if(packBusy)return;
  if(pack&&!confirm("Replace the existing offline pack on this phone?"))return;
  setPackBusy(true);setPackError('');setPackNotice('');
  try{
   const response=await fetch('/api/volunteer/offline-pack',{cache:'no-store'}),data=await response.json();
   if(!response.ok)throw Error(data.error||"Could not download the offline pack.");
   const saved=await savePack(data);
   packRef.current=saved;setPack({version:saved.version,totalCount:saved.totalCount,examDate:saved.examDate,downloadedAt:saved.downloadedAt});setStale(false);
   setPackNotice(`Offline ready • ${saved.totalCount} students • v${saved.version.slice(0,8)}`);
  }catch(e){setPackError(e.message)}
  finally{setPackBusy(false)}
 }
 async function clearOffline(){await clearPack();packRef.current=null;setPack(null);setStale(false);setPackNotice('Offline pack cleared.')}
 return <main className="volunteer-page">
  <div className="volunteer-brand"><Group gap="sm"><div className="volunteer-mark"><IconSchool size={22}/></div><Text fw={800}>Seat Desk</Text></Group><Badge color="teal" variant="light">Volunteer</Badge></div>
  <div className="volunteer-heading"><Title order={1}>Seat lookup</Title><Text c="dimmed" mt="xs">Scan an admit-card QR code or enter an exam roll.</Text></div>
  {stale&&<Alert mt="lg" color="orange" title="Seat plan changed">The seating plan changed after this offline pack was downloaded. Download the new pack before the exam.</Alert>}
  {!online&&<Alert mt="lg" color="blue" title="You are offline">Live lookup is unavailable. Results below come from the downloaded offline pack, if any.</Alert>}
  <Paper className="volunteer-search" p={{base:'lg',sm:'xl'}}>
   <Button fullWidth size="lg" leftSection={<IconQrcode size={24}/>} disabled={busy||scanning} onClick={()=>{setError('');setResult(null);setQuery(null);setScanning(true)}}>Scan QR code</Button>
   <div className="lookup-divider"><span>or search by roll</span></div>
   <form onSubmit={find} className="volunteer-form">
    <TextInput ref={input} label="Exam roll" aria-label="Exam roll" placeholder="Roll number" inputMode="numeric" autoComplete="off" maxLength={30} value={roll} onChange={e=>setRoll(e.target.value)} size="md" required/>
    <Button type="submit" size="md" loading={busy} disabled={scanning} leftSection={<IconSearch size={18}/>}>Find seat</Button>
   </form>
   {scanning&&<QRScanner onScan={token=>lookup({token})} onClose={()=>setScanning(false)}/>}
   <div className="offline-pack" style={{marginTop:18}}>
    {pack?<Text size="sm">Offline ready • {pack.totalCount} students • Synced: {timeOf(pack.downloadedAt)} • v{pack.version.slice(0,8)}</Text>:<Text size="sm" c="dimmed">No offline pack on this phone yet. Download it while online, after seating is locked — then roll and QR lookup keep working without internet.</Text>}
    <Group mt="xs"><Button variant="light" size="sm" loading={packBusy} leftSection={<IconDownload size={16}/>} onClick={downloadPack}>Download offline pack</Button>{pack&&<Button variant="subtle" size="sm" onClick={clearOffline}>Clear offline pack</Button>}</Group>
    {packNotice&&<Text size="sm" c="teal" mt="xs">{packNotice}</Text>}
    {packError&&<Text size="sm" c="red" mt="xs">{packError}</Text>}
   </div>
  </Paper>
  <div aria-live="polite" aria-busy={busy}>
   {busy&&<Text ta="center" mt="lg" c="dimmed" role="status">Loading latest seat information…</Text>}
   {error&&<Alert mt="lg" color="red" title="Seat not found" role="alert">{error}</Alert>}
   {result&&<><Group justify="center" mt="lg"><Badge color={source==='offline'?'orange':'teal'} variant="light">{source==='offline'?`Offline — Synced ${pack?timeOf(pack.downloadedAt):''}`:'Live'}</Badge></Group><SeatResult data={result}/></>}
  </div>
  {(query||error)&&<Group justify="center" className="no-print" mt="lg"><Button variant="default" onClick={reset}>Next student</Button>{query&&<Button variant="subtle" leftSection={<IconRefresh size={16}/>} disabled={busy||scanning||!online} title={online?'':'You are offline — live refresh is unavailable'} onClick={()=>lookup(query)}>Refresh seat</Button>}</Group>}
  {updated&&<Text size="xs" ta="center" c="dimmed" mt="md">Last checked:{updated}</Text>}
 </main>
}
