/**
 * memories.js - Food Memories feature for ATE
 * Polaroid-style food photo journal stored in localStorage.
 */

var MEM_KEY = 'ate_memories';
var pendingMemoryId = null;
var selectedPhotoDataUrl = null;

/* -- Storage -- */
function loadMemories() {
  try {
    var raw = localStorage.getItem(MEM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}
function saveMemories(arr) {
  localStorage.setItem(MEM_KEY, JSON.stringify(arr));
}

/* -- Last recommended food -- */
function getLastFood() {
  try {
    var raw = localStorage.getItem('ate_last_food');
    return raw ? JSON.parse(raw) : { name: 'something delicious', emoji: '\uD83C\uDF7D\uFE0F' };
  } catch(e) {
    return { name: 'something delicious', emoji: '\uD83C\uDF7D\uFE0F' };
  }
}

/* -- Date formatter -- */
function formatMemDate(iso) {
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

/* -- HTML escape -- */
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* -- Toast -- */
function memToast(msg) {
  if (typeof showToast === 'function') { showToast(msg, 'info'); return; }
  var c = document.getElementById('toastContainer');
  if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast toast-info';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

/* -- Compress image via canvas -- */
function compressImage(dataUrl, callback) {
  var img = new Image();
  img.onload = function() {
    var MAX = 800;
    var w = img.width, h = img.height;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', 0.75));
  };
  img.src = dataUrl;
}

/* -- Gallery -- */
var ROTATIONS = [-3, -1.5, -2.5, 1, 2, 3, -1, 2.5, -2, 1.5];

function renderGallery() {
  var memories = loadMemories();
  var gallery  = document.getElementById('memoriesGallery');
  var empty    = document.getElementById('emptyMemories');
  if (!gallery) return;

  if (memories.length === 0) {
    gallery.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  var reversed = memories.slice().reverse();
  gallery.innerHTML = reversed.map(function(mem, i) {
    var rot      = ROTATIONS[i % ROTATIONS.length];
    var dateStr  = formatMemDate(mem.date);
    var caption  = mem.caption
      ? '<div class="polaroid-caption">' + esc(mem.caption) + '</div>'
      : '';
    var badge = '';
    if (mem.ateMatch === true)  badge = '<div class="polaroid-match match">&#128154; ATE Match!</div>';
    if (mem.ateMatch === false) badge = '<div class="polaroid-match nomatch">&#128151; Changed Mind</div>';

    return '<div class="memory-card" style="transform:rotate(' + rot + 'deg)" data-id="' + mem.id + '">' +
      '<button class="memory-delete-btn" onclick="deleteMemory(\'' + mem.id + '\')" title="Delete">&#128465;&#65039;</button>' +
      '<img class="polaroid-img" src="' + mem.photo + '" alt="' + esc(mem.food) + '" loading="lazy" />' +
      '<div class="polaroid-body">' +
        '<div class="polaroid-food">' + mem.emoji + ' ' + esc(mem.food) + '</div>' +
        '<div class="polaroid-date">' + dateStr + '</div>' +
        caption + badge +
      '</div>' +
    '</div>';
  }).join('');
}

/* -- Delete -- */
window.deleteMemory = function(id) {
  if (!confirm('Delete this memory? \uD83E\uDD7A')) return;
  var updated = loadMemories().filter(function(m) { return m.id !== id; });
  saveMemories(updated);
  renderGallery();
  memToast('Memory deleted \uD83D\uDDD1\uFE0F');
};

/* -- Capture modal -- */
function openCaptureModal() {
  var food = getLastFood();
  var tag  = document.getElementById('modalFoodTag');
  if (tag) tag.textContent = 'ATE recommended: ' + food.name + ' ' + food.emoji;
  selectedPhotoDataUrl = null;
  var prev = document.getElementById('photoPreview');
  if (prev) prev.hidden = true;
  var cap = document.getElementById('captionInput');
  if (cap) cap.value = '';
  var fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
  var ci = document.getElementById('cameraInput');
  if (ci) ci.value = '';
  document.getElementById('captureModal').hidden = false;
}

function closeCaptureModal() {
  document.getElementById('captureModal').hidden = true;
  selectedPhotoDataUrl = null;
}

/* -- File select handler -- */
function handleFileSelect(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    compressImage(e.target.result, function(compressed) {
      selectedPhotoDataUrl = compressed;
      var img  = document.getElementById('previewImg');
      var prev = document.getElementById('photoPreview');
      if (img) img.src = compressed;
      if (prev) prev.hidden = false;
    });
  };
  reader.readAsDataURL(file);
}

/* -- Save memory -- */
function saveMemory() {
  if (!selectedPhotoDataUrl) {
    memToast('Please pick a photo first! \uD83D\uDCF7');
    return;
  }
  var food    = getLastFood();
  var caption = (document.getElementById('captionInput').value || '').trim();
  var mem = {
    id:       'mem_' + Date.now(),
    food:     food.name,
    emoji:    food.emoji,
    photo:    selectedPhotoDataUrl,
    date:     new Date().toISOString(),
    caption:  caption,
    ateMatch: null
  };
  var memories = loadMemories();
  memories.push(mem);
  saveMemories(memories);
  pendingMemoryId = mem.id;
  closeCaptureModal();
  openReactionModal();
}

/* -- Reaction modal -- */
function openReactionModal() {
  var modal = document.getElementById('reactionModal');
  modal.hidden = false;
  document.getElementById('reactionStep1').hidden = false;
  document.getElementById('reactionStep2').hidden = true;
  document.getElementById('reactionStep3').hidden = true;
  setTimeout(function() {
    var food = getLastFood();
    var nameEl = document.getElementById('reactionFoodName');
    if (nameEl) nameEl.textContent = food.emoji + ' ' + food.name;
    document.getElementById('reactionStep1').hidden = true;
    document.getElementById('reactionStep2').hidden = false;
  }, 1800);
}

function closeReactionModal() {
  document.getElementById('reactionModal').hidden = true;
  pendingMemoryId = null;
  renderGallery();
}

function handleReaction(ateMatch) {
  if (pendingMemoryId) {
    var memories = loadMemories();
    for (var i = 0; i < memories.length; i++) {
      if (memories[i].id === pendingMemoryId) {
        memories[i].ateMatch = ateMatch;
        break;
      }
    }
    saveMemories(memories);
  }
  var food    = getLastFood();
  var content = document.getElementById('reactionContent');
  if (!content) return;

  if (ateMatch) {
    content.innerHTML =
      '<div class="reaction-badge match">&#128154; MATCH!</div>' +
      '<div class="reaction-headline">It looks absolutely delicious! &#129316;</div>' +
      '<div class="reaction-body">You actually went for the ' + esc(food.name) + ' ATE recommended!<br>Great choice &mdash; ATE knows best! &#127881;</div>';
  } else {
    content.innerHTML =
      '<div class="reaction-badge nomatch">&#128151; YOU CHANGED YOUR MIND!</div>' +
      '<div class="reaction-headline">Going rogue, huh? &#128514;</div>' +
      '<div class="reaction-body">ATE recommended ' + esc(food.name) + ', but you chose something else.<br>It still looks sooo good though! &#128523; No judgment here!</div>';
  }

  document.getElementById('reactionStep2').hidden = true;
  document.getElementById('reactionStep3').hidden = false;
}

/* -- Init -- */
document.addEventListener('DOMContentLoaded', function() {
  var captureBtn  = document.getElementById('captureBtn');
  var modalClose  = document.getElementById('modalClose');
  var cancelBtn   = document.getElementById('btnCancelCapture');
  var btnCamera   = document.getElementById('btnCamera');
  var btnUpload   = document.getElementById('btnUpload');
  var cameraInput = document.getElementById('cameraInput');
  var fileInput   = document.getElementById('fileInput');
  var saveBtn     = document.getElementById('btnSaveMemory');
  var btnYes      = document.getElementById('btnYes');
  var btnNo       = document.getElementById('btnNo');
  var closeReact  = document.getElementById('btnCloseReaction');

  if (captureBtn)  captureBtn.addEventListener('click', openCaptureModal);
  if (modalClose)  modalClose.addEventListener('click', closeCaptureModal);
  if (cancelBtn)   cancelBtn.addEventListener('click', closeCaptureModal);
  if (saveBtn)     saveBtn.addEventListener('click', saveMemory);

  if (btnCamera && cameraInput) {
    btnCamera.addEventListener('click', function() { cameraInput.click(); });
    cameraInput.addEventListener('change', function() { handleFileSelect(this.files[0]); });
  }
  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() { handleFileSelect(this.files[0]); });
  }
  if (btnYes) btnYes.addEventListener('click', function() { handleReaction(true); });
  if (btnNo)  btnNo.addEventListener('click',  function() { handleReaction(false); });
  if (closeReact) closeReact.addEventListener('click', closeReactionModal);

  renderGallery();
});
