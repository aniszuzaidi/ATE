/**
 * foods-page.js — My Foods page logic
 * Handles: rendering, searching, filtering, add/edit/delete, form
 */

/* ============================================================
   STATE
   ============================================================ */
let foods          = [];
let deleteTargetId = null;
let editingId      = null;
let activeFilters  = { search: '', category: '', spice: '', size: '', budget: '' };

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  foods = loadFoods();
  renderFoods();
  bindFoodGridEvents();
  bindSearchAndFilter();
  bindFormEvents();
  bindModalClose();
  bindDeleteModal();
  bindSliderDisplays();
});

/* ============================================================
   RENDER FOOD CARDS
   ============================================================ */
function renderFoods() {
  const grid  = document.getElementById('foodsGrid');
  const empty = document.getElementById('emptyFoods');
  if (!grid) return;

  const filtered = getFilteredFoods();
  grid.innerHTML = filtered.map(f => renderFoodCard(f, true)).join('');

  empty.hidden = filtered.length > 0;
  grid.hidden  = filtered.length === 0;
}

function getFilteredFoods() {
  return foods.filter(food => {
    const q = activeFilters.search.toLowerCase();
    if (q && !food.name.toLowerCase().includes(q) && !food.category.toLowerCase().includes(q)) return false;
    if (activeFilters.category && food.category !== activeFilters.category) return false;
    if (activeFilters.spice && food.spicyLevel !== activeFilters.spice) return false;
    if (activeFilters.size && food.mealSize !== activeFilters.size) return false;
    if (activeFilters.budget) {
      const p = food.price;
      if (activeFilters.budget === 'under10' && p >= 10) return false;
      if (activeFilters.budget === '10to20' && (p < 10 || p > 20)) return false;
      if (activeFilters.budget === '20to40' && (p < 20 || p > 40)) return false;
      if (activeFilters.budget === '40plus' && p < 40) return false;
    }
    return true;
  });
}

/* ============================================================
   SEARCH & FILTER BINDINGS
   ============================================================ */
function bindSearchAndFilter() {
  document.getElementById('searchInput')?.addEventListener('input', e => {
    activeFilters.search = e.target.value;
    renderFoods();
  });
  document.getElementById('filterCategory')?.addEventListener('change', e => {
    activeFilters.category = e.target.value;
    renderFoods();
  });
  document.getElementById('filterSpice')?.addEventListener('change', e => {
    activeFilters.spice = e.target.value;
    renderFoods();
  });
  document.getElementById('filterSize')?.addEventListener('change', e => {
    activeFilters.size = e.target.value;
    renderFoods();
  });
  document.getElementById('filterBudget')?.addEventListener('change', e => {
    activeFilters.budget = e.target.value;
    renderFoods();
  });
}

/* ============================================================
   FOOD CARD EVENTS (edit / delete / fav)
   ============================================================ */
function bindFoodGridEvents() {
  const grid = document.getElementById('foodsGrid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);

    if (btn.classList.contains('fav-btn')) {
      toggleFavorite(id);
      renderFoods();
    } else if (btn.classList.contains('edit-btn')) {
      openEditModal(id);
    } else if (btn.classList.contains('delete-btn')) {
      openDeleteModal(id);
    }
  });

  // Also bind the "Add Food" button inside empty state
  document.getElementById('openAddFood2')?.addEventListener('click', openAddModal);
}

/* ============================================================
   ADD / EDIT MODAL
   ============================================================ */
function bindModalClose() {
  document.getElementById('openAddFood')?.addEventListener('click', openAddModal);
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  document.getElementById('cancelModal')?.addEventListener('click', closeModal);

  // Close on backdrop click
  document.getElementById('foodModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foodModal')) closeModal();
  });
}

function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Food';
  resetForm();
  showModal();
}

function openEditModal(id) {
  const food = foods.find(f => f.id === id);
  if (!food) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Food';
  fillForm(food);
  showModal();
}

function showModal() {
  const modal = document.getElementById('foodModal');
  modal.hidden = false;
  document.getElementById('foodName').focus();
}

function closeModal() {
  document.getElementById('foodModal').hidden = true;
  editingId = null;
  resetForm();
}

function resetForm() {
  document.getElementById('foodForm').reset();
  document.getElementById('editFoodId').value = '';
  // Reset sliders display
  ['sweet','salty','sour','bitter','spicyT','savory'].forEach(key => {
    const el = document.getElementById(`${key}Val`);
    if (el) el.textContent = '0';
  });
}

function fillForm(food) {
  document.getElementById('editFoodId').value  = food.id;
  document.getElementById('foodName').value     = food.name;
  document.getElementById('foodPrice').value    = food.price;
  document.getElementById('foodCategory').value = food.category;
  document.getElementById('foodSpicyLevel').value = food.spicyLevel;
  document.getElementById('foodMealSize').value = food.mealSize;
  document.getElementById('foodDistance').value = food.distance;
  document.getElementById('foodLocation').value = food.location || '';
  document.getElementById('foodEmoji').value    = food.emoji || '';
  document.getElementById('foodImageUrl').value = food.image || '';
  document.getElementById('foodDescription').value = food.description || '';

  // Sliders
  const t = food.tastes || {};
  setSlider('tasteSweet',  'sweetVal',  t.sweet  || 0);
  setSlider('tasteSalty',  'saltyVal',  t.salty  || 0);
  setSlider('tasteSour',   'sourVal',   t.sour   || 0);
  setSlider('tasteBitter', 'bitterVal', t.bitter || 0);
  setSlider('tasteSpicyT', 'spicyTVal', t.spicy  || 0);
  setSlider('tasteSavory', 'savoryVal', t.savory || 0);
}

function setSlider(inputId, valId, value) {
  const inp = document.getElementById(inputId);
  const val = document.getElementById(valId);
  if (inp) inp.value = value;
  if (val) val.textContent = value;
}

/* Slider live display */
function bindSliderDisplays() {
  const pairs = [
    ['tasteSweet',  'sweetVal'],
    ['tasteSalty',  'saltyVal'],
    ['tasteSour',   'sourVal'],
    ['tasteBitter', 'bitterVal'],
    ['tasteSpicyT', 'spicyTVal'],
    ['tasteSavory', 'savoryVal']
  ];
  pairs.forEach(([inputId, valId]) => {
    document.getElementById(inputId)?.addEventListener('input', e => {
      document.getElementById(valId).textContent = e.target.value;
    });
  });
}

/* ============================================================
   FORM SUBMIT — ADD / EDIT
   ============================================================ */
function bindFormEvents() {
  document.getElementById('foodForm')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;

    const food = buildFoodFromForm();

    if (editingId) {
      editFood(editingId, food);
    } else {
      addFood(food);
    }

    closeModal();
    renderFoods();
  });
}

function validateForm() {
  const name     = document.getElementById('foodName').value.trim();
  const price    = parseFloat(document.getElementById('foodPrice').value);
  const category = document.getElementById('foodCategory').value;
  const distance = parseFloat(document.getElementById('foodDistance').value);

  if (!name) {
    showToast('⚠️ Please enter a food name', 'error');
    document.getElementById('foodName').focus();
    return false;
  }
  if (isNaN(price) || price < 0) {
    showToast('⚠️ Please enter a valid price', 'error');
    document.getElementById('foodPrice').focus();
    return false;
  }
  if (!category) {
    showToast('⚠️ Please select a category', 'error');
    return false;
  }
  if (isNaN(distance) || distance < 0) {
    showToast('⚠️ Please enter a valid distance', 'error');
    document.getElementById('foodDistance').focus();
    return false;
  }
  return true;
}

function buildFoodFromForm() {
  return {
    name:     document.getElementById('foodName').value.trim(),
    price:    parseFloat(document.getElementById('foodPrice').value),
    category: document.getElementById('foodCategory').value,
    tastes: {
      sweet:  parseInt(document.getElementById('tasteSweet').value, 10),
      salty:  parseInt(document.getElementById('tasteSalty').value, 10),
      sour:   parseInt(document.getElementById('tasteSour').value, 10),
      bitter: parseInt(document.getElementById('tasteBitter').value, 10),
      spicy:  parseInt(document.getElementById('tasteSpicyT').value, 10),
      savory: parseInt(document.getElementById('tasteSavory').value, 10)
    },
    spicyLevel:    document.getElementById('foodSpicyLevel').value,
    mealSize:      document.getElementById('foodMealSize').value,
    distance:      parseFloat(document.getElementById('foodDistance').value),
    location:      document.getElementById('foodLocation').value.trim() || 'Unknown location',
    emoji:         document.getElementById('foodEmoji').value.trim() || '🍽️',
    image:         document.getElementById('foodImageUrl').value.trim(),
    description:   document.getElementById('foodDescription').value.trim(),
    isUserCreated: true
  };
}

/* ============================================================
   CRUD OPERATIONS
   ============================================================ */
function addFood(foodData) {
  const newFood = {
    ...foodData,
    id: Date.now()
  };
  foods.push(newFood);
  saveFoods(foods);
  showToast('✅ Food added successfully', 'success');
}

function editFood(id, foodData) {
  const idx = foods.findIndex(f => f.id === id);
  if (idx === -1) return;
  foods[idx] = { ...foods[idx], ...foodData, id };
  saveFoods(foods);
  showToast('✅ Food updated', 'success');
}

function deleteFood(id) {
  foods = foods.filter(f => f.id !== id);
  saveFoods(foods);

  // Remove from favorites too
  const favs = loadFavorites().filter(fId => fId !== id);
  saveFavorites(favs);

  showToast('🗑️ Food deleted', '');
}

/* ============================================================
   DELETE MODAL
   ============================================================ */
function bindDeleteModal() {
  document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDelete')?.addEventListener('click', () => {
    if (deleteTargetId !== null) {
      deleteFood(deleteTargetId);
      renderFoods();
    }
    closeDeleteModal();
  });

  document.getElementById('deleteModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });
}

function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').hidden = false;
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteModal').hidden = true;
}
