/**
 * nearby.js — "Find Nearby" feature for ATE
 *
 * How it works:
 *  1. User clicks "Find [Food] Near Me"
 *  2. Browser Geolocation API gets user's coordinates
 *  3. Overpass API queries all food amenities within 2 km
 *  4. Each place is scored for relevance to the chosen food using
 *     a keyword/cuisine mapping — not just "all restaurants"
 *  5. Results are split into "Good matches" vs "Other nearby food"
 *  6. Leaflet renders the map; matched places get highlighted markers
 *
 * Completely free — no API key required.
 */

/* ============================================================
   STATE
   ============================================================ */
const isNetlify     = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== 'file:';
let leafletMap      = null;
let nearbyFoodLabel = '';    // Food name from result card
let nearbyFoodId    = null;  // Food ID (for data lookup)
let userLat         = null;  // User's latitude
let userLng         = null;  // User's longitude
let activeMarkers   = {};    // Store markers by place ID to open popups from list items

/* ============================================================
   FOOD → CUISINE / KEYWORD MAPPING
   Maps each food name to:
     cuisines  — OSM cuisine tag values to match
     keywords  — words to look for in the place's name (case-insensitive)
     exclude   — name keywords that strongly indicate it's NOT a match
                 (e.g. ZUS Coffee when searching Nasi Goreng)
   ============================================================ */
const FOOD_MATCH_MAP = {
  /* ---- Malaysian / Asian rice ---- */
  'Nasi Lemak':   { cuisines: ['malay','malaysian','halal'],          keywords: ['nasi','warung','kopitiam','mamak','kedai makan','coconut rice'],  exclude: ['coffee','bakery','pizza','sushi','cafe','kfc','mcd','subway'] },
  'Nasi Ayam':    { cuisines: ['malay','malaysian','chinese'],         keywords: ['nasi','chicken rice','ayam','hainanese','kedai'],                 exclude: ['coffee','bakery','pizza','sushi'] },
  'Ayam Penyet':  { cuisines: ['indonesian','malay'],                  keywords: ['penyet','ayam','indonesian','warung','nasi'],                      exclude: ['coffee','bakery','pizza','sushi'] },
  'Nasi Goreng':  { cuisines: ['malay','malaysian','indonesian','halal'], keywords: ['nasi','warung','mamak','kopitiam','kedai makan','goreng'],      exclude: ['coffee','bakery','sushi','zus','starbucks','coffee bean'] },
  'Chicken Rice': { cuisines: ['chinese','hainanese'],                 keywords: ['chicken rice','hainanese','nasi ayam','kopitiam'],                 exclude: ['coffee','bakery','pizza'] },

  /* ---- Noodles ---- */
  'Mee Goreng':   { cuisines: ['malay','malaysian','halal'],           keywords: ['mee','mamak','warung','noodle','goreng'],                          exclude: ['coffee','bakery','pizza','sushi'] },
  'Maggi Goreng': { cuisines: ['malay','malaysian','halal'],           keywords: ['mamak','maggi','warung','24'],                                     exclude: ['coffee','bakery','sushi'] },
  'Laksa':        { cuisines: ['malaysian','malay','peranakan'],       keywords: ['laksa','kopitiam','hawker','warung'],                              exclude: ['coffee','bakery','pizza','sushi'] },
  'Asam Laksa':   { cuisines: ['malaysian','malay','peranakan'],       keywords: ['laksa','asam','kopitiam','hawker','penang'],                       exclude: ['coffee','bakery'] },
  'Ramen':        { cuisines: ['japanese','ramen'],                    keywords: ['ramen','japanese','nippon','menya'],                               exclude: ['malay','indian','mamak'] },
  'Tom Yum':      { cuisines: ['thai'],                                keywords: ['thai','tom yum','tomyum','tomyam','thailand'],                     exclude: ['coffee','bakery','sushi'] },

  /* ---- Fast food / Western ---- */
  'Burger':       { cuisines: ['burger','american','fast_food'],       keywords: ['burger','grill','bistro','bun','patty','myburger','ramly'],        exclude: ['sushi','ramen','nasi','mee'] },
  'Pizza':        { cuisines: ['pizza','italian'],                     keywords: ['pizza','pizzeria','domino','papa john','italian'],                 exclude: ['sushi','ramen','nasi'] },
  'Pasta':        { cuisines: ['italian'],                             keywords: ['pasta','italian','bistro','spaghetti','lasagna'],                  exclude: ['sushi','ramen','nasi','mamak'] },
  'Chicken Chop': { cuisines: ['western'],                             keywords: ['western','chicken chop','grill','steak','chop'],                   exclude: ['sushi','ramen','nasi'] },
  'Fish and Chips': { cuisines: ['british','fish_and_chips'],          keywords: ['fish','chips','british','fish & chips'],                           exclude: ['sushi','ramen','nasi','mamak'] },

  /* ---- Japanese ---- */
  'Sushi':        { cuisines: ['japanese','sushi'],                    keywords: ['sushi','japanese','sashimi','nippon','ichiban','sakae'],            exclude: ['malay','indian','mamak','western'] },
  'Takoyaki':     { cuisines: ['japanese'],                            keywords: ['takoyaki','japanese','octopus','teppanyaki'],                      exclude: ['malay','indian','mamak'] },

  /* ---- Malaysian specials ---- */
  'Satay':        { cuisines: ['malay','malaysian'],                   keywords: ['satay','satey','warung','hawker','bbq'],                           exclude: ['coffee','bakery','pizza','sushi'] },
  'Roti Canai':   { cuisines: ['indian','mamak','halal'],              keywords: ['roti','mamak','indian','kopitiam','canai','paratha'],              exclude: ['coffee','bakery','pizza','sushi','burger'] },
  'Salted Egg Chicken': { cuisines: ['chinese','malaysian'],           keywords: ['salted egg','chinese','fusion','kopitiam'],                        exclude: ['coffee','bakery','pizza'] },

  /* ---- Dessert ---- */
  'Cendol':       { cuisines: ['dessert','malaysian'],                 keywords: ['cendol','dessert','hawker','kopitiam','ais'],                      exclude: ['burger','pizza','sushi'] },
  'Ice Cream':    { cuisines: ['ice_cream','dessert'],                 keywords: ['ice cream','gelato','dessert','creamery','baskin','dairy'],        exclude: ['burger','pizza','nasi','ramen'] },
  'Waffle':       { cuisines: ['dessert','cafe'],                      keywords: ['waffle','cafe','dessert','pancake'],                               exclude: ['burger','nasi','ramen','mamak'] },
};

/* Amenity types to query from Overpass */
const AMENITY_TYPES = ['restaurant','fast_food','cafe','food_court'];

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('findNearbyBtn')?.addEventListener('click', onFindNearby);
  document.getElementById('nearbyClose')?.addEventListener('click', closeNearby);

  // Re-search when radius dropdown changes
  document.getElementById('radiusSelect')?.addEventListener('change', () => {
    if (userLat !== null && userLng !== null) {
      const radius = getSelectedRadius();
      setStatus(`📡 Searching within ${radiusLabel(radius)}...`);
      hideMapAndList();
      fetchNearbyRestaurants(userLat, userLng, radius);
    }
  });
});

/** Called from script.js when a result is shown */
function updateNearbyButton(foodName) {
  nearbyFoodLabel = foodName;
  const span = document.getElementById('nearbyFoodName');
  if (span) span.textContent = foodName;
}

function getSelectedRadius() {
  const sel = document.getElementById('radiusSelect');
  return sel ? parseInt(sel.value, 10) : 2000;
}

function radiusLabel(metres) {
  return metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
}

function getZoomForRadius(radiusM) {
  if (radiusM <= 1000) return 15;
  if (radiusM <= 2000) return 14;
  if (radiusM <= 5000) return 12;
  if (radiusM <= 10000) return 11;
  return 10; // 20km
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */
function onFindNearby() {
  showNearbySection();
  setStatus('Getting your location...');
  hideMapAndList();

  if (!navigator.geolocation) {
    setStatus('❌ Your browser does not support location services.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    onLocationSuccess,
    onLocationError,
    { timeout: 10000, maximumAge: 60000 }
  );
}

function onLocationSuccess(pos) {
  userLat = pos.coords.latitude;
  userLng = pos.coords.longitude;
  const radius = getSelectedRadius();
  setStatus(`📡 Searching for places that serve ${nearbyFoodLabel || 'this food'} within ${radiusLabel(radius)}...`);
  document.getElementById('nearbySubtitle').textContent = `Filtering by food type within ${radiusLabel(radius)}`;
  fetchNearbyRestaurants(userLat, userLng, radius);
}

function onLocationError(err) {
  const msg = {
    1: '🚫 Location access denied. Please allow location in your browser settings and try again.',
    2: '📡 Location unavailable. Check your connection and try again.',
    3: '⏱️ Location request timed out. Please try again.'
  };
  setStatus(msg[err.code] || '❌ Could not determine your location.');
}

/* ============================================================
   OVERPASS API — fetch all nearby food amenities
   ============================================================ */
function fetchNearbyRestaurants(lat, lng, radius) {
  radius = radius || getSelectedRadius();

  const amenityFilter = AMENITY_TYPES.map(
    a => `node["amenity"="${a}"](around:${radius},${lat},${lng});`
  ).join('\n  ');

  const query = `
[out:json][timeout:25];
(
  ${amenityFilter}
);
out body;
  `.trim();

  // Rotating mirror endpoints for redundancy (helpful in Asia/Malaysia)
  // On Netlify, we prepend our backend proxy to bypass browser CORS / 406 blocks entirely!
  const endpoints = isNetlify ? [
    '/api/overpass/interpreter',
    '/api/overpass-kumi/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ] : [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ];

  let attempt = 0;

  function tryFetch() {
    const url = endpoints[attempt];
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        renderNearbyResults(data.elements || [], lat, lng);
      })
      .catch(err => {
        console.warn(`Overpass attempt ${attempt + 1} (${endpoints[attempt]}) failed:`, err);
        attempt++;
        if (attempt < endpoints.length) {
          setStatus(`📡 Connection busy, retrying using mirror server ${attempt + 1}...`);
          tryFetch();
        } else {
          console.error('All Overpass servers failed.');
          setStatus('⚠️ Could not load map data. The free map service may be busy — please try again shortly.');
        }
      });
  }

  tryFetch();
}

/* ============================================================
   RELEVANCE SCORING
   Scores how likely a place serves the chosen food.
   Returns 0 (irrelevant) to 3 (strong match).
   ============================================================ */
function scorePlace(place, foodName) {
  const tags    = place.tags || {};
  const name    = (tags.name    || '').toLowerCase();
  const cuisine = (tags.cuisine || '').toLowerCase();
  const amenity = (tags.amenity || '').toLowerCase();

  const mapping = FOOD_MATCH_MAP[foodName];

  // No mapping found — neutral, show as generic
  if (!mapping) return 1;

  // --- Check exclusion list first ---
  // If the place name strongly indicates it's NOT relevant, score 0
  const excluded = (mapping.exclude || []).some(ex => name.includes(ex.toLowerCase()));
  if (excluded) return 0;

  let score = 0;

  // --- Cuisine tag match (strong signal) ---
  const cuisineMatch = (mapping.cuisines || []).some(c => cuisine.includes(c));
  if (cuisineMatch) score += 2;

  // --- Name keyword match (moderate signal) ---
  const keywordMatch = (mapping.keywords || []).some(kw => name.includes(kw.toLowerCase()));
  if (keywordMatch) score += 1;

  // --- Amenity type bonus ---
  // food_court and restaurant are more likely to serve the food than a café
  if (amenity === 'food_court') score += 1;
  if (amenity === 'restaurant' && score === 0) score = 1; // at least show restaurants

  return score;
}

/* ============================================================
   RENDER — map + results list
   ============================================================ */
function renderNearbyResults(rawPlaces, userLat, userLng) {
  if (rawPlaces.length === 0) {
    hideStatus();
    const mapEl = document.getElementById('leafletMap');
    mapEl.hidden = false;
    initOrResetMap(userLat, userLng);
    L.marker([userLat, userLng], { icon: buildUserIcon() })
     .addTo(leafletMap)
     .bindPopup('<div class="nearby-popup-name">📍 You are here</div>');
    showNoResults(userLat, userLng);
    return;
  }

  // Pre-filter to places within search radius + 1000m (to account for winding roads)
  const radius = getSelectedRadius();
  const rawCandidates = rawPlaces
    .filter(p => p.lat && p.lon && p.tags)
    .map(p => ({
      ...p,
      straightDistM: haversine(userLat, userLng, p.lat, p.lon)
    }))
    .filter(p => p.straightDistM <= radius + 1000)
    .sort((a, b) => a.straightDistM - b.straightDistM)
    .slice(0, 40); // limit to top 40 to avoid excessively long URLs

  if (rawCandidates.length === 0) {
    hideStatus();
    const mapEl = document.getElementById('leafletMap');
    mapEl.hidden = false;
    initOrResetMap(userLat, userLng);
    L.marker([userLat, userLng], { icon: buildUserIcon() })
     .addTo(leafletMap)
     .bindPopup('<div class="nearby-popup-name">📍 You are here</div>');
    showNoResults(userLat, userLng);
    return;
  }

  setStatus('🚗 Calculating road driving distances...');

  // Build OSRM table matrix request (user coordinates at index 0)
  const coords = [`${userLng},${userLat}`, ...rawCandidates.map(p => `${p.lon},${p.lat}`)].join(';');
  const osrmUrl = isNetlify
    ? `/api/osrm/table/v1/driving/${coords}?sources=0&annotations=distance`
    : `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=distance`;

  fetch(osrmUrl)
    .then(res => {
      if (!res.ok) throw new Error('OSRM network error');
      return res.json();
    })
    .then(osrmData => {
      const distances = osrmData.distances[0]; // Distances list from user to destinations
      const processed = rawCandidates.map((p, idx) => {
        const roadDistM = distances[idx + 1];
        const hasRoad = roadDistM !== null && roadDistM !== undefined;
        return {
          ...p,
          distM: hasRoad ? roadDistM : p.straightDistM,
          isRoadDistance: hasRoad
        };
      });
      processAndDisplayResults(processed, userLat, userLng);
    })
    .catch(err => {
      console.warn('OSRM routing failed, falling back to straight-line:', err);
      const processedFallback = rawCandidates.map(p => ({
        ...p,
        distM: p.straightDistM,
        isRoadDistance: false
      }));
      processAndDisplayResults(processedFallback, userLat, userLng);
    });
}

function processAndDisplayResults(places, userLat, userLng) {
  hideStatus();

  const mapEl = document.getElementById('leafletMap');
  mapEl.hidden = false;
  initOrResetMap(userLat, userLng);

  // User location marker
  L.marker([userLat, userLng], { icon: buildUserIcon() })
   .addTo(leafletMap)
   .bindPopup('<div class="nearby-popup-name">📍 You are here</div>');

  const radius = getSelectedRadius();

  // Attach relevance score and filter by actual road distance <= selected radius
  const scored = places
    .map(p => ({
      ...p,
      relevance: scorePlace(p, nearbyFoodLabel)
    }))
    .filter(p => p.distM <= radius && p.relevance > 0)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return a.distM - b.distM;
    });

  if (scored.length === 0) {
    // Fallback: show generic restaurants within radius
    const allPlaces = places
      .map(p => ({ ...p, relevance: 1 }))
      .filter(p => p.distM <= radius)
      .sort((a, b) => a.distM - b.distM);

    if (allPlaces.length === 0) {
      showNoResults(userLat, userLng);
      return;
    }
    renderMapMarkers(allPlaces, userLat, userLng, false);
    renderResultsList(allPlaces, false);
    updateSubtitle(0, allPlaces.length);
    return;
  }

  // Split into matches vs others
  const goodMatches = scored.filter(p => p.relevance >= 2);

  renderMapMarkers(scored, userLat, userLng, true);
  renderResultsList(scored, true, goodMatches.length);
  updateSubtitle(goodMatches.length, scored.length);
  updateOsmLink(userLat, userLng);
}

function updateSubtitle(goodCount, totalCount) {
  const el = document.getElementById('nearbySubtitle');
  if (!el) return;
  const radius = getSelectedRadius();
  const radLabel = radiusLabel(radius);
  if (goodCount > 0) {
    el.innerHTML = `
      <strong>${goodCount}</strong> likely match${goodCount !== 1 ? 'es' : ''}
      · ${totalCount} total food places within ${radLabel}
    `;
  } else {
    el.innerHTML = `${totalCount} nearby food places — no exact type match found within ${radLabel}`;
  }
}

/* ============================================================
   MAP MARKERS
   ============================================================ */
function renderMapMarkers(places, userLat, userLng, useRelevanceColor) {
  // Clear any existing markers from state map
  activeMarkers = {};

  places.forEach(place => {
    const name    = place.tags.name || 'Unnamed Restaurant';
    const type    = formatAmenityType(place.tags.amenity);
    const distKm  = (place.distM / 1000).toFixed(1);
    const cuisine = place.tags.cuisine ? ` · ${place.tags.cuisine}` : '';
    const isMatch = useRelevanceColor && place.relevance >= 2;

    const borderColor = isMatch ? '#27ae60' : '#7f8c8d';
    const emoji       = getAmenityEmoji(place.tags.amenity);

    const icon = L.divIcon({
      html: `<div style="
        width:34px;height:34px;
        background:white;
        border:2.5px solid ${borderColor};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;
        box-shadow:0 2px 8px rgba(0,0,0,.18);
        cursor:pointer;
        position:relative;
      ">${emoji}${isMatch ? `<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#27ae60;border-radius:50%;border:1.5px solid white;"></div>` : ''}</div>`,
      className: '',
      iconAnchor: [17, 17]
    });

    const matchBadge = isMatch
      ? `<span style="color:#27ae60;font-weight:700;font-size:.72rem;">✓ Likely serves ${nearbyFoodLabel}</span><br>`
      : '';

    const isRoad = place.isRoadDistance;
    const distText = isRoad ? `🚗 ${distKm} km (road)` : `📍 ~${distKm} km (straight-line)`;

    // Google Maps Search link (uses coordinates strictly to prevent business name hijacking)
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
    // Waze Navigation link (strictly snaps to coordinates)
    const wazeUrl  = `https://waze.com/ul?ll=${place.lat},${place.lon}&navigate=yes`;

    const popup = `
      <div style="min-width:180px; font-family: 'Poppins', sans-serif;">
        <div class="nearby-popup-name" style="font-weight:700;margin-bottom:2px;font-size:0.9rem;">${name}</div>
        <div class="nearby-popup-type" style="font-size:0.75rem;color:#7f8c8d;margin-bottom:4px;">${type}${cuisine}</div>
        ${matchBadge}
        <div style="font-size:0.75rem;color:#7f8c8d;margin:4px 0 8px;">${distText}</div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <a class="nearby-popup-gmaps-btn" href="${gmapsUrl}" target="_blank" rel="noopener" style="
            flex: 1;
            text-align: center;
            background: #1a73e8;
            color: white;
            padding: 6px 4px;
            border-radius: 50px;
            font-size: 0.72rem;
            font-weight: 600;
            text-decoration: none;
            box-shadow: 0 2px 6px rgba(26,115,232,0.3);
            transition: background 0.2s;
          ">
            🚗 G Maps
          </a>
          <a class="nearby-popup-waze-btn" href="${wazeUrl}" target="_blank" rel="noopener" style="
            flex: 1;
            text-align: center;
            background: #33ccff;
            color: #1a1a1a;
            padding: 6px 4px;
            border-radius: 50px;
            font-size: 0.72rem;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 2px 6px rgba(51,204,255,0.3);
            transition: background 0.2s;
          ">
            🚙 Waze
          </a>
        </div>
      </div>
    `;

    const marker = L.marker([place.lat, place.lon], { icon })
     .addTo(leafletMap)
     .bindPopup(popup);

    // Save marker instance to let list items activate it
    activeMarkers[place.id] = marker;
  });

  // ✅ Stay centred on user at appropriate zoom level based on selected search radius
  const radius = getSelectedRadius();
  const zoom = getZoomForRadius(radius);
  leafletMap.setView([userLat, userLng], zoom);
}

// Global focus handler for list item clicks
window.focusPlace = function(lat, lng, id) {
  if (!leafletMap) return;
  
  // Set view to the marker, zooming in slightly for focus
  leafletMap.setView([lat, lng], 17, { animate: true });
  
  const marker = activeMarkers[id];
  if (marker) {
    // Open the popup bubble
    marker.openPopup();
  }
};

/* ============================================================
   RESULTS LIST
   ============================================================ */
function renderResultsList(places, useRelevance, goodCount = 0) {
  const listEl = document.getElementById('nearbyResultsList');
  listEl.hidden = false;

  let html = '';

  if (useRelevance && goodCount > 0) {
    const good  = places.filter(p => p.relevance >= 2);
    const other = places.filter(p => p.relevance < 2);

    html += `<div class="nearby-list-section-label">
      ✅ Likely serves ${nearbyFoodLabel}
      <span class="nearby-count-badge">${good.length}</span>
    </div>`;
    html += good.map(p => buildResultItem(p, true)).join('');

    if (other.length > 0) {
      html += `<div class="nearby-list-section-label" style="margin-top:.75rem">
        🍴 Other nearby food places
        <span class="nearby-count-badge" style="background:#f0ebe3;color:#7f8c8d">${other.length}</span>
      </div>`;
      html += other.map(p => buildResultItem(p, false)).join('');
    }
  } else {
    if (useRelevance) {
      html += `<div class="nearby-no-exact-match">
        ℹ️ No places specifically matched "${nearbyFoodLabel}" — showing all nearby food spots instead.
      </div>`;
    }
    html += places.map(p => buildResultItem(p, false)).join('');
  }

  listEl.innerHTML = html;
}

function buildResultItem(place, isMatch) {
  const name    = place.tags.name || 'Unnamed Restaurant';
  const type    = formatAmenityType(place.tags.amenity);
  const distKm  = (place.distM / 1000).toFixed(1);
  const cuisine = place.tags.cuisine
    ? `<span class="nearby-result-badge">${place.tags.cuisine}</span>` : '';
  const matchBadge = isMatch
    ? `<span class="nearby-result-badge nearby-match-badge">✓ Match</span>` : '';

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
  const wazeUrl  = `https://waze.com/ul?ll=${place.lat},${place.lon}&navigate=yes`;

  const isRoad = place.isRoadDistance;
  const distText = isRoad
    ? `<span class="nearby-result-dist" style="color: #1a73e8; font-weight: 600;">🚗 ${distKm} km</span>`
    : `<span class="nearby-result-dist">📍 ~${distKm} km (direct)</span>`;

  // Renders as a div with focusPlace onclick. Stopping propagation on the GMaps/Waze links is crucial!
  return `
    <div class="nearby-result-item ${isMatch ? 'nearby-result-match' : ''}"
         onclick="focusPlace(${place.lat}, ${place.lon}, ${place.id})"
         title="Click to show on map">
      <div class="nearby-result-icon">${getAmenityEmoji(place.tags.amenity)}</div>
      <div class="nearby-result-info">
        <div class="nearby-result-name">${name}</div>
        <div class="nearby-result-meta">
          ${distText}
          <span>${type}</span>
          ${cuisine}
          ${matchBadge}
        </div>
      </div>
      <div class="nearby-list-actions" style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
        <a class="nearby-directions-btn" href="${gmapsUrl}" target="_blank" rel="noopener"
           onclick="event.stopPropagation();"
           title="Directions on Google Maps" style="
             display: flex;
             align-items: center;
             justify-content: center;
             background: #1a73e8;
             color: white;
             width: 32px;
             height: 32px;
             border-radius: 50%;
             font-size: 0.75rem;
             text-decoration: none;
             box-shadow: 0 2px 6px rgba(26,115,232,0.2);
             transition: transform 0.2s, background 0.2s;
             font-weight: bold;
           ">
          G
        </a>
        <a class="nearby-directions-btn waze-btn" href="${wazeUrl}" target="_blank" rel="noopener"
           onclick="event.stopPropagation();"
           title="Navigate with Waze" style="
             display: flex;
             align-items: center;
             justify-content: center;
             background: #33ccff;
             color: #1a1a1a;
             width: 32px;
             height: 32px;
             border-radius: 50%;
             font-size: 0.75rem;
             text-decoration: none;
             box-shadow: 0 2px 6px rgba(51,204,255,0.2);
             transition: transform 0.2s, background 0.2s;
             font-weight: 800;
           ">
          W
        </a>
      </div>
    </div>
  `;
}

/* ============================================================
   LEAFLET MAP INIT
   ============================================================ */
function initOrResetMap(lat, lng) {
  const mapEl = document.getElementById('leafletMap');
  if (leafletMap) { leafletMap.remove(); leafletMap = null; mapEl.innerHTML = ''; }

  const radius = getSelectedRadius();
  const zoom = getZoomForRadius(radius);

  // Start at user's location, dynamic zoom
  leafletMap = L.map('leafletMap', {
    zoomControl: true,
    attributionControl: true
  }).setView([lat, lng], zoom);

  // Free OpenStreetMap tiles — no API key needed
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leafletMap);

  // Add a custom "Re-centre on me" control button
  const RecenterControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const btn = L.DomUtil.create('button', 'leaflet-recenter-btn');
      btn.innerHTML = '📍';
      btn.title = 'Re-centre on my location';
      btn.style.cssText = `
        width:36px;height:36px;
        background:white;
        border:2px solid rgba(0,0,0,.15);
        border-radius:6px;
        font-size:1.1rem;
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,.15);
      `;
      L.DomEvent.on(btn, 'click', L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, 'click', () => {
        const r = getSelectedRadius();
        leafletMap.setView([lat, lng], getZoomForRadius(r), { animate: true });
      });
      return btn;
    }
  });
  new RecenterControl().addTo(leafletMap);
}

/** Pulsing blue dot — like Google Maps "you are here" */
function buildUserIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <!-- Pulsing ring -->
        <div style="
          position:absolute;
          inset:-8px;
          background:rgba(26,115,232,.15);
          border-radius:50%;
          animation:userPulse 2s ease-out infinite;
        "></div>
        <!-- Solid dot -->
        <div style="
          width:24px;height:24px;
          background:#1a73e8;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(26,115,232,.5);
          position:relative;z-index:1;
        "></div>
      </div>
    `,
    className: '',
    iconAnchor: [12, 12]
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * (Math.PI / 180); }

function formatAmenityType(type) {
  return { restaurant: 'Restaurant', fast_food: 'Fast Food', cafe: 'Café', food_court: 'Food Court' }[type] || type;
}

function getAmenityEmoji(type) {
  return { restaurant: '🍽️', fast_food: '🍔', cafe: '☕', food_court: '🏪' }[type] || '🍴';
}

function updateOsmLink(lat, lng) {
  const link = document.getElementById('osmLink');
  if (link) link.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(nearbyFoodLabel + ' restaurant')}&lat=${lat}&lon=${lng}`;
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
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
}

function setStatus(msg) {
  document.getElementById('nearbyStatus').hidden = false;
  document.getElementById('nearbyStatusText').textContent = msg;
}

function hideStatus() {
  document.getElementById('nearbyStatus').hidden = true;
}

function hideMapAndList() {
  document.getElementById('leafletMap').hidden = true;
  document.getElementById('nearbyResultsList').hidden = true;
  document.getElementById('nearbyNoResults').hidden = true;
}

function showNoResults(lat, lng) {
  document.getElementById('nearbyNoResults').hidden = false;
  updateOsmLink(lat, lng);
}
