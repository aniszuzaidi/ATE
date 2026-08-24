/**
 * nearby.js - Find It Near You feature for ATE
 * No map, no CORS, no API calls.
 * Gets your GPS then opens Google Maps / Waze / GrabFood / Shopee Food.
 */

let nearbyFoodLabel = '';
let locationFallbackTimer = null;

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('findNearbyBtn').addEventListener('click', onFindNearby);
  document.getElementById('nearbyClose').addEventListener('click', closeNearby);
});

// Called from script.js when a result is shown
function updateNearbyButton(foodName) {
  nearbyFoodLabel = foodName;
  var span = document.getElementById('nearbyFoodName');
  if (span) span.textContent = foodName;
}

function onFindNearby() {
  showNearbySection();
  setStatus('Getting your location...');
  hideCard();

  var fallback = document.getElementById('locationFallbackText');
  if (fallback) fallback.hidden = true;

  if (!navigator.geolocation) {
    showFindCard(null, null);
    hideStatus();
    return;
  }

  clearTimeout(locationFallbackTimer);
  locationFallbackTimer = setTimeout(function() {
    // GPS too slow - show card without coordinates (apps will use their own location)
    hideStatus();
    showFindCard(null, null);
  }, 4000);

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      clearTimeout(locationFallbackTimer);
      hideStatus();
      showFindCard(pos.coords.latitude, pos.coords.longitude);
    },
    function() {
      clearTimeout(locationFallbackTimer);
      hideStatus();
      showFindCard(null, null);
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

function showFindCard(lat, lng) {
  var food = nearbyFoodLabel || 'restaurant';
  var q = encodeURIComponent(food + ' restaurant');

  // Build URLs - with coordinates if available, else just search by name
  var gmapsUrl, wazeUrl;
  if (lat !== null && lng !== null) {
    gmapsUrl = 'https://www.google.com/maps/search/' + q + '/@' + lat + ',' + lng + ',15z';
    wazeUrl  = 'https://waze.com/ul?q=' + q + '&ll=' + lat + '%2C' + lng + '&navigate=yes';
  } else {
    gmapsUrl = 'https://www.google.com/maps/search/' + q + '+near+me';
    wazeUrl  = 'https://waze.com/ul?q=' + q + '&navigate=yes';
  }
  var grabUrl    = 'https://food.grab.com/my/en/s?keyword=' + encodeURIComponent(food);
  var shopeeUrl  = 'https://shopee.com.my/food?keyword=' + encodeURIComponent(food);

  // Update button hrefs
  document.getElementById('btnGmaps').href   = gmapsUrl;
  document.getElementById('btnWaze').href    = wazeUrl;
  document.getElementById('btnGrab').href    = grabUrl;
  document.getElementById('btnShopee').href  = shopeeUrl;

  // Update title
  var titleEl = document.getElementById('findItTitle');
  if (titleEl) titleEl.textContent = 'Find ' + food + ' Near You';

  // Update location note
  var locNote = document.getElementById('findItLocationNote');
  if (locNote) {
    locNote.textContent = lat !== null
      ? 'Using your current location'
      : 'Location not needed — apps will detect it for you';
  }

  document.getElementById('findItCard').hidden = false;
  document.getElementById('nearbySubtitle').textContent = food + ' — choose how to search';
}

function hideCard() {
  var card = document.getElementById('findItCard');
  if (card) card.hidden = true;
}

function showNearbySection() {
  var sec = document.getElementById('nearbySection');
  sec.hidden = false;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeNearby() {
  document.getElementById('nearbySection').hidden = true;
  hideCard();
  clearTimeout(locationFallbackTimer);
}

function setStatus(msg) {
  var s = document.getElementById('nearbyStatus');
  s.hidden = false;
  document.getElementById('nearbyStatusText').textContent = msg;
}

function hideStatus() {
  document.getElementById('nearbyStatus').hidden = true;
}
