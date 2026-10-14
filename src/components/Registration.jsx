import React,{useEffect,useState} from 'react';
import {Paper,Group,Text,Badge,Switch,Button,TextInput,Alert} from '@mantine/core';
import {IconClock} from '@tabler/icons-react';
import {registrationStatus,fromDhakaInput,toDhakaInput} from '../lib/operations.js';
import {useExam} from '../context.jsx';
export function useRegistrationClock(exam={},server={}){
 const [now,setNow]=useState(()=>server.serverNow||Date.now());
 useEffect(()=>{const offset=Number.isFinite(server.serverNow)?server.serverNow-Date.now():0;setNow(Date.now()+offset);const timer=setInterval(()=>setNow(Date.now()+offset),1000);return()=>clearInterval(timer)},[server.serverNow]);
 return {...registrationStatus(exam,now),now};
}
export function RegistrationCountdown({status}){
 const milliseconds=status.deadline?Math.max(0,Date.parse(status.deadline)-status.now):0,seconds=Math.floor(milliseconds/1000);
 const parts=[['Days',Math.floor(seconds/86400)],['Hours',Math.floor(seconds/3600)%24],['Minutes',Math.floor(seconds/60)%60],['Seconds',seconds%60]];
 return <section className={'registration-banner '+(!status.open?'is-closed':'')} aria-label="Registration deadline"><div className="registration-banner-head"><Group gap="sm"><IconClock size={20}/><Text fw={700}>Registration {status.open?'open':'closed'}</Text></Group><Badge variant="light" color={status.open?'teal':'orange'}>{status.open?'Accepting students':'Closed'}</Badge></div>{status.deadline&&status.open?<><div className="countdown-grid" aria-label="Time remaining">{parts.map(([label,n])=><div key={label}><strong>{String(n).padStart(2,'0')}</strong><span>{label}</span></div>)}</div><Text size="xs" mt="md">Closes {new Date(status.deadline).toLocaleString('en-GB',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'})} · Bangladesh time</Text></>:<Text size="sm" mt="sm">{status.open?'Register students while submissions are open.':status.reason==='deadline'?'The registration deadline has passed.':'New registration is currently closed.'} {!status.open&&'Existing records remain available.'}</Text>}</section>
}
export default function RegistrationSettings(){
 const {state,store,notify}=useExam();const [deadline,setDeadline]=useState(()=>toDhakaInput(state.exam.registrationDeadline)),[closed,setClosed]=useState(!!state.exam.registrationClosed),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setDeadline(toDhakaInput(state.exam.registrationDeadline));setClosed(!!state.exam.registrationClosed)},[state.exam.registrationDeadline,state.exam.registrationClosed]);
 async function save(e){e.preventDefault();setSaving(true);setError('');try{const registrationDeadline=fromDhakaInput(deadline);store.commit(next=>{next.exam.registrationDeadline=registrationDeadline;next.exam.registrationClosed=closed});await store.flush();await store.refresh();notify('Registration controls saved')}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <Paper className="panel"><h2>Registration controls</h2><Text size="sm" c="dimmed" mb="lg">Close new school registrations automatically at a deadline, or pause them now. Existing submissions can still be reviewed and corrected.</Text>{error&&<Alert color="red" mb="md" role="alert">{error}</Alert>}<form onSubmit={save} className="registration-settings-form"><TextInput label="Registration deadline · Bangladesh time (UTC+06:00)" type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)} description="Leave empty for no deadline."/><Switch label="Close new registration now" checked={closed} onChange={e=>setClosed(e.currentTarget.checked)} size="md"/><Group><Button type="submit" loading={saving}>Save registration settings</Button><Button variant="default" type="button" onClick={()=>setDeadline('')}>Clear deadline</Button></Group></form><Text size="xs" c="dimmed" mt="md">To reopen after expiry, extend or clear the deadline and turn off manual closure. Save to apply.</Text></Paper>
}
