import React from 'react';
import {Paper,Group,Text,Switch,ThemeIcon,useMantineColorScheme,useComputedColorScheme} from '@mantine/core';
import {IconSun,IconMoon} from '@tabler/icons-react';
export default function Appearance(){
 const {setColorScheme}=useMantineColorScheme();
 const dark=useComputedColorScheme('light')==='dark';
 return <Paper className="panel appearance-panel">
  <div className="appearance-title"><h2>Appearance</h2><Text size="sm" c="dimmed">Choose how Seat Desk looks on this device.</Text></div>
  <Group justify="space-between" wrap="nowrap" className="appearance-control">
   <Group wrap="nowrap" gap="md"><ThemeIcon size={44} radius="md" variant="light" color={dark?'violet':'orange'}>{dark?<IconMoon size={23}/>:<IconSun size={23}/>}</ThemeIcon><div><Text fw={650}>{dark?'Dark mode':'Light mode'}</Text><Text size="xs" c="dimmed" mt={3}>{dark?'A softer view for low-light environments.':'A bright, clean workspace.'}</Text></div></Group>
   <Switch size="xl" color="teal" checked={dark} onChange={event=>setColorScheme(event.currentTarget.checked?'dark':'light')} aria-label="Dark mode" onLabel={<IconMoon size={18}/>} offLabel={<IconSun size={18}/>} thumbIcon={dark?<IconMoon size={13} color="#148c6e"/>:<IconSun size={13} color="#c98822"/>}/>
  </Group>
 </Paper>
}
