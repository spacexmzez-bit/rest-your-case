/* File name: extreme-sw.js — offline Extreme shell only; never caches case records, POSTs or API keys. */
const CACHE='ryc-extreme-foundation-v2-3';
const FILES=['extreme.html','extreme.css','extreme-terminal.js','extreme-store.js','extreme-client.js','extreme-history.js','extreme-browser-migration.js','extreme-archive.js','ryc-request.js','ryc-ar.js','ryc-i18n.js','manifest.json','icons/icon-192.png'];
const URLs=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);for(const url of URLs){const r=await fetch(url,{cache:'reload'});if(!r.ok)throw new Error('Extreme shell asset unavailable');await c.put(url,r);}await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('ryc-extreme-foundation-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);url.search='';url.hash='';if(!URLs.includes(url.href))return;e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(e.request);if(r.ok)await c.put(url.href,r.clone());return r;}catch(error){const saved=await c.match(url.href);if(saved)return saved;throw error;}})());});
