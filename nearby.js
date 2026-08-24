/**
 * nearby.js — "Find Nearby" feature for ATE
 *
 * Uses a standard Google Maps iframe embed — no API key required.
 * Works on all platforms (Netlify, Render, GitHub Pages, etc.)
 */

/* ============================================================
   STATE
   ============================================================ */
let nearbyFoodLabel       = '';
let userLat               = null;
let userLng               = null;
let locationFallbackTimer = null;

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('findNearbyBtn')?.addEventListener('click', onFindNearby);
  document.getElementById('nearbyClose')?.addEventListener('click', closeNearby);
});

/** Called from script.js when a result is shown */
function updateNearbyButton(foodName) {
  nearbyFoodLabel = foodName;
  const span = document.getElementById('nearbyFoodName');
  if (span) span.textContent = foodName;
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */
function onFindNearby() {
  showNearbySection();
  setStatus('Getting your location...');
  hideMap();

  const fallbackText = document.getElementById('locationFallbackText');
  if (fallbackText) fallbackText.hidden = true;

  if (!navigator.geolocation) {
    setStatus('❌ Your browser does not support location services.');
    return;
  }

  // Show fallback link after 3.5 seconds if GPS is slow
  clearTimeout(locationFallbackTimer);
  locationFallbackTimer = setTimeout(() => {
    const el = document.getElementById('locationFallbackText');
    if (el) el.hidden = false;
  }, 3500);

  navigator.geolocation.getCurrentPosition(
    onLocationSuccess,
    onLocationError,
    { timeout: 10000, maximumAge: 60000 }
  );
}

function onLocationSuccess(pos) {
  clearTimeout(locationFallbackTimer);
  const fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;

  userLat = pos.coords.latitude;
  userLng = pos.coords.longitude;

  loadGoogleMap(userLat, userLng, nearbyFoodLabel);
}

function onLocationError(err) {
  clearTimeout(locationFallbackTimer);
  const fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = false;

  const msg = {
    1: '🚫 Location access denied. Please allow location in your browser settings.',
    2: '📡 Location unavailable. Check your internet connection.',
    3: '⏱️ Location timed out. Try the manual search below.'
  };
  setStatus(msg[err.code] || '❌ Could not get your location.');
}

// Fallback: user manually triggers a food search without GPS
window.startManualSearch = function() {
  clearTimeout(locationFallbackTimer);
  const fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;

  const searchQuery = nearbyFoodLabel
    ? nearbyFoodLabel + ' restaurant near me'
    : 'restaurant near me';

  // No API key needed — standard Google Maps embed with ?output=embed
  const embedUrl = 'https://www.google.com/maps?q=' + encodeURIComponent(searchQuery) + '&output=embed';
  const fullUrl  = 'https://www.google.com/maps/search/' + encodeURIComponent(searchQuery);
  const wazeUrl  = 'https://waze.com/ul?q=' + encodeURIComponent(searchQuery) + '&navigate=yes';

  hideStatus();
  showMap(embedUrl, fullUrl, wazeUrl, 'Showing: ' + searchQuery);
};

/* ============================================================
   GOOGLE MAPS EMBED — NO API KEY NEEDED
   Uses the classic ?output=embed trick. Works forever, free.
   ============================================================ */
function loadGoogleMap(lat, lng, foodName) {
  setStatus('🗺️ Loading Google Maps...');

  const searchQuery = foodName ? foodName + ' restaurant' : 'restaurant';

  // Classic Google Maps embed — no API key, no billing, works on all platforms
  // Format: google.com/maps?q=SEARCH&ll=LAT,LNG&z=ZOOM&output=embed
  const embedUrl = 'https://www.google.com/maps?'
    + 'q=' + encodeURIComponent(searchQuery)
    + '&ll=' + lat + ',' + lng
    + '&z=15'
    + '&output=embed';

  // Full Google Maps link (opens the real app in a new tab)
  const fullUrl = 'https://www.google.com/maps/search/'
    + encodeURIComponent(searchQuery)
    + '/@' + lat + ',' + lng + ',15z';

  // Waze navigation link
  const wazeUrl = 'https://waze.com/ul?ll=' + lat + ',' + lng
    + '&navigate=yes'
    + '&q=' + encodeURIComponent(searchQuery);

  hideStatus();
  showMap(embedUrl, fullUrl, wazeUrl, 'Showing: ' + searchQuery + ' near you');
}

function showMap(embedUrl, fullUrl, wazeUrl, subtitle) {
  const iframe = document.getElementById('googleMap');
  iframe.src = embedUrl;
  iframe.style.display = 'block';
  iframe.style.height = '450px';

  const actions = document.getElementById('nearbyMapActions');
  if (actions) actions.style.display = 'flex';

  document.getElementById('gmapsFullBtn').href = fullUrl;
  document.getElementById('wazeFullBtn').href  = wazeUrl;

  const subtitleEl = document.getElementById('nearbySubtitle');
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

function hideMap() {
  const iframe = document.getElementById('googleMap');
  if (iframe) { iframe.src = 'about:blank'; iframe.style.display = 'none'; }
  const actions = document.getElementById('nearbyMapActions');
  if (actions) actions.style.display = 'none';
}

/* ============================================================
   UI STATE
   ============================================================ */
function showNearbySection() {
  const sec = document.getElementById('nearbySection');
  sec.hidden = false;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeNearby() {
  document.getElementById('nearbySection').hidden = true;
  hideMap();
  clearTimeout(locationFallbackTimer);
}

function setStatus(msg) {
  const statusEl = document.getElementById('nearbyStatus');
  statusEl.hidden = false;
  document.getElementById('nearbyStatusText').textContent = msg;

  const spinner = statusEl.querySelector('.nearby-spinner');
  if (spinner) {
    const isError = msg.startsWith('❌') || msg.startsWith('🚫') || msg.startsWith('⚠️') || msg.startsWith('⏱️');
    spinner.style.display = isError ? 'none' : 'block';
  }
}

function hideStatus() {
  document.getElementById('nearbyStatus').hidden = true;
}
