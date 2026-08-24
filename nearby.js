/**
 * nearby.js - Find Nearby feature for ATE
 * Beautiful Leaflet + OpenStreetMap map with custom markers
 * Uses corsproxy.io to bypass Overpass CORS/406 blocks on live sites
 */

let leafletMap            = null;
let nearbyFoodLabel       = '';
let nearbyFoodId          = null;
let userLat               = null;
let userLng               = null;
let activeMarkers         = {};
let locationFallbackTimer = null;

const FOOD_MATCH_MAP = {
  'Nasi Lemak':        { cuisines: ['malay','malaysian','halal'],              keywords: ['nasi','warung','kopitiam','mamak','kedai makan','coconut rice'], exclude: ['coffee','bakery','pizza','sushi','cafe','kfc','mcd','subway'] },
  'Nasi Ayam':         { cuisines: ['malay','malaysian','chinese'],            keywords: ['nasi','chicken rice','ayam','hainanese','kedai'],                exclude: ['coffee','bakery','pizza','sushi'] },
  'Ayam Penyet':       { cuisines: ['indonesian','malay'],                     keywords: ['penyet','ayam','indonesian','warung','nasi'],                    exclude: ['coffee','bakery','pizza','sushi'] },
  'Nasi Goreng':       { cuisines: ['malay','malaysian','indonesian','halal'], keywords: ['nasi','warung','mamak','kopitiam','kedai makan','goreng'],       exclude: ['coffee','bakery','sushi','zus','starbucks','coffee bean'] },
  'Chicken Rice':      { cuisines: ['chinese','hainanese'],                    keywords: ['chicken rice','hainanese','nasi ayam','kopitiam'],               exclude: ['coffee','bakery','pizza'] },
  'Mee Goreng':        { cuisines: ['malay','malaysian','halal'],              keywords: ['mee','mamak','warung','noodle','goreng'],                        exclude: ['coffee','bakery','pizza','sushi'] },
  'Maggi Goreng':      { cuisines: ['malay','malaysian','halal'],              keywords: ['mamak','maggi','warung','24'],                                   exclude: ['coffee','bakery','sushi'] },
  'Laksa':             { cuisines: ['malaysian','malay','peranakan'],          keywords: ['laksa','kopitiam','hawker','warung'],                            exclude: ['coffee','bakery','pizza','sushi'] },
  'Asam Laksa':        { cuisines: ['malaysian','malay','peranakan'],          keywords: ['laksa','asam','kopitiam','hawker','penang'],                     exclude: ['coffee','bakery'] },
  'Ramen':             { cuisines: ['japanese','ramen'],                       keywords: ['ramen','japanese','nippon','menya'],                             exclude: ['malay','indian','mamak'] },
  'Tom Yum':           { cuisines: ['thai'],                                   keywords: ['thai','tom yum','tomyum','tomyam','thailand'],                   exclude: ['coffee','bakery','sushi'] },
  'Burger':            { cuisines: ['burger','american','fast_food'],          keywords: ['burger','grill','bistro','bun','patty','myburger','ramly'],      exclude: ['sushi','ramen','nasi','mee'] },
  'Pizza':             { cuisines: ['pizza','italian'],                        keywords: ['pizza','pizzeria','domino','papa john','italian'],               exclude: ['sushi','ramen','nasi'] },
  'Pasta':             { cuisines: ['italian'],                                keywords: ['pasta','italian','bistro','spaghetti','lasagna'],                exclude: ['sushi','ramen','nasi','mamak'] },
  'Chicken Chop':      { cuisines: ['western'],                                keywords: ['western','chicken chop','grill','steak','chop'],                 exclude: ['sushi','ramen','nasi'] },
  'Fish and Chips':    { cuisines: ['british','fish_and_chips'],               keywords: ['fish','chips','british','fish & chips'],                        exclude: ['sushi','ramen','nasi','mamak'] },
  'Sushi':             { cuisines: ['japanese','sushi'],                       keywords: ['sushi','japanese','sashimi','nippon','ichiban','sakae'],         exclude: ['malay','indian','mamak','western'] },
  'Takoyaki':          { cuisines: ['japanese'],                               keywords: ['takoyaki','japanese','octopus','teppanyaki'],                    exclude: ['malay','indian','mamak'] },
  'Satay':             { cuisines: ['malay','malaysian'],                      keywords: ['satay','satey','warung','hawker','bbq'],                         exclude: ['coffee','bakery','pizza','sushi'] },
  'Roti Canai':        { cuisines: ['indian','mamak','halal'],                 keywords: ['roti','mamak','indian','kopitiam','canai','paratha'],            exclude: ['coffee','bakery','pizza','sushi','burger'] },
  'Salted Egg Chicken':{ cuisines: ['chinese','malaysian'],                    keywords: ['salted egg','chinese','fusion','kopitiam'],                      exclude: ['coffee','bakery','pizza'] },
  'Cendol':            { cuisines: ['dessert','malaysian'],                    keywords: ['cendol','dessert','hawker','kopitiam','ais'],                    exclude: ['burger','pizza','sushi'] },
  'Ice Cream':         { cuisines: ['ice_cream','dessert'],                    keywords: ['ice cream','gelato','dessert','creamery','baskin','dairy'],      exclude: ['burger','pizza','nasi','ramen'] },
  'Waffle':            { cuisines: ['dessert','cafe'],                         keywords: ['waffle','cafe','dessert','pancake'],                             exclude: ['burger','nasi','ramen','mamak'] },
};

const AMENITY_TYPES = ['restaurant','fast_food','cafe','food_court'];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('findNearbyBtn')?.addEventListener('click', onFindNearby);
  document.getElementById('nearbyClose')?.addEventListener('click', closeNearby);
  document.getElementById('radiusSelect')?.addEventListener('change', () => {
    if (userLat !== null && userLng !== null) {
      const r = getSelectedRadius();
      setStatus('Searching within ' + radiusLabel(r) + '...');
      hideMapAndList();
      fetchNearbyRestaurants(userLat, userLng, r);
    }
  });
});

function updateNearbyButton(foodName) {
  nearbyFoodLabel = foodName;
  const span = document.getElementById('nearbyFoodName');
  if (span) span.textContent = foodName;
}

function getSelectedRadius() {
  const sel = document.getElementById('radiusSelect');
  return sel ? parseInt(sel.value, 10) : 2000;
}

function radiusLabel(m) { return m >= 1000 ? (m/1000) + ' km' : m + ' m'; }

function getZoomForRadius(r) {
  if (r <= 1000) return 15;
  if (r <= 2000) return 14;
  if (r <= 5000) return 12;
  if (r <= 10000) return 11;
  return 10;
}

function onFindNearby() {
  showNearbySection();
  setStatus('Getting your location...');
  hideMapAndList();
  var fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;
  if (!navigator.geolocation) { setStatus('Your browser does not support location services.'); return; }
  clearTimeout(locationFallbackTimer);
  locationFallbackTimer = setTimeout(function() {
    var el = document.getElementById('locationFallbackText');
    if (el) el.hidden = false;
  }, 3500);
  navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, { timeout: 10000, maximumAge: 60000 });
}

function onLocationSuccess(pos) {
  clearTimeout(locationFallbackTimer);
  var fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;
  userLat = pos.coords.latitude;
  userLng = pos.coords.longitude;
  var r = getSelectedRadius();
  setStatus('Searching for ' + (nearbyFoodLabel || 'food') + ' within ' + radiusLabel(r) + '...');
  document.getElementById('nearbySubtitle').textContent = 'Filtering by food type within ' + radiusLabel(r);
  fetchNearbyRestaurants(userLat, userLng, r);
}

function onLocationError(err) {
  clearTimeout(locationFallbackTimer);
  var fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = false;
  var msg = { 1: 'Location denied. Please allow location and try again.', 2: 'Location unavailable.', 3: 'Location timed out. Try the manual option below.' };
  setStatus(msg[err.code] || 'Could not get your location.');
}

window.startManualSearch = function() {
  clearTimeout(locationFallbackTimer);
  var fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;
  var q = nearbyFoodLabel ? nearbyFoodLabel + ' restaurant near me' : 'restaurant near me';
  window.open('https://www.google.com/maps/search/' + encodeURIComponent(q), '_blank');
};

function fetchNearbyRestaurants(lat, lng, radius) {
  radius = radius || getSelectedRadius();
  var amenityFilter = AMENITY_TYPES.map(function(a) {
    return 'node["amenity"="' + a + '"](around:' + radius + ',' + lat + ',' + lng + ');';
  }).join('\n  ');
  var query = '[out:json][timeout:25];\n(\n  ' + amenityFilter + '\n);\nout body;';

  var isLocal = ['localhost','127.0.0.1',''].indexOf(window.location.hostname) >= 0
             || window.location.protocol === 'file:';

  // Build Overpass GET URLs (query embedded as ?data= parameter).
  // GET requests work with any CORS proxy — no POST needed.
  var overpassServers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ];

  var endpoints;
  if (isLocal) {
    // On localhost: hit Overpass directly (no CORS issue)
    endpoints = overpassServers.map(function(s) {
      return { url: s + '?data=' + encodeURIComponent(query), method: 'GET' };
    });
  } else {
    // On live sites: route through free CORS proxies.
    // allorigins.win is very reliable for GET requests.
    var allorigins = 'https://api.allorigins.win/raw?url=';
    var corsproxy  = 'https://corsproxy.io/?url=';
    endpoints = [
      // Primary: allorigins.win (most reliable for GET)
      { url: allorigins + encodeURIComponent(overpassServers[0] + '?data=' + encodeURIComponent(query)), method: 'GET' },
      { url: allorigins + encodeURIComponent(overpassServers[1] + '?data=' + encodeURIComponent(query)), method: 'GET' },
      // Backup: corsproxy.io
      { url: corsproxy + encodeURIComponent(overpassServers[0] + '?data=' + encodeURIComponent(query)), method: 'GET' },
      // Last resort: direct (may work if browser allows it)
      { url: overpassServers[0] + '?data=' + encodeURIComponent(query), method: 'GET' }
    ];
  }

  var attempt = 0;

  function tryFetch() {
    var ep = endpoints[attempt];
    fetch(ep.url, { method: ep.method })
      .then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function(data) { renderNearbyResults(data.elements || [], lat, lng); })
      .catch(function(err) {
        console.warn('Attempt ' + (attempt+1) + ' failed:', err);
        attempt++;
        if (attempt < endpoints.length) {
          setStatus('Retrying with server ' + (attempt+1) + '...');
          tryFetch();
        } else {
          setStatus('Could not load map data. Please try again shortly.');
        }
      });
  }
  tryFetch();
}

function scorePlace(place, foodName) {
  var tags = place.tags || {};
  var name = (tags.name || '').toLowerCase();
  var cuisine = (tags.cuisine || '').toLowerCase();
  var amenity = (tags.amenity || '').toLowerCase();
  var mapping = FOOD_MATCH_MAP[foodName];
  if (!mapping) return 1;
  if ((mapping.exclude || []).some(function(ex) { return name.indexOf(ex.toLowerCase()) >= 0; })) return 0;
  var score = 0;
  if ((mapping.cuisines || []).some(function(c) { return cuisine.indexOf(c) >= 0; })) score += 2;
  if ((mapping.keywords || []).some(function(kw) { return name.indexOf(kw.toLowerCase()) >= 0; })) score += 1;
  if (amenity === 'food_court') score += 1;
  if (amenity === 'restaurant' && score === 0) score = 1;
  return score;
}

function renderNearbyResults(rawPlaces, lat, lng) {
  if (!rawPlaces.length) { hideStatus(); showMapEl(); initOrResetMap(lat, lng); addUserMarker(lat, lng); showNoResults(lat, lng); return; }
  var radius = getSelectedRadius();
  var candidates = rawPlaces
    .filter(function(p) { return p.lat && p.lon && p.tags; })
    .map(function(p) { return Object.assign({}, p, { straightDistM: haversine(lat, lng, p.lat, p.lon) }); })
    .filter(function(p) { return p.straightDistM <= radius + 1000; })
    .sort(function(a,b) { return a.straightDistM - b.straightDistM; })
    .slice(0, 40);
  if (!candidates.length) { hideStatus(); showMapEl(); initOrResetMap(lat, lng); addUserMarker(lat, lng); showNoResults(lat, lng); return; }
  setStatus('Calculating driving distances...');
  var coords = [lng+','+lat].concat(candidates.map(function(p) { return p.lon+','+p.lat; })).join(';');
  var osrmUrl = 'https://router.project-osrm.org/table/v1/driving/' + coords + '?sources=0&annotations=distance';
  fetch(osrmUrl)
    .then(function(r) { return r.ok ? r.json() : Promise.reject('OSRM error'); })
    .then(function(d) {
      var dists = d.distances[0];
      processAndDisplay(candidates.map(function(p,i) { return Object.assign({}, p, { distM: dists[i+1] != null ? dists[i+1] : p.straightDistM, isRoad: dists[i+1] != null }); }), lat, lng);
    })
    .catch(function() { processAndDisplay(candidates.map(function(p) { return Object.assign({}, p, { distM: p.straightDistM, isRoad: false }); }), lat, lng); });
}

function processAndDisplay(places, lat, lng) {
  hideStatus(); showMapEl(); initOrResetMap(lat, lng); addUserMarker(lat, lng);
  var radius = getSelectedRadius();
  var scored = places
    .map(function(p) { return Object.assign({}, p, { relevance: scorePlace(p, nearbyFoodLabel) }); })
    .filter(function(p) { return p.distM <= radius && p.relevance > 0; })
    .sort(function(a,b) { return b.relevance - a.relevance || a.distM - b.distM; });
  if (!scored.length) {
    var all = places.filter(function(p) { return p.distM <= radius; }).map(function(p) { return Object.assign({}, p, { relevance: 1 }); }).sort(function(a,b) { return a.distM - b.distM; });
    if (!all.length) { showNoResults(lat, lng); return; }
    renderMarkers(all, lat, lng, false); renderList(all, false); updateSubtitle(0, all.length); return;
  }
  var good = scored.filter(function(p) { return p.relevance >= 2; });
  renderMarkers(scored, lat, lng, true); renderList(scored, true, good.length); updateSubtitle(good.length, scored.length); updateOsmLink(lat, lng);
}

function updateSubtitle(goodCount, total) {
  var el = document.getElementById('nearbySubtitle');
  if (!el) return;
  var radLbl = radiusLabel(getSelectedRadius());
  el.innerHTML = goodCount > 0 ? '<strong>' + goodCount + '</strong> likely match' + (goodCount !== 1 ? 'es' : '') + ' &middot; ' + total + ' total within ' + radLbl : total + ' nearby food places within ' + radLbl;
}

function addUserMarker(lat, lng) {
  L.marker([lat, lng], { icon: buildUserIcon() }).addTo(leafletMap).bindPopup('<div class="nearby-popup-name">You are here</div>');
}

function renderMarkers(places, lat, lng, useColor) {
  activeMarkers = {};
  places.forEach(function(place) {
    var name = place.tags.name || 'Unnamed Restaurant';
    var type = fmtAmenity(place.tags.amenity);
    var distKm = (place.distM / 1000).toFixed(1);
    var cuisine = place.tags.cuisine ? ' - ' + place.tags.cuisine : '';
    var isMatch = useColor && place.relevance >= 2;
    var border = isMatch ? '#27ae60' : '#7f8c8d';
    var emoji = amenityEmoji(place.tags.amenity);
    var distText = place.isRoad ? 'Road: ' + distKm + ' km' : '~' + distKm + ' km';
    var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + place.lat + ',' + place.lon;
    var waze = 'https://waze.com/ul?ll=' + place.lat + ',' + place.lon + '&navigate=yes';
    var greenDot = isMatch ? '<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#27ae60;border-radius:50%;border:1.5px solid white;"></div>' : '';
    var icon = L.divIcon({
      html: '<div style="width:34px;height:34px;background:white;border:2.5px solid ' + border + ';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;position:relative;">' + emoji + greenDot + '</div>',
      className: '', iconAnchor: [17,17]
    });
    var matchLine = isMatch ? '<span style="color:#27ae60;font-weight:700;font-size:.72rem;">Likely serves ' + nearbyFoodLabel + '</span><br>' : '';
    var popup = '<div style="min-width:180px;font-family:sans-serif;">' +
      '<div style="font-weight:700;margin-bottom:2px;font-size:.9rem;">' + name + '</div>' +
      '<div style="font-size:.75rem;color:#7f8c8d;margin-bottom:4px;">' + type + cuisine + '</div>' +
      matchLine +
      '<div style="font-size:.75rem;color:#7f8c8d;margin:4px 0 8px;">' + distText + '</div>' +
      '<div style="display:flex;gap:6px;">' +
        '<a href="' + gmaps + '" target="_blank" style="flex:1;text-align:center;background:#1a73e8;color:white;padding:6px 4px;border-radius:50px;font-size:.72rem;font-weight:600;text-decoration:none;">G Maps</a>' +
        '<a href="' + waze + '" target="_blank" style="flex:1;text-align:center;background:#33ccff;color:#1a1a1a;padding:6px 4px;border-radius:50px;font-size:.72rem;font-weight:700;text-decoration:none;">Waze</a>' +
      '</div></div>';
    var marker = L.marker([place.lat, place.lon], { icon: icon }).addTo(leafletMap).bindPopup(popup);
    activeMarkers[place.id] = marker;
  });
  leafletMap.setView([lat, lng], getZoomForRadius(getSelectedRadius()));
}

window.focusPlace = function(lat, lng, id) {
  if (!leafletMap) return;
  leafletMap.setView([lat, lng], 17, { animate: true });
  if (activeMarkers[id]) activeMarkers[id].openPopup();
};

function renderList(places, useRelevance, goodCount) {
  goodCount = goodCount || 0;
  var listEl = document.getElementById('nearbyResultsList');
  listEl.hidden = false;
  var html = '';
  if (useRelevance && goodCount > 0) {
    var good = places.filter(function(p) { return p.relevance >= 2; });
    var other = places.filter(function(p) { return p.relevance < 2; });
    html += '<div class="nearby-list-section-label">Likely serves ' + nearbyFoodLabel + '<span class="nearby-count-badge">' + good.length + '</span></div>';
    html += good.map(function(p) { return buildItem(p, true); }).join('');
    if (other.length) {
      html += '<div class="nearby-list-section-label" style="margin-top:.75rem">Other nearby food places<span class="nearby-count-badge" style="background:#f0ebe3;color:#7f8c8d">' + other.length + '</span></div>';
      html += other.map(function(p) { return buildItem(p, false); }).join('');
    }
  } else {
    html += places.map(function(p) { return buildItem(p, false); }).join('');
  }
  listEl.innerHTML = html;
}

function buildItem(place, isMatch) {
  var name = place.tags.name || 'Unnamed Restaurant';
  var distKm = (place.distM / 1000).toFixed(1);
  var type = fmtAmenity(place.tags.amenity);
  var cuisine = place.tags.cuisine ? '<span class="nearby-result-badge">' + place.tags.cuisine + '</span>' : '';
  var badge = isMatch ? '<span class="nearby-result-badge nearby-match-badge">Match</span>' : '';
  var distText = place.isRoad ? '<span class="nearby-result-dist" style="color:#1a73e8;font-weight:600;">Road: ' + distKm + ' km</span>' : '<span class="nearby-result-dist">~' + distKm + ' km</span>';
  var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + place.lat + ',' + place.lon;
  var waze = 'https://waze.com/ul?ll=' + place.lat + ',' + place.lon + '&navigate=yes';
  return '<div class="nearby-result-item ' + (isMatch ? 'nearby-result-match' : '') + '" onclick="focusPlace(' + place.lat + ',' + place.lon + ',' + place.id + ')" title="Click to show on map">' +
    '<div class="nearby-result-icon">' + amenityEmoji(place.tags.amenity) + '</div>' +
    '<div class="nearby-result-info"><div class="nearby-result-name">' + name + '</div>' +
    '<div class="nearby-result-meta">' + distText + '<span>' + type + '</span>' + cuisine + badge + '</div></div>' +
    '<div class="nearby-list-actions" style="display:flex;gap:6px;flex-shrink:0;align-items:center;">' +
      '<a href="' + gmaps + '" target="_blank" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;background:#1a73e8;color:white;width:32px;height:32px;border-radius:50%;font-size:.75rem;text-decoration:none;font-weight:bold;">G</a>' +
      '<a href="' + waze + '" target="_blank" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;background:#33ccff;color:#1a1a1a;width:32px;height:32px;border-radius:50%;font-size:.75rem;text-decoration:none;font-weight:800;">W</a>' +
    '</div></div>';
}

function showMapEl() { document.getElementById('leafletMap').hidden = false; }

function initOrResetMap(lat, lng) {
  var el = document.getElementById('leafletMap');
  if (leafletMap) { leafletMap.remove(); leafletMap = null; el.innerHTML = ''; }
  leafletMap = L.map('leafletMap', { zoomControl: true }).setView([lat, lng], getZoomForRadius(getSelectedRadius()));
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(leafletMap);
  var Recenter = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      var btn = L.DomUtil.create('button', 'leaflet-recenter-btn');
      btn.innerHTML = '📍'; btn.title = 'Re-centre';
      btn.style.cssText = 'width:36px;height:36px;background:white;border:2px solid rgba(0,0,0,.15);border-radius:6px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.15);';
      L.DomEvent.on(btn, 'click', L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, 'click', function() { leafletMap.setView([lat, lng], getZoomForRadius(getSelectedRadius()), { animate: true }); });
      return btn;
    }
  });
  new Recenter().addTo(leafletMap);
}

function buildUserIcon() {
  return L.divIcon({
    html: '<div style="position:relative;width:24px;height:24px;"><div style="position:absolute;inset:-8px;background:rgba(26,115,232,.15);border-radius:50%;animation:userPulse 2s ease-out infinite;"></div><div style="width:24px;height:24px;background:#1a73e8;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(26,115,232,.5);position:relative;z-index:1;"></div></div>',
    className: '', iconAnchor: [12, 12]
  });
}

function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371000, dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function toRad(d) { return d * (Math.PI / 180); }
function fmtAmenity(t) { return { restaurant: 'Restaurant', fast_food: 'Fast Food', cafe: 'Cafe', food_court: 'Food Court' }[t] || t; }
function amenityEmoji(t) { return { restaurant: '🍽️', fast_food: '🍔', cafe: '☕', food_court: '🏪' }[t] || '🍴'; }
function updateOsmLink(lat, lng) {
  var l = document.getElementById('osmLink');
  if (l) l.href = 'https://www.google.com/maps/search/' + encodeURIComponent((nearbyFoodLabel || 'restaurant') + ' restaurant') + '/@' + lat + ',' + lng + ',15z';
}

function showNearbySection() { var sec = document.getElementById('nearbySection'); sec.hidden = false; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function closeNearby() { document.getElementById('nearbySection').hidden = true; if (leafletMap) { leafletMap.remove(); leafletMap = null; } clearTimeout(locationFallbackTimer); }
function setStatus(msg) {
  var statusEl = document.getElementById('nearbyStatus');
  statusEl.hidden = false;
  document.getElementById('nearbyStatusText').textContent = msg;
  var spinner = statusEl.querySelector('.nearby-spinner');
  if (spinner) { var isError = msg.indexOf('Could not') === 0 || msg.indexOf('Location denied') === 0 || msg.indexOf('Location unavailable') === 0 || msg.indexOf('timed out') >= 0; spinner.style.display = isError ? 'none' : 'block'; }
}
function hideStatus() { document.getElementById('nearbyStatus').hidden = true; }
function hideMapAndList() { document.getElementById('leafletMap').hidden = true; document.getElementById('nearbyResultsList').hidden = true; document.getElementById('nearbyNoResults').hidden = true; }
function showNoResults(lat, lng) { document.getElementById('nearbyNoResults').hidden = false; updateOsmLink(lat, lng); }
