// ======= GRIMSTONE SERVICE WORKER =======
// Update SW_CACHE with every release — changing this string triggers the
// browser's SW update flow and shows the in-game "Update Available" banner.
const SW_CACHE = 'grimstone-0.6.2';

const GAME_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/version.js',
  './js/particles.js',
  './js/character.js',
  './js/save-load.js',
  './js/world.js',
  './js/zones.js',
  './js/npcs.js',
  './js/quests.js',
  './js/render.js',
  './js/ui.js',
  './js/input.js',
  './js/activities.js',
  './js/effects.js',
  './js/multiplayer.js',
  './js/devconsole.js',
];

// Install: cache all game assets, then immediately become active
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SW_CACHE)
      .then(c => c.addAll(GAME_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete any old-version caches, then claim all open clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SW_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for game files so updates always reach the player.
// Falls back to cached copy when offline.
self.addEventListener('fetch', e => {
  // Let CDN requests (Tone.js, PeerJS) pass through without caching
  if(!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res.ok) {
          const clone = res.clone();
          caches.open(SW_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Message: allow the page to trigger a SW swap (sent by applyUpdate())
self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
});
