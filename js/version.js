// ======= GAME VERSION =======
// Update GAME_VERSION with every meaningful change.
// Format: MAJOR.MINOR.PATCH
//   MAJOR — breaking save incompatibility or complete overhaul
//   MINOR — new feature or significant addition
//   PATCH — bug fix, tweak, or small improvement
//
// Changelog:
//   0.6.2 — Ground bags: dropped items appear as bags; right-click to pick up
//   0.6.1 — Dev console (` key): give/gold/heal/tp/setskill/xp/flag commands
//   0.6.0 — Save migration system; Service Worker offline support + auto-update banner
//   0.5.0 — PeerJS P2P co-op (up to 4 players), in-game session start/stop
//   0.4.0 — Homestead feature: Old Bertram quest, farming, crop rendering
//   0.3.0 — World map (M key), crop respawn, dungeon loot, inn sleep restriction
//   0.2.0 — Monolithic HTML split into organised file structure; bug fixes
//   0.1.0 — Initial release
const GAME_VERSION = '0.6.2';

// ── Update checker ────────────────────────────────────────────────────────────
function _cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for(let i = 0; i < 3; i++) {
    if((pa[i]||0) > (pb[i]||0)) return 1;
    if((pa[i]||0) < (pb[i]||0)) return -1;
  }
  return 0;
}

// Returns the latest version string if a newer version exists on GitHub, else null.
async function checkForUpdate() {
  try {
    const res = await fetch(
      'https://raw.githubusercontent.com/GangstaPichu/Grimstone/main/js/version.js',
      { cache: 'no-store' }
    );
    if(!res.ok) return null;
    const text = await res.text();
    const m = text.match(/const GAME_VERSION = '([^']+)'/);
    if(!m) return null;
    return _cmpVer(m[1], GAME_VERSION) > 0 ? m[1] : null;
  } catch { return null; }
}

// Show the update banner. latestVer can be a semver string or any short message.
function showUpdateBanner(latestVer) {
  const el = document.getElementById('update-banner');
  const txt = document.getElementById('update-banner-text');
  if(!el || !txt) return;
  const msg = latestVer.includes('.')
    ? `v${latestVer} is available — you are on v${GAME_VERSION}`
    : latestVer; // e.g. "new version ready" from SW detection
  txt.textContent = msg;
  el.style.display = 'flex';
}

// Called when the user clicks "Update Now".
function applyUpdate() {
  // Local file — can't auto-update, send to GitHub releases
  if(window.location.protocol === 'file:') {
    window.open('https://github.com/GangstaPichu/Grimstone/releases', '_blank');
    return;
  }
  // If a new Service Worker is waiting, tell it to take over (triggers controllerchange reload)
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if(reg?.waiting) {
        reg.waiting.postMessage('skipWaiting');
      } else {
        window.location.reload(true);
      }
    }).catch(() => window.location.reload(true));
  } else {
    window.location.reload(true);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
