/**
 * wheel.js - Centered Preference Wheel UI logic for ATE
 */

(function() {
  var activeSection = null;

  var SECTIONS = {
    craving: { panel: 'panel-craving', badge: 'badge-craving', hub: 'Craving' },
    spice:   { panel: 'panel-spice',   badge: 'badge-spice',   hub: 'Spice'   },
    hunger:  { panel: 'panel-hunger',  badge: 'badge-hunger',  hub: 'Hunger'  },
    budget:  { panel: 'panel-budget',  badge: 'badge-budget',  hub: 'Budget'  }
  };

  function getBadgeText(section) {
    if (section === 'craving') {
      var selected = [];
      document.querySelectorAll('.taste-btn.selected').forEach(function(b) {
        selected.push(b.getAttribute('data-taste'));
      });
      if (selected.length === 0) return 'Any';
      var labels = { sweet:'Sweet', salty:'Salty', sour:'Sour', bitter:'Bitter', spicy:'Spicy', savory:'Savory' };
      return selected.slice(0, 2).map(function(t){ return labels[t] || t; }).join('+') + (selected.length > 2 ? '...' : '');
    }
    if (section === 'spice') {
      var btn = document.querySelector('#spiceGroup .option-btn.active');
      if (!btn) return '';
      var map = { 'not-spicy': 'No spice', mild: 'Mild', medium: 'Medium', 'very-spicy': 'Hot!', any: 'Any' };
      return map[btn.getAttribute('data-value')] || btn.getAttribute('data-value');
    }
    if (section === 'hunger') {
      var btn = document.querySelector('#hungerGroup .option-btn.active');
      if (!btn) return '';
      var map = { light: 'Light', normal: 'Normal', heavy: 'Very hungry' };
      return map[btn.getAttribute('data-value')] || btn.getAttribute('data-value');
    }
    if (section === 'budget') {
      var btn = document.querySelector('#budgetGroup .option-btn.active');
      if (!btn) return '';
      var map = { under10: '<RM10', '10to20': 'RM10-20', '20to40': 'RM20-40', '40plus': 'RM40+', any: 'Any' };
      return map[btn.getAttribute('data-value')] || btn.getAttribute('data-value');
    }
    return '';
  }

  function updateBadge(section) {
    var el = document.getElementById(SECTIONS[section].badge);
    if (!el) return;
    el.textContent = getBadgeText(section);
  }

  function updateAllBadges() {
    Object.keys(SECTIONS).forEach(updateBadge);
  }

  function showPanel(section) {
    Object.values(SECTIONS).forEach(function(s) {
      var p = document.getElementById(s.panel);
      if (p) p.hidden = true;
    });

    document.querySelectorAll('.wheel-slice-g').forEach(function(g) {
      g.classList.remove('active-slice');
    });

    activeSection = section;
    var panel = document.getElementById(SECTIONS[section].panel);
    if (panel) panel.hidden = false;

    var sliceG = document.querySelector('[data-section="' + section + '"]');
    if (sliceG) sliceG.classList.add('active-slice');

    var hubSub = document.getElementById('hubSub');
    if (hubSub) hubSub.textContent = SECTIONS[section].hub;
  }

  function mirrorWheelToSlot() {
    var bg = document.getElementById('slotWheelBg');
    var src = document.getElementById('prefWheelWrap');
    if (!bg || !src) return;
    bg.innerHTML = src.innerHTML;
  }

  function initWheel() {
    document.querySelectorAll('.wheel-slice-g').forEach(function(g) {
      var section = g.getAttribute('data-section');
      g.addEventListener('click', function() { showPanel(section); });
      g.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPanel(section); }
      });
    });

    // Taste buttons listeners
    document.querySelectorAll('.taste-btn').forEach(function(b) {
      b.addEventListener('click', function() { setTimeout(function() { updateBadge('craving'); }, 10); });
    });
    var anyTaste = document.getElementById('anyTaste');
    if (anyTaste) anyTaste.addEventListener('click', function() { setTimeout(function() { updateBadge('craving'); }, 10); });

    // Option groups listeners
    ['spiceGroup', 'hungerGroup', 'budgetGroup'].forEach(function(id) {
      var section = id.replace('Group', '');
      var g = document.getElementById(id);
      if (g) g.addEventListener('click', function() { setTimeout(function() { updateBadge(section); }, 10); });
    });

    var pickBtn = document.getElementById('pickForMe');
    if (pickBtn) {
      pickBtn.addEventListener('click', function() {
        mirrorWheelToSlot();
      }, true);
    }

    updateAllBadges();
    
    // Set Craving panel visible by default on load
    showPanel('craving');
  }

  window.updateWheelBadges = updateAllBadges;
  document.addEventListener('DOMContentLoaded', initWheel);
})();
