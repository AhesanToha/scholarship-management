import React from 'react';import {createRoot} from 'react-dom/client';import App from './App.jsx';import '@mantine/core/styles.css';import './styles.css';import './scholarship.css';
createRoot(document.getElementById('root')).render(<App/>);

// Offline shell: once any page is opened online, the service worker saves
// the app shell on the device, so /volunteer opens with no network at all
// and the downloaded offline pack does the lookup. Registration is skipped
// where service workers are unavailable (plain HTTP, old browsers).
if(typeof navigator!=='undefined'&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

import './admit.css';
