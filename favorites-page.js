/**
 * favorites-page.js — Favorites page logic
 */

document.addEventListener('DOMContentLoaded', () => {
  renderFavorites();
  bindFavGridEvents();
});

function renderFavorites() {
  const grid  = document.getElementById('favoritesGrid');
  const empty = document.getElementById('emptyFavorites');
  if (!grid) return;

  const foods = loadFoods();
  const favIds = loadFavorites();
  const favFoods = foods.filter(f => favIds.includes(f.id));

  grid.innerHTML = favFoods.map(f => renderFoodCard(f, false)).join('');

  empty.hidden = favFoods.length > 0;
  grid.hidden  = favFoods.length === 0;
}

function bindFavGridEvents() {
  const grid = document.getElementById('favoritesGrid');
  if (!grid) return;

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn || !btn.classList.contains('fav-btn')) return;
    const id = parseInt(btn.dataset.id, 10);
    toggleFavorite(id);
    renderFavorites();
  });
}
