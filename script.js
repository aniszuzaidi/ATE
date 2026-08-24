/**
 * script.js — Core shared logic for ATE
 * Handles: localStorage, food data, filtering, scoring,
 *          slot-machine animation, result, favorites, toasts, nav
 */

/* ============================================================
   STORAGE HELPERS
   ============================================================ */

const STORAGE_KEYS = {
  FOODS: 'ate_foods',
  FAVORITES: 'ate_favorites'
};

/** Load foods from localStorage. Seeds from INITIAL_FOODS on first run. */
function loadFoods() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOODS);
    if (raw) {
      const stored = JSON.parse(raw);
      const storedIds = new Set(stored.map(f => f.id));
      const newDefaults = INITIAL_FOODS.filter(f => !storedIds.has(f.id));
      if (newDefaults.length > 0) {
        const merged = [...stored, ...newDefaults];
        saveFoods(merged);
        return merged;
      }
      return stored;
    }
  } catch (e) {
    console.warn('Corrupted food data, resetting.', e);
  }
  // Seed initial data
  saveFoods(INITIAL_FOODS);
  return [...INITIAL_FOODS];
}

function saveFoods(foods) {
  localStorage.setItem(STORAGE_KEYS.FOODS, JSON.stringify(foods));
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Corrupted favorites data, resetting.', e);
  }
  return [];
}

function saveFavorites(favIds) {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favIds));
}

/** Toggle favorite status for a food by ID. Returns new favorites array. */
function toggleFavorite(foodId) {
  const favs = loadFavorites();
  const idx = favs.indexOf(foodId);
  if (idx === -1) {
    favs.push(foodId);
    showToast('❤️ Added to favorites', 'success');
  } else {
    favs.splice(idx, 1);
    showToast('💔 Removed from favorites', 'info');
  }
  saveFavorites(favs);
  return favs;
}

function isFavorited(foodId) {
  return loadFavorites().includes(foodId);
}

/* ============================================================
   MATCHING ALGORITHM
   ============================================================ */

/**
 * Calculate a preference match score for a food.
 * Higher = better match.
 */
function calculateMatchScore(food, prefs) {
  let score = 0;

  // --- Taste scoring ---
  if (prefs.tastes.length > 0) {
    prefs.tastes.forEach(taste => {
      score += (food.tastes[taste] || 0) * 2; // weight taste intensity
    });
  } else {
    // Any taste: give a small base score so all foods qualify
    score += 5;
  }

  // --- Hunger / meal size scoring ---
  const sizeMap = { light: 1, normal: 2, heavy: 3 };
  const userSize = sizeMap[prefs.hunger] || 2;
  const foodSize = sizeMap[food.mealSize] || 2;
  const sizeDiff = Math.abs(userSize - foodSize);
  score += (3 - sizeDiff) * 3; // 9, 6, or 3 points

  return score;
}

/**
 * Filter foods by hard constraints (budget, spice, distance).
 * Returns filtered list.
 */
function filterFoods(foods, prefs) {
  return foods.filter(food => {
    // --- Budget filter ---
    if (prefs.budget !== 'any') {
      const p = food.price;
      if (prefs.budget === 'under10' && p >= 10) return false;
      if (prefs.budget === '10to20' && (p < 10 || p > 20)) return false;
      if (prefs.budget === '20to40' && (p < 20 || p > 40)) return false;
      if (prefs.budget === '40plus' && p < 40) return false;
    }

    // --- Spice filter ---
    if (prefs.spice !== 'any') {
      if (food.spicyLevel !== prefs.spice) return false;
    }

    return true;
  });
}

/**
 * Score + rank + randomly select a food.
 * Picks from the top scoring 30% (or at least 3) candidates.
 */
function selectFood(foods, prefs) {
  if (foods.length === 0) return null;

  const scored = foods.map(f => ({
    food: f,
    score: calculateMatchScore(f, prefs)
  }));

  scored.sort((a, b) => b.score - a.score);

  // Take top 30% or minimum 3, whichever is greater
  const topN = Math.max(3, Math.ceil(scored.length * 0.3));
  const candidates = scored.slice(0, topN);

  // Weighted random selection from top candidates
  const totalScore = candidates.reduce((s, c) => s + Math.max(c.score, 1), 0);
  let rand = Math.random() * totalScore;
  for (const c of candidates) {
    rand -= Math.max(c.score, 1);
    if (rand <= 0) return c.food;
  }
  return candidates[0].food;
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

/* ============================================================
   CARD RENDERING HELPERS (shared by Foods & Favorites pages)
   ============================================================ */

function getSpicyLabel(level) {
  const map = {
    'not-spicy': '🙂 Not Spicy',
    'mild':      '🌶️ Mild',
    'medium':    '🌶️🌶️ Medium',
    'very-spicy':'🌶️🌶️🌶️ Very Spicy'
  };
  return map[level] || level;
}

function getMealSizeLabel(size) {
  const map = { light: '🥗 Light', normal: '🍽️ Normal', heavy: '🍖 Heavy' };
  return map[size] || size;
}

function getTasteTagsHTML(food) {
  const TASTE_MAP = {
    sweet:  { label: '🍬 Sweet',  class: 'sweet' },
    salty:  { label: '🧂 Salty',  class: 'salty' },
    sour:   { label: '🍋 Sour',   class: 'sour' },
    bitter: { label: '🌿 Bitter', class: '' },
    spicy:  { label: '🌶️ Spicy', class: 'spicy' },
    savory: { label: '😋 Savory', class: 'savory' }
  };

  return Object.entries(food.tastes)
    .filter(([, val]) => val >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => `<span class="tag ${TASTE_MAP[key].class}">${TASTE_MAP[key].label}</span>`)
    .join('');
}

function getTasteBarsHTML(food, small = false) {
  const TASTE_LABELS = {
    sweet:  '🍬 Sweet',
    salty:  '🧂 Salty',
    sour:   '🍋 Sour',
    bitter: '🌿 Bitter',
    spicy:  '🌶️ Spicy',
    savory: '😋 Savory'
  };

  const prefix = small ? 'card-' : '';
  return Object.entries(food.tastes).map(([key, val]) => `
    <div class="${prefix}taste-row">
      <span class="taste-bar-label">${TASTE_LABELS[key]}</span>
      <div class="taste-bar-track">
        <div class="taste-bar-fill" style="width:${(val / 5) * 100}%"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Render a food card for My Foods / Favorites pages.
 * showActions: show edit/delete buttons (for My Foods)
 */
function renderFoodCard(food, showActions = true) {
  const favs = loadFavorites();
  const isFav = favs.includes(food.id);

  const imageSection = food.image
    ? `<div class="food-card-image"><img src="${food.image}" alt="${food.name}" loading="lazy" /></div>`
    : `<div class="food-card-image">${food.emoji || '🍽️'}</div>`;

  const actionButtons = showActions ? `
    <div class="food-card-actions">
      <button class="card-btn edit-btn" data-id="${food.id}">✏️ Edit</button>
      <button class="card-btn delete-btn" data-id="${food.id}">🗑️ Delete</button>
      <button class="card-btn fav-btn ${isFav ? 'favorited' : ''}" data-id="${food.id}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">${isFav ? '❤️' : '🤍'}</button>
    </div>
  ` : `
    <div class="food-card-actions">
      <button class="card-btn fav-btn ${isFav ? 'favorited' : ''}" data-id="${food.id}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" style="flex:1">${isFav ? '❤️ Favorited' : '🤍 Save'}</button>
    </div>
  `;

  return `
    <article class="food-card" data-id="${food.id}">
      ${imageSection}
      <div class="food-card-body">
        <div class="food-card-top">
          <span class="food-card-name">${food.name}</span>
          <span class="food-card-price">RM${food.price}</span>
        </div>
        <div class="food-card-category">${food.category}</div>
        <div class="food-card-tags">${getTasteTagsHTML(food)}</div>
        <div class="card-taste-bars">${getTasteBarsHTML(food, true)}</div>
        <div class="food-card-meta">
          <span>${getSpicyLabel(food.spicyLevel)}</span>
          <span>${getMealSizeLabel(food.mealSize)}</span>
        </div>
      </div>
      ${actionButtons}
    </article>
  `;
}

/* ============================================================
   NAVIGATION (hamburger)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
    });

    // Close on nav link click (mobile)
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // Init page-specific logic
  if (document.getElementById('pickForMe')) initDecidePage();
});

/* ============================================================
   DECIDE PAGE — STATE & PREFERENCES
   ============================================================ */
const prefs = {
  tastes:   [],     // selected taste keys
  spice:    'any',
  hunger:   'normal',
  budget:   'any',
  distance: 'anywhere'
};

let lastMatchedFoods = [];
let currentResult    = null;

function initDecidePage() {
  setupTasteButtons();
  setupOptionGroups();
  setupPickButton();
  setupResultButtons();
  setupResetButton();
}

/* Taste toggle buttons (multi-select) */
function setupTasteButtons() {
  const tasteBtns = document.querySelectorAll('.taste-btn');
  const anyBtn    = document.getElementById('anyTaste');

  tasteBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const taste = btn.dataset.taste;
      if (prefs.tastes.includes(taste)) {
        prefs.tastes = prefs.tastes.filter(t => t !== taste);
        btn.classList.remove('selected');
      } else {
        prefs.tastes.push(taste);
        btn.classList.add('selected');
      }
      updateAnyTasteBtn(anyBtn, tasteBtns);
    });
  });

  anyBtn.addEventListener('click', () => {
    prefs.tastes = [];
    tasteBtns.forEach(b => b.classList.remove('selected'));
    anyBtn.classList.add('active');
  });
}

function updateAnyTasteBtn(anyBtn, tasteBtns) {
  const anySel = !document.querySelector('.taste-btn.selected');
  anyBtn.classList.toggle('active', anySel);
}

/* Single-select option groups */
function setupOptionGroups() {
  setupGroup('spiceGroup',    'spice');
  setupGroup('hungerGroup',   'hunger');
  setupGroup('budgetGroup',   'budget');
}

function setupGroup(groupId, prefKey) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prefs[prefKey] = btn.dataset.value;
    });
  });
}

/* ============================================================
   PICK BUTTON — Filter → Score → Animate → Reveal
   ============================================================ */
function setupPickButton() {
  document.getElementById('pickForMe').addEventListener('click', () => {
    hideResult();
    hideNoMatch();

    const allFoods = loadFoods();
    let matched = filterFoods(allFoods, prefs);

    if (matched.length === 0) {
      showNoMatch();
      return;
    }

    lastMatchedFoods = matched;
    const chosen = selectFood(matched, prefs);
    currentResult = chosen;

    showToast('🎰 Picking your food...', 'info');
    startFoodAnimation(matched, chosen);
  });
}

/* ============================================================
   SLOT MACHINE ANIMATION
   ============================================================ */
function startFoodAnimation(candidates, finalFood) {
  const overlay  = document.getElementById('slotOverlay');
  const slotCard = document.getElementById('slotCard');
  const emoji    = document.getElementById('slotEmoji');
  const name     = document.getElementById('slotName');

  overlay.classList.add('visible');
  slotCard.classList.remove('slowing', 'done');

  let iterations  = 0;
  const totalIter = 20;
  let delay       = 80; // start fast

  function spin() {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    emoji.textContent = pick.emoji || '🍽️';
    name.textContent  = pick.name;
    iterations++;

    if (iterations >= totalIter - 6) {
      slotCard.classList.add('slowing');
      delay = 80 + (iterations - (totalIter - 6)) * 80;
    }

    if (iterations < totalIter) {
      setTimeout(spin, delay);
    } else {
      // Show final result
      emoji.textContent = finalFood.emoji || '🍽️';
      name.textContent  = finalFood.name;
      slotCard.classList.add('done');

      setTimeout(() => {
        overlay.classList.remove('visible');
        showResult(finalFood);
      }, 700);
    }
  }

  spin();
}

/* ============================================================
   RESULT CARD
   ============================================================ */
function showResult(food) {
  const section = document.getElementById('resultSection');
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });

  document.getElementById('resultEmoji').textContent    = food.emoji || '🍽️';
  document.getElementById('resultName').textContent     = food.name;
  document.getElementById('resultPrice').textContent    = `RM${food.price}`;
  document.getElementById('resultDescription').textContent = food.description;

  // Save last recommended food so Food Memories can read it
  localStorage.setItem('ate_last_food', JSON.stringify({ name: food.name, emoji: food.emoji || '🍽️' }));
  const memFoodSpan = document.getElementById('memoryFoodName');
  if (memFoodSpan) memFoodSpan.textContent = food.name;


  // Tags
  const tagsEl = document.getElementById('resultTags');
  const sizeClass = food.mealSize;
  const spicyTag = food.spicyLevel !== 'not-spicy'
    ? `<span class="tag spicy">${getSpicyLabel(food.spicyLevel)}</span>` : '';
  tagsEl.innerHTML = `
    ${getTasteTagsHTML(food)}
    ${spicyTag}
    <span class="tag ${sizeClass}">${getMealSizeLabel(food.mealSize)}</span>
  `;

  // Taste bars
  document.getElementById('resultTasteBars').innerHTML = getTasteBarsHTML(food);

  // Favorite button state
  updateFavButton(food.id);

  // Confetti
  launchConfetti();
}

function hideResult() {
  document.getElementById('resultSection').hidden = true;
}

function updateFavButton(foodId) {
  const btn = document.getElementById('saveToFav');
  if (!btn) return;
  const fav = isFavorited(foodId);
  btn.textContent = fav ? '❤️ Saved!' : '❤️ Save to Favorites';
  btn.classList.toggle('favorited', fav);
}

function setupResultButtons() {
  document.getElementById('tryAgain')?.addEventListener('click', () => {
    if (!lastMatchedFoods.length) return;
    hideResult();
    hideNoMatch();
    const chosen = selectFood(lastMatchedFoods, prefs);
    currentResult = chosen;
    showToast('🎰 Picking again...', 'info');
    startFoodAnimation(lastMatchedFoods, chosen);
  });

  document.getElementById('saveToFav')?.addEventListener('click', () => {
    if (!currentResult) return;
    toggleFavorite(currentResult.id);
    updateFavButton(currentResult.id);
  });

  document.getElementById('changePreferences')?.addEventListener('click', () => {
    hideResult();
    document.querySelector('.preferences-wrapper')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/* ============================================================
   NO MATCH STATE
   ============================================================ */
function showNoMatch() {
  document.getElementById('noMatchSection').hidden = false;
  document.getElementById('noMatchSection').scrollIntoView({ behavior: 'smooth' });
}

function hideNoMatch() {
  document.getElementById('noMatchSection').hidden = true;
}

/* ============================================================
   RESET FILTERS
   ============================================================ */
function setupResetButton() {
  document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
  document.getElementById('relaxFilters')?.addEventListener('click', relaxFilters);
}

function resetFilters() {
  prefs.tastes   = [];
  prefs.spice    = 'any';
  prefs.hunger   = 'normal';
  prefs.budget   = 'any';

  document.querySelectorAll('.taste-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('anyTaste')?.classList.add('active');

  setGroupActive('spiceGroup',    'any');
  setGroupActive('hungerGroup',   'normal');
  setGroupActive('budgetGroup',   'any');

  hideResult();
  hideNoMatch();
  showToast('🔄 Filters reset', '');
}

function relaxFilters() {
  prefs.spice    = 'any';
  prefs.budget   = 'any';

  setGroupActive('spiceGroup',    'any');
  setGroupActive('budgetGroup',   'any');

  hideNoMatch();
  showToast('🔄 Filters relaxed', '');
}

function setGroupActive(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

/* ============================================================
   CONFETTI
   ============================================================ */
function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#ff6b2b','#ffc42a','#27ae60','#e74c3c','#8e44ad','#2980b9'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${Math.random() * 8 + 5}px;
      height: ${Math.random() * 8 + 5}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${Math.random() * 1.5 + 1}s;
      animation-delay: ${Math.random() * .5}s;
    `;
    container.appendChild(piece);
  }
}
