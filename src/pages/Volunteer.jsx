import React,{useEffect,useRef,useState} from 'react';
import {Paper,Group,Text,Title,Badge,Button,TextInput,Alert} from '@mantine/core';
import {IconQrcode,IconSearch,IconRefresh,IconSchool} from '@tabler/icons-react';
import QRScanner from '../components/QRScanner.jsx';
import SeatResult from '../components/SeatResult.jsx';
import {normalizedDigits} from '../lib/form-validation.js';

export default function Volunteer(){
 const [roll,setRoll]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[scanning,setScanning]=useState(false),[query,setQuery]=useState(null),[updated,setUpdated]=useState('');
 const active=useRef(null),input=useRef(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 async function lookup(next){
  active.current?.abort();const controller=new AbortController();active.current=controller;
  setScanning(false);setBusy(true);setError('');setResult(null);setUpdated('');setQuery(next);
  try{const path=next.token?'/api/seat/'+encodeURIComponent(next.token):'/api/volunteer/seat?roll='+encodeURIComponent(next.roll);
   const response=await fetch(path,{cache:'no-store',signal:controller.signal}),data=await response.json();
   if(!response.ok)throw Error(data.error||"Seat not found.");
   if(controller.signal.aborted)return;
   setResult(data);setRoll(data.roll);setUpdated(new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){if(e.name!=='AbortError')setError(e.message)}finally{if(!controller.signal.aborted)setBusy(false)}
 }
 function find(e){e.preventDefault();const value=normalizedDigits(roll);if(!/^[0-9]{1,30}$/.test(value)){active.current?.abort();setBusy(false);setResult(null);setQuery(null);setError("Enter a valid exam roll.");return}lookup({roll:value})}
 function reset(){active.current?.abort();setBusy(false);setScanning(false);setRoll('');setResult(null);setError('');setQuery(null);setUpdated('');input.current?.focus()}
 return <main className="volunteer-page">
  <div className="volunteer-brand"><Group gap="sm"><div className="volunteer-mark"><IconSchool size={22}/></div><Text fw={800}>Seat Desk</Text></Group><Badge color="teal" variant="light">Volunteer</Badge></div>
  <div className="volunteer-heading"><Title order={1}>Seat lookup</Title><Text c="dimmed" mt="xs">Scan an admit-card QR code or enter an exam roll.</Text></div>
  <Paper className="volunteer-search" p={{base:'lg',sm:'xl'}}>
   <Button fullWidth size="lg" leftSection={<IconQrcode size={24}/>} disabled={busy||scanning} onClick={()=>{setError('');setResult(null);setQuery(null);setScanning(true)}}>Scan QR code</Button>
   <div className="lookup-divider"><span>or search by roll</span></div>
   <form onSubmit={find} className="volunteer-form">
    <TextInput ref={input} label="Exam roll" aria-label="Exam roll" placeholder="Roll number" inputMode="numeric" autoComplete="off" maxLength={30} value={roll} onChange={e=>setRoll(e.target.value)} size="md" required/>
    <Button type="submit" size="md" loading={busy} disabled={scanning} leftSection={<IconSearch size={18}/>}>Find seat</Button>
   </form>
   {scanning&&<QRScanner onScan={token=>lookup({token})} onClose={()=>setScanning(false)}/>}
  </Paper>
  <div aria-live="polite" aria-busy={busy}>
   {busy&&<Text ta="center" mt="lg" c="dimmed" role="status">Loading latest seat information…</Text>}
   {error&&<Alert mt="lg" color="red" title="Seat not found" role="alert">{error}</Alert>}
   {result&&<SeatResult data={result}/>}
  </div>
  {(query||error)&&<Group justify="center" className="no-print" mt="lg"><Button variant="default" onClick={reset}>Next student</Button>{query&&<Button variant="subtle" leftSection={<IconRefresh size={16}/>} disabled={busy||scanning} onClick={()=>lookup(query)}>Refresh seat</Button>}</Group>}
  {updated&&<Text size="xs" ta="center" c="dimmed" mt="md">Last checked:{updated}</Text>}
 </main>
}
