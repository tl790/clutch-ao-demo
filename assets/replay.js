// Static replay runtime (no server calls). Frozen screens move on with their main button. The cart is live (bundles,
// ADD from the product lists, remove, debit card design) and every later screen was captured with ALL products, so
// this file hides what is not in the live cart and writes in the typed opening deposits and the funding choice.
(function () {
  var R = window.REPLAY || {}; var D = window.REPLAY_DATA || {}; var T = window.REPLAY_TEMPLATES || {};
  var KEY = 'replay-cart-' + (D.recipe || D.persona || '');
  var file = function (name) { var s = (R.screens || []).filter(function (x) { return x.name === name; })[0]; return s ? s.file : null; };
  var byFile = function (pred) { var s = (R.screens || []).filter(pred)[0]; return s ? s.file : null; };
  // Absolute, so calls from the phone wrapper (arrow keys) resolve against this screen, not the wrapper.
  var go = function (f) { if (f) location.href = new URL(f, location.href).href; };
  var txt = function (el) { return (el.innerText || el.textContent || '').trim(); };
  var fresh = function () { return { items: [], credit: [], amounts: {}, funding: null }; };
  var load = function () { try { var s = JSON.parse(sessionStorage.getItem(KEY)); if (s) { s.amounts = s.amounts || {}; return s; } } catch (e) { /* private mode */ } return fresh(); };
  var save = function (s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };
  var product = function (id) { return (D.products || []).filter(function (p) { return p.id === id; })[0]; };
  var productByName = function (name) { return (D.products || []).filter(function (p) { return p.name.toLowerCase() === String(name).trim().toLowerCase(); })[0]; };
  var design = function (id) { return (D.debitDesigns || []).filter(function (d) { return d.id === id; })[0] || (D.debitDesigns || [])[0]; };
  // Card names come from the recipe data (a brand can rename the demo's debit designs and credit cards).
  var reEsc = function (x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var DEBIT_NAMES = (D.debitDesigns || []).map(function (d) { return reEsc(d.name); }).join('|') || 'Classic|Gold|Signature';
  var CREDIT = D.creditCards || [{ id: 'visa-classic', name: 'Visa Classic' }, { id: 'visa-gold', name: 'Visa Gold' }, { id: 'visa-platinum', name: 'Visa Platinum' }, { id: 'visa-signature', name: 'Visa Signature' }];
  var creditName = function (id) { var c = CREDIT.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; };
  var money = function (n) { return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  // The online banking funding line was captured with the first account; swap in the account chosen on the transfer screen.
  var existingLine = function (line, st) {
    var meta = {}; try { meta = JSON.parse(T['choiceMeta:existing-account'] || '{}'); } catch (e) { /* none */ }
    var chosen = meta[((st.choices || {})['existing-account']) || 'a0']; var first = meta.a0; if (!chosen || !first || chosen === first) return line;
    var d4 = function (m) { return (m.match(/(\d{4})(?!.*\d{4})/) || [])[1]; }; var word = function (m) { return (m.match(/^([A-Za-z][A-Za-z ]+?)\s*•/) || [])[1]; };
    var out = line; if (d4(first) && d4(chosen)) out = out.split(d4(first)).join(d4(chosen));
    if (word(first) && word(chosen)) out = out.replace(new RegExp(word(first), 'i'), function (m) { return m === m.toUpperCase() ? word(chosen).toUpperCase() : word(chosen).charAt(0) + word(chosen).slice(1).toLowerCase(); });
    return out;
  };
  var num = function (v) { var n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };
  var texts = function (root) { var out = []; var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (var n = w.nextNode(); n; n = w.nextNode()) out.push(n); return out; };
  var replaceText = function (root, from, to) { if (!root || !from) return; texts(root).some(function (n) { if (n.nodeValue.trim() === from) { n.nodeValue = n.nodeValue.replace(from, to); return true; } return false; }); };
  var replaceAllText = function (root, re, fn) { texts(root).forEach(function (n) { if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, fn); }); };
  // An amount left empty is that account's minimum opening deposit (the brand's data); a typed amount stays as typed.
  var typedAmt = function (st, id) { var v = st.amounts[id]; return v != null && String(v).trim() !== '' ? v : null; };
  var minOf = function (id) { var p = product(id); return p && p.min ? Number(p.min) : 0; };
  var amountOf = function (st, id) { var v = typedAmt(st, id); return v != null ? num(v) : minOf(id); };
  var cartIds = function (st) { var ids = D.requiredShare ? [D.requiredShare] : []; st.items.forEach(function (x) { if (ids.indexOf(x.productId) < 0) ids.push(x.productId); }); return ids; };
  var total = function (st) { return cartIds(st).reduce(function (t, id) { return t + amountOf(st, id); }, 0); };

  // ---- Bundle switches (Tim 2026-11-04 batch): defaults from the brand's ao-overlay.json "enabledBundles" (recipe data),
  // changed only from the ?setup=1 panel, kept in this browser per brand. A bundle switched off is gone from the tiles,
  // the cart and Review; at least one stays on. ----
  var SETUP_KEY = 'replay-bundles-' + (((window.REPLAY_BRAND || {}).name) || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  var setupOn = (function () { var on = /[?&]setup=1(&|$)/.test(location.search); try { on = on || /[?&]setup=1(&|$)/.test(window.top.location.search); } catch (e) { /* other origin */ } return on; })();
  var readSwitches = function () { try { return JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') || {}; } catch (e) { return {}; } };
  var bundleOn = function (b, sw) { sw = sw || readSwitches(); return b.key && sw[b.key] !== undefined ? !!sw[b.key] : b.enabled !== false; };
  // ---- Existing members (Tim 2026-11-04 fix 2): the Membership group choice decides the path. "new" = New membership
  // (the required share is added and locked, a new member number), "current" = the existing membership number (no share
  // account anywhere, the number stays). Only that path's bundles are offered. No choice yet = the existing number. ----
  var EVERY_BUNDLE = (D.bundles || []).slice();
  var MPATH = D.memberNumber ? (load().membership || D.ownPath || 'current') : null;
  if (MPATH) { D.requiredShare = MPATH === 'new' ? D.shareId : null; D.bundles = EVERY_BUNDLE.filter(function (b) { return !b.path || b.path === MPATH; }); }
  var ALL_BUNDLES = (D.bundles || []).slice();
  var applySwitches = function () {
    var sw = readSwitches(); var on = ALL_BUNDLES.filter(function (b) { return bundleOn(b, sw); }); if (!on.length && ALL_BUNDLES.length) on = [ALL_BUNDLES[0]];
    D.bundles = on; var offNames = EVERY_BUNDLE.filter(function (b) { return on.indexOf(b) < 0; }).map(function (b) { return b.name; });
    // Tiles: each "Choose this bundle" card names its bundle.
    document.querySelectorAll('[data-testid^="demo-bundle-choose-"]').forEach(function (btn) {
      var tile = btn; while (tile.parentElement && !tile.querySelector('h3')) tile = tile.parentElement;
      var nm = txt(tile.querySelector('h3') || tile); tile.style.display = offNames.some(function (n) { return nm.indexOf(n) >= 0; }) ? 'none' : '';
    });
    // Cart: a switched-off bundle's accounts and card leave it.
    var st = load(); if (st.bundle && offNames.indexOf(st.bundle) >= 0) { var b0 = ALL_BUNDLES.filter(function (b) { return b.name === st.bundle; })[0]; st.items = st.items.filter(function (x) { return x.from !== st.bundle; }); st.credit = st.credit.filter(function (c) { return b0.creditCards.indexOf(c) < 0; }); st.bundle = null; save(st); }
  };
  applySwitches();
  if (setupOn && ALL_BUNDLES.length) {
    var panel = document.createElement('div'); panel.setAttribute('data-replay-setup', ''); panel.setAttribute('data-replay-own', ''); panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Demo setup: bundles');
    panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:4000;background:#fff;border:1px solid #d0d5dd;border-radius:12px;padding:10px 14px;box-shadow:0 8px 24px rgba(16,24,40,.18);font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;max-width:280px';
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Demo setup · bundles</div>';
    var note = document.createElement('div'); note.style.cssText = 'color:#b42318;font-size:12px;margin-top:4px;display:none'; note.textContent = 'At least one bundle stays on.';
    ALL_BUNDLES.forEach(function (b) {
      var row = document.createElement('label'); row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = bundleOn(b); cb.setAttribute('data-bundle-key', b.key || b.name);
      cb.addEventListener('change', function () {
        var sw = readSwitches(); var onNow = ALL_BUNDLES.filter(function (x) { return x !== b && bundleOn(x, sw); });
        if (!cb.checked && !onNow.length) { cb.checked = true; note.style.display = ''; return; } note.style.display = 'none';
        sw[b.key || b.name] = cb.checked; try { localStorage.setItem(SETUP_KEY, JSON.stringify(sw)); } catch (e) { note.textContent = 'This browser blocks storage; the switch lasts for this screen only.'; note.style.display = ''; }
        applySwitches(); document.dispatchEvent(new Event('replay-cart'));
      });
      row.appendChild(cb); row.appendChild(document.createTextNode(b.name)); panel.appendChild(row);
    });
    panel.appendChild(note); document.body.appendChild(panel);
  }
  var inCart = function (st, id) { return (D.requiredShare && id === D.requiredShare) || st.items.some(function (x) { return x.productId === id; }); };

  // ---- Desktop <-> phone switch (view.html): the wrapper takes a snapshot of this screen, opens the same screen in the
  // other set, and that screen restores it: typed fields, scroll position, the open cart / features dialog / sheet.
  var SWITCH_KEY = 'replay-switch'; var here = location.pathname.split('/').pop();
  var arriving = (function () { try { var a = JSON.parse(sessionStorage.getItem(SWITCH_KEY)); if (a && a.file === here && a.recipe === (R.recipe || '')) { sessionStorage.removeItem(SWITCH_KEY); return a; } } catch (e) { /* private mode */ } return null; })();
  var openNow = {}; var reopen = {}; // what is open on this screen, and how to open it again after a switch
  var fieldList = function () {
    var seen = {}; return Array.prototype.filter.call(document.querySelectorAll('input, textarea, select'), function (el) { return !/^(hidden|submit|button|file|image|reset)$/.test(el.type) && !(el.closest('[data-replay-item]') && el.closest('[data-replay-item]').style.display === 'none'); }).map(function (el) {
      var label = (el.labels && el.labels[0] && txt(el.labels[0])) || el.getAttribute('aria-label') || el.name || el.placeholder || '';
      var key = el.tagName + ':' + (el.type || '') + ':' + label; seen[key] = (seen[key] || 0) + 1; return { key: key + '#' + seen[key], el: el };
    });
  };
  window.REPLAY_SNAPSHOT = function () {
    var fields = {}; fieldList().forEach(function (f) { fields[f.key] = /^(checkbox|radio)$/.test(f.el.type) ? (f.el.checked ? 'on' : '') : f.el.value; });
    var se = document.scrollingElement || document.documentElement; var max = se.scrollHeight - se.clientHeight;
    return { recipe: R.recipe || '', file: here, fields: fields, scroll: max > 0 ? se.scrollTop / max : 0, open: openNow };
  };
  var restoreSwitch = function () {
    if (!arriving) return;
    fieldList().forEach(function (f) {
      var v = arriving.fields[f.key]; if (v === undefined) return;
      if (/^(checkbox|radio)$/.test(f.el.type)) { if (f.el.checked === (v === 'on')) return; f.el.checked = v === 'on'; } else { if (f.el.value === v) return; f.el.value = v; }
      f.el.dispatchEvent(new Event('input', { bubbles: true })); f.el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    var o = arriving.open || {};
    if (o.cart && reopen.cart) reopen.cart(); else if (o.features && reopen.features) reopen.features(o.features); else if (o.sheet && reopen.sheet) reopen.sheet(o.sheet); else if (o.handoff && reopen.handoff) reopen.handoff(o.handoff);
    var scroll = function () { var se = document.scrollingElement || document.documentElement; se.scrollTop = arriving.scroll * (se.scrollHeight - se.clientHeight); };
    scroll(); setTimeout(scroll, 120); setTimeout(scroll, 400); if (document.fonts && document.fonts.ready) document.fonts.ready.then(scroll);
  };
  setTimeout(restoreSwitch, 0); // after the rest of this file has wired the screen up

  // A fresh start (first screen) clears the cart from an earlier run-through (not when arriving from a view switch).
  if (!arriving && R.screens && R.screens[0] && here === R.screens[0].file) { try { sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  document.querySelectorAll('[required]').forEach(function (el) { el.removeAttribute('required'); });
  document.querySelectorAll('input[readonly]').forEach(function (el) { if (!el.value) el.removeAttribute('readonly'); });
  var next = document.querySelector('[data-replay-next]');
  if (next) { next.removeAttribute('disabled'); next.removeAttribute('aria-disabled'); }

  // Where "next" leads from this screen (the funding screen branches on the choice).
  var nextFile = function () {
    if (R.name === 'funding-type') { var st = load(); return st.funding === 'bank' || st.funding === 'existing' ? byFile(function (s) { return s.branch === st.funding; }) : file('card-entry'); }
    if (R.name === 'eligibility') return file('review'); // side screen: Next goes back to Review
    // Clutch FCU members: the other membership path lives in the sibling recipe (r3a keeps the number, r3b is a new
    // membership); its cart starts with the same choice.
    if (R.name === 'membership-choice' && D.membershipSibling && D.siblingAccountTypes && D.siblingAccountTypes[R.variant]) {
      var chosen = load().membership || D.ownPath || 'current';
      if (chosen !== D.ownPath) { try { sessionStorage.setItem('replay-cart-' + D.membershipSibling, JSON.stringify({ items: [], credit: [], amounts: {}, funding: null, membership: chosen })); } catch (e) { /* private mode */ } return '../../' + D.membershipSibling + '/' + R.variant + '/' + D.siblingAccountTypes[R.variant]; }
    }
    return R.next;
  };
  var guard = null; // a screen can block its main button (e.g. enrollment rules)
  var forward = function (force) { if (!force && guard && !guard()) return; go(nextFile()); };

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('a, button, [role="button"], [role="radio"], label, [data-replay-next], [data-replay-goto]') : null;
    if (!t) return;
    if (t.closest('[data-replay-cart],[data-replay-own]')) return;
    var gotoEl = t.closest('[data-replay-goto]') || (e.target.closest && e.target.closest('[data-replay-goto]'));
    if (gotoEl) {
      e.preventDefault(); e.stopPropagation(); var f = gotoEl.getAttribute('data-replay-goto'); if (!/\.html$/.test(f)) f = file(f) || f; // templates name the screen
      if (R.variant === 'desktop' && /lending/.test(f)) window.open(new URL('../../view.html?v=desktop&r=' + (R.recipe || '') + '&s=' + f, location.href).href, '_blank'); else go(f); return;
    }
    if (t.hasAttribute('data-replay-link')) return;
    if (t.closest('[data-replay-dd]')) { e.preventDefault(); forward(true); return; }
    if (t.hasAttribute('data-replay-next') || (next && next.contains(t))) { e.preventDefault(); forward(false); return; }
    // Replica close / back buttons on side screens return to Thank You.
    if (/^dd-/.test(R.name || '') && /close|back/i.test(t.getAttribute('aria-label') || '')) { e.preventDefault(); go(R.thankYou); return; }
    if (t.tagName === 'A' && (/^(\/|https?:)/.test(t.getAttribute('href') || '') || t.hasAttribute('data-replay-nolink'))) e.preventDefault();
  }, true);

  // ---- Previous / next: arrow keys and two small controls ----
  var typing = function () { var a = document.activeElement; return a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  var back = function () { history.back(); };
  // After the wallet (or "We've got your application.") the story goes on to the Activation Agent and the branch portal
  // (site/<id>/story/; D.story from make-data.cjs: where it starts, which screen leads in, the screen B R opens).
  var SD = D.story || null; var STORY = SD ? '../story/' : null;
  var storyEntry = function () { return !!SD && R.name === SD.from; };
  window.REPLAY_NAV = function (dir) { if (dir < 0) back(); else if (nextFile()) forward(true); else if (storyEntry()) go(STORY + SD.first + '.html'); };
  // Two-key pairs, the same as the live demo (Tim 2026-11-13): A G = Activation Agent, B C = branch Conversations,
  // B R = branch Recommendations, O B = online banking. The switch is announced for a moment first.
  var PAIRS = { ag: ['Activation Agent', 'agent-ready'], bc: ['Branch portal: Conversations', 'branch-conversations'], br: ['Branch portal: Recommendations', SD ? SD.recommendations : 'branch-recommendations'], ob: [file('online-banking') ? 'Online banking' : 'Account opening', null] };
  if (SD && SD.kind !== 'agent') delete PAIRS.ag;
  var homeFile = function () { return file('online-banking') || (SD ? file(SD.from) : null); };
  var switchToast = function (label, then) {
    var t = document.createElement('div'); t.setAttribute('role', 'status'); t.setAttribute('data-replay-toast', ''); t.textContent = 'Switching to ' + label;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483001;padding:12px 20px;border-radius:999px;background:rgb(16 24 40 / 92%);box-shadow:0 6px 20px rgb(16 24 40 / 30%);color:#fff;font:600 15px/1.3 system-ui,sans-serif;white-space:nowrap';
    document.body.appendChild(t); setTimeout(then, 600);
  };
  window.REPLAY_SWITCH = function (pair) {
    var p = PAIRS[pair]; if (!p || !STORY) return;
    var target = p[1] ? STORY + p[1] + '.html' : homeFile(); if (!p[1] && (!target || target === here)) return;
    switchToast(p[0], function () { go(target); });
  };
  var pairFirst = ''; var pairAt = 0;
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey || typing()) return;
    var k = (e.key || '').toLowerCase(); if (!/^[a-z]$/.test(k)) { pairFirst = ''; return; }
    var pair = pairFirst + k; var inTime = Date.now() - pairAt <= 1000; pairFirst = k; pairAt = Date.now();
    if (inTime && PAIRS[pair]) { pairFirst = ''; e.preventDefault(); window.REPLAY_SWITCH(pair); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey || typing()) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); window.REPLAY_NAV(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); window.REPLAY_NAV(1); }
  });
  // H shows/hides the wrapper's previous/next bar (the bar lives outside the page, in desktop.html / phone.html).
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey || typing() || (e.key !== 'h' && e.key !== 'H')) return;
    try { if (window.parent !== window && window.parent.REPLAY_TOGGLE_BAR) { e.preventDefault(); window.parent.REPLAY_TOGGLE_BAR(); } } catch (err) { /* opened on its own */ }
  });
  // G then L (within 1 s) returns to the Demo Library (Tim 2026-11-04 batch): a relative link (works under any base path
  // and offline), after a confirm; the cart is cleared, as the confirm says.
  var gAt = 0;
  window.REPLAY_LIBRARY = function () {
    if (!window.confirm('Return to the demo library? Your cart will be lost.')) return;
    try { Object.keys(sessionStorage).forEach(function (k) { if (/^replay-(cart|switch)/.test(k)) sessionStorage.removeItem(k); }); } catch (err) { /* private mode */ }
    var lib = new URL('../../index.html', location.href).href; try { window.top.location.href = lib; } catch (err) { location.href = lib; }
  };
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey || typing()) return;
    var k = (e.key || '').toLowerCase(); if (k === 'g') { gAt = Date.now(); return; }
    if (k === 'l' && gAt && Date.now() - gAt <= 1000) { gAt = 0; e.preventDefault(); window.REPLAY_LIBRARY(); return; }
    gAt = 0;
  });
  // Phone fields (Tim 2026-11-04 batch): formatted as typed, (xxx) xxx-xxxx, any 10 digits.
  var fmtPhone = function (d) { d = d.slice(0, 10); if (!d) return ''; if (d.length < 4) return '(' + d; if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3); return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6); };
  Array.prototype.forEach.call(document.querySelectorAll('input'), function (inp) {
    if (inp.type !== 'tel' && !/phone/i.test((inp.id || '') + ' ' + (inp.name || ''))) return;
    inp.removeAttribute('pattern'); inp.removeAttribute('maxlength'); var was = inp.value.replace(/\D/g, '');
    inp.addEventListener('input', function (e) {
      var d = inp.value.replace(/\D/g, '');
      // Backspace over a bracket, space or dash takes the digit before it.
      if (e.inputType === 'deleteContentBackward' && d === was) d = d.slice(0, -1);
      was = d.slice(0, 10); inp.value = fmtPhone(d);
    });
  });
  // Verification code and SSN last 4 (input-otp boxes): any 4 digits fill the boxes; nothing is checked, Continue is
  // never blocked (Tim 2026-11-04 batch). They open already filled (Tim 2026-11-13: the code 1234, the SSN with the
  // persona's last 4, the same as the live demo's personas), so Continue or the right arrow moves on without typing; a
  // view switch brings back what was typed.
  var SSN_LAST4 = { 'non-member/approved': '1288', 'non-member/step-up': '4417', 'non-member/review': '3064', 'non-member/declined': '0712', member: '5310' };
  var prefillOf = function (inp) {
    if (/ssn/i.test(inp.id || '')) return SSN_LAST4[D.persona] || SSN_LAST4[String(D.persona || '').split('/')[0]] || '';
    return /otp|code/i.test(inp.id || '') ? '1234' : '';
  };
  Array.prototype.forEach.call(document.querySelectorAll('input[data-input-otp]'), function (inp) {
    var box = inp.closest('[data-input-otp-container]'); if (!box) return;
    var prefilled = !inp.value && prefillOf(inp); if (prefilled) inp.value = prefilled;
    // The first digit typed (or a backspace) into the untouched boxes starts over instead of being refused as a fifth digit.
    inp.addEventListener('beforeinput', function (e) {
      if (!prefilled || inp.value !== prefilled) return; prefilled = '';
      if (/^insert/.test(e.inputType || '') && e.data == null) { inp.value = ''; return; }
      e.preventDefault(); inp.value = String(e.data || '').replace(/\D/g, '').slice(0, 4); paint();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (err) { /* not selectable */ }
    });
    // WebKit fires no beforeinput into a full password field (the SSN): the key itself starts over there.
    inp.addEventListener('keydown', function (e) {
      if (!prefilled || inp.value !== prefilled || e.altKey || e.metaKey || e.ctrlKey || !/^(\d|Backspace|Delete)$/.test(e.key)) return;
      prefilled = ''; e.preventDefault(); inp.value = /^\d$/.test(e.key) ? e.key : ''; paint();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (err) { /* not selectable */ }
    });
    var slots = Array.prototype.filter.call(box.querySelectorAll('div'), function (d) { return /SlotDiv/.test(d.className) && !/FakeCaret/.test(d.className); });
    var show = inp.type !== 'password';
    var paint = function () {
      var v = inp.value;
      slots.forEach(function (s, i) {
        s.querySelectorAll('[class*="FakeCaret"]').forEach(function (c) { c.style.display = v.length || i ? 'none' : ''; });
        var span = s.querySelector('[data-replay-otp]'); if (!span) { span = document.createElement('span'); span.setAttribute('data-replay-otp', ''); span.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font:600 28px/1 inherit;color:#111827'; s.appendChild(span); s.style.display = s.style.display || ''; }
        span.textContent = v[i] ? (show ? v[i] : '•') : '';
      });
    };
    inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); paint(); });
    var eye = box.parentElement && box.parentElement.querySelector('button[aria-label*="password" i]');
    if (eye && inp.type === 'password') { eye.setAttribute('data-replay-own', ''); eye.addEventListener('click', function (e) { e.preventDefault(); show = !show; eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); paint(); }); }
    paint();
  });
  // "\\" switches between the desktop and phone views (the wrapper does the switch).
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey || typing() || e.key !== '\\') return;
    try { if (window.parent !== window && window.parent.REPLAY_TOGGLE_VIEW) { e.preventDefault(); window.parent.REPLAY_TOGGLE_VIEW(); } } catch (err) { /* opened on its own */ }
  });
  // Hold ? (Shift + /): the keyboard shortcuts that work on this screen, in a small dark sheet that goes on release. The
  // wrapper (view.html) shows it over the whole window when it can; opened on its own, the screen shows it.
  var inWrapper = function (fn) { try { return window.parent !== window && typeof window.parent[fn] === 'function'; } catch (err) { return false; } };
  window.REPLAY_SHORTCUTS = function () {
    var move = []; if (nextFile() || storyEntry()) move.push({ keys: ['→'], label: storyEntry() ? 'Continue into the story' : 'Next screen' }); move.push({ keys: ['←'], label: 'Previous screen' });
    var jump = []; if (STORY) Object.keys(PAIRS).forEach(function (k) {
      if (k === 'ob' && (!homeFile() || homeFile() === here)) return;
      jump.push({ keys: k.toUpperCase().split(''), then: true, label: k === 'br' && SD.kind === 'review' ? 'Branch portal: the application in manual review' : PAIRS[k][0] });
    });
    var view = R.variant; try { if (inWrapper('REPLAY_VIEW')) view = window.parent.REPLAY_VIEW(); } catch (err) { /* opened on its own */ }
    var controls = [];
    if (inWrapper('REPLAY_TOGGLE_VIEW')) controls.push({ keys: ['\\'], label: view === 'phone' ? 'Switch to the desktop view' : 'Switch to the phone view' });
    if (inWrapper('REPLAY_TOGGLE_BAR')) controls.push({ keys: ['H'], label: 'Show or hide the previous / next bar' });
    controls.push({ keys: ['G', 'L'], then: true, label: 'Back to the demo library' });
    return [{ title: 'Move through the demo', items: move }, { title: 'Jump to', items: jump }, { title: 'Demo controls', items: controls }, { title: 'Help', items: [{ keys: ['?'], label: 'Hold to show this list' }] }].filter(function (g) { return g.items.length; });
  };
  // The sheet's look is shared by the screens, the story screens and the wrapper (the live demo's sheet looks the same).
  function renderKeySheet(doc, groups) {
    var el = function (tag, css, text) { var x = doc.createElement(tag); x.style.cssText = css; if (text != null) x.textContent = text; return x; };
    var box = el('div', 'position:fixed;top:50%;left:50%;z-index:2147483002;box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;transform:translate(-50%,-50%);padding:18px 20px;border-radius:14px;background:rgb(16 24 40 / 96%);box-shadow:0 12px 32px rgb(16 24 40 / 35%);color:#fff;font:14px/1.35 system-ui,sans-serif;text-align:left;pointer-events:none');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Keyboard shortcuts'); box.setAttribute('data-replay-key-sheet', '');
    box.appendChild(el('div', 'margin:0 0 12px;font:600 16px/1.3 system-ui,sans-serif', 'Keyboard shortcuts'));
    groups.forEach(function (g) {
      box.appendChild(el('div', 'margin:14px 0 6px;color:rgb(255 255 255 / 60%);font:600 11px/1.3 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase', g.title));
      g.items.forEach(function (s) {
        var row = el('div', 'display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:baseline;padding:3px 0');
        var keys = el('span', 'white-space:nowrap;color:rgb(255 255 255 / 60%);font-size:12px');
        s.keys.forEach(function (k, i) { if (i) keys.appendChild(doc.createTextNode(s.then ? ' then ' : ' + ')); keys.appendChild(el('kbd', 'display:inline-block;min-width:12px;padding:1px 6px;border:1px solid rgb(255 255 255 / 35%);border-radius:4px;color:#fff;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center', k)); });
        row.appendChild(keys); row.appendChild(el('span', '', s.label)); box.appendChild(row);
      });
    });
    return box;
  }
  var keySheet = null;
  var showKeySheet = function () {
    if (inWrapper('REPLAY_KEY_SHEET')) { window.parent.REPLAY_KEY_SHEET(window.REPLAY_SHORTCUTS()); return; }
    if (!keySheet) { keySheet = renderKeySheet(document, window.REPLAY_SHORTCUTS()); document.body.appendChild(keySheet); }
  };
  var hideKeySheet = function () {
    if (inWrapper('REPLAY_KEY_SHEET')) window.parent.REPLAY_KEY_SHEET(null);
    if (keySheet) { keySheet.remove(); keySheet = null; }
  };
  document.addEventListener('keydown', function (e) {
    if (e.key !== '?' || e.altKey || e.metaKey || e.ctrlKey || typing()) return;
    e.preventDefault(); showKeySheet();
  }, true);
  document.addEventListener('keyup', function (e) { if (e.key === '?' || e.key === '/' || e.key === 'Shift') hideKeySheet(); }, true);
  window.addEventListener('blur', hideKeySheet);
  // Tell the wrapper which screen is showing (its bar shows the position and keeps the address current).
  try { if (window.parent !== window && window.parent.REPLAY_SCREEN) window.parent.REPLAY_SCREEN({ file: here, variant: R.variant, name: R.name, next: !!nextFile() || R.name === 'funding-type' || storyEntry(), index: (R.screens || []).filter(function (x) { return !x.side; }).map(function (x) { return x.file; }).indexOf(location.pathname.split('/').pop()), count: (R.screens || []).filter(function (x) { return !x.side; }).length, title: document.title }); } catch (err) { /* opened on its own */ }
  if (R.auto) setTimeout(function () { go(nextFile()); }, R.auto);

  // ---- Later screens: show only what is in the live cart ----
  var capturedTotal = ((T.reviewTotalFilled || '').match(/\$[\d,]+\.\d\d/) || [])[0];
  var setArt = function (el, d) {
    el.setAttribute('data-testid', 'demo-card-art-debit-' + d.id); el.style.backgroundImage = 'url("../../assets/' + d.image + '")'; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
    var label = el.getAttribute('aria-label'); if (label) el.setAttribute('aria-label', label.replace(new RegExp('\\b(' + DEBIT_NAMES + ')\\b'), d.name));
    var img = el.tagName === 'IMG' ? el : null; if (img) img.src = '../../assets/' + d.image;
  };
  // Issued credit cards ("Visa x credit card ••1234" rows and card faces) carry the card name, so the cart can hide them.
  var CC = new RegExp('^\\s*(' + CREDIT.map(function (c) { return reEsc(c.name); }).join('|') + ') credit card ••');
  var markCredit = function () {
    texts(document.body).forEach(function (n) {
      var m = n.nodeValue.match(CC); var el = n.parentElement; if (!m || !el || el.closest('[data-replay-credit]')) return;
      var others = function (box) { return texts(box).some(function (x) { return x !== n && /(credit|Debit) card ••/.test(x.nodeValue); }); };
      var box = el.closest('li'); if (!box || others(box)) { box = el; while (box.parentElement && box.parentElement !== document.body && !others(box.parentElement)) box = box.parentElement; }
      box.setAttribute('data-replay-credit', m[1]);
    });
    document.querySelectorAll('[data-testid^="demo-card-art-credit-"]').forEach(function (a) {
      if (a.closest('[data-replay-credit],[data-replay-cart],[data-lending-card]')) return;
      var name = creditName(a.getAttribute('data-testid').replace('demo-card-art-credit-', ''));
      (a.closest('[data-replay-card]') || a).setAttribute('data-replay-credit', name);
    });
  };
  // Debit card faces (wallet stack, front card) and activity rows belong to an account too: tie them to it by the card's
  // last four (from the account's own row) or the account name, so the cart can hide them or paint the chosen design.
  var markCards = function () {
    var byLast4 = {};
    document.querySelectorAll('[data-replay-item]').forEach(function (row) { texts(row).forEach(function (n) { var m = n.nodeValue.match(/Debit card ••(\d{4})/); if (m) byLast4[m[1]] = row.getAttribute('data-replay-item'); }); });
    texts(document.body).forEach(function (n) {
      var m = n.nodeValue.match(/Debit card ••(\d{4})/); var el = n.parentElement; if (!m || !byLast4[m[1]] || !el || el.closest('[data-replay-item],[data-replay-credit]')) return;
      for (var box = el; box && box !== document.body; box = box.parentElement) {
        if (!box.querySelector('[data-testid^="demo-card-art-"]')) continue;
        if (texts(box).filter(function (x) { return /card ••\d{4}/.test(x.nodeValue); }).length === 1) box.setAttribute('data-replay-item', byLast4[m[1]]);
        break;
      }
    });
    texts(document.body).forEach(function (n) {
      var v = n.nodeValue.trim(); var li = n.parentElement && n.parentElement.closest('li'); if (!li || li.closest('[data-replay-item],[data-replay-credit]')) return;
      var m = v.match(/^Opening deposit — (.+)$/); var pr = m && productByName(m[1]);
      if (pr) li.setAttribute('data-replay-item', pr.id); else if (/^Membership share deposit$/.test(v) && (D.requiredShare || D.shareId)) li.setAttribute('data-replay-item', D.requiredShare || D.shareId);
    });
  };
  // A bundle card the capture never held (e.g. a second non-member bundle on a path captured with one): copy another
  // card's row in the same list and give it this card's name, art and other last four.
  var copyCredit = function (st) {
    var groups = []; document.querySelectorAll('[data-replay-credit]').forEach(function (r) { if (groups.indexOf(r.parentElement) < 0) groups.push(r.parentElement); });
    groups.forEach(function (g) {
      var rows = Array.prototype.filter.call(g.children, function (c) { return c.hasAttribute('data-replay-credit'); }); if (!rows.length) return;
      st.credit.forEach(function (nm) {
        if (rows.some(function (r) { return r.getAttribute('data-replay-credit') === nm; })) return;
        var src = rows[0]; var old = src.getAttribute('data-replay-credit'); var c = src.cloneNode(true); var card = CREDIT.filter(function (x) { return x.name === nm; })[0] || {};
        texts(c).forEach(function (n) { if (n.nodeValue.indexOf(old) >= 0) n.nodeValue = n.nodeValue.split(old).join(nm); n.nodeValue = n.nodeValue.replace(/••(\d{4})/g, function (m, d) { return '••' + d.split('').reverse().join(''); }); });
        c.querySelectorAll('[aria-label],[alt]').forEach(function (n) { ['aria-label', 'alt'].forEach(function (a) { var v = n.getAttribute(a); if (v && v.indexOf(old) >= 0) n.setAttribute(a, v.split(old).join(nm)); }); });
        if (card.art) { c.querySelectorAll('[data-testid^="demo-card-art-credit-"]').forEach(function (a) { a.setAttribute('data-testid', 'demo-card-art-credit-' + card.id); if (a.tagName === 'IMG') a.src = card.art; else { a.style.backgroundImage = 'url("' + card.art + '")'; a.style.backgroundSize = 'cover'; } }); c.querySelectorAll('img[data-rb-card^="credit-"]').forEach(function (im) { im.src = card.art; }); }
        c.setAttribute('data-replay-credit', nm); c.setAttribute('data-replay-copied', '1'); c.style.display = ''; src.parentElement.insertBefore(c, rows[rows.length - 1].nextSibling); rows.push(c);
      });
    });
  };
  // Sentences that name one account ("starting with your Share Savings ••2257.", "DEPOSIT TO Share Savings ••2257")
  // name an account in the live cart (a checking first).
  var fixAccountRefs = function () {
    var st = load(); var ids = cartIds(st); if (!ids.length) return;
    var pick = ids.filter(function (id) { return product(id) && product(id).type === 'checking'; })[0] || ids[0]; var to = product(pick); if (!to) return;
    texts(document.body).forEach(function (n) {
      n.nodeValue = n.nodeValue.replace(/(starting with your |^\s*)([A-Z][\w/+&' -]*?)( ••\d{4})/g, function (m, pre, name, d4) { var p = productByName(name); return p && !inCart(st, p.id) ? pre + to.name + d4 : m; });
    });
  };
  // A required share the capture never held (an existing member's path captured without one): copy a row of a
  // non-debit account in the same list, first in it, named as the share, with the share's minimum and no remove button.
  var copyShare = function () {
    var sid = D.requiredShare; var sp = sid && product(sid); if (!sp || document.querySelector('[data-replay-item="' + sid + '"]')) return;
    var groups = []; document.querySelectorAll('[data-replay-item]').forEach(function (r) { if (groups.indexOf(r.parentElement) < 0) groups.push(r.parentElement); });
    groups.forEach(function (g) {
      var rows = Array.prototype.filter.call(g.children, function (c) { return c.hasAttribute('data-replay-item'); });
      var src = rows.filter(function (r) { var p = product(r.getAttribute('data-replay-item')); return p && !p.debit && p.type === 'savings'; })[0] || rows.filter(function (r) { var p = product(r.getAttribute('data-replay-item')); return p && !p.debit; })[0];
      if (!src) return; var old = product(src.getAttribute('data-replay-item')).name; var c = src.cloneNode(true);
      texts(c).forEach(function (n) { if (n.nodeValue.indexOf(old) >= 0) n.nodeValue = n.nodeValue.split(old).join(sp.name); });
      c.querySelectorAll('button').forEach(function (b) { if (/remove/i.test((b.getAttribute('aria-labelledby') && document.getElementById(b.getAttribute('aria-labelledby')) ? txt(document.getElementById(b.getAttribute('aria-labelledby'))) : '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + txt(b))) b.remove(); });
      var lim = null; texts(c).forEach(function (n) { var v = n.nodeValue.trim(); if (/^M(in|ax)\. Deposit$/.test(v)) { lim = v.charAt(1); return; } if (lim && /^\$[\d,]+\.\d\d$/.test(v)) { if (lim === 'i') n.nodeValue = money(minOf(sid)); else n.parentElement.parentElement.style.display = 'none'; lim = null; } });
      c.querySelectorAll('[id]').forEach(function (el) { el.id = el.id + '-share'; });
      c.setAttribute('data-replay-item', sid); c.setAttribute('data-replay-copied', '1'); c.style.display = ''; g.insertBefore(c, rows[0]);
    });
  };
  // Each issued card shows its own fake last four (recipe data), wherever its row is.
  var paintLast4 = function () {
    document.querySelectorAll('[data-replay-credit]').forEach(function (r) {
      var c = CREDIT.filter(function (x) { return x.name === r.getAttribute('data-replay-credit'); })[0]; if (!c || !c.last4) return;
      texts(r).forEach(function (n) { if (/••\s?\d{4}/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(••\s?)\d{4}/g, '$1' + c.last4); });
      r.querySelectorAll('[aria-label]').forEach(function (n) { var v = n.getAttribute('aria-label'); if (/••\s?\d{4}/.test(v)) n.setAttribute('aria-label', v.replace(/(••\s?)\d{4}/g, '$1' + c.last4)); });
    });
  };
  // The pre-qualified card applied for on the real lending pages (item 5): issued once submitted.
  var lendingCard = function (st) { return st.lending && st.lending.submitted && (T.lcBanking || {}).card ? T.lcBanking.card : null; };
  var lendingStatus = function () {
    var st = load(); var nm = lendingCard(st); if (R.name !== 'online-banking' || !nm || !T.lcBanking.chip) return;
    document.querySelectorAll('[data-replay-credit="' + nm + '"]').forEach(function (row) {
      if (row.querySelector('[data-testid="demo-card-status"]')) return;
      var n = texts(row).filter(function (x) { return x.nodeValue.indexOf(nm + ' credit card') >= 0; })[0]; if (!n || !n.parentElement) return;
      var bx = document.createElement('div'); bx.innerHTML = T.lcBanking.chip; if (bx.firstElementChild) n.parentElement.appendChild(bx.firstElementChild);
    });
  };
  // The pre-qualified banner names an offer, not a card in the cart: never hidden with the cart (older captures marked it).
  document.querySelectorAll('[data-testid="demo-prequal-banner"][data-replay-credit], [data-testid="demo-prequal-banner"] [data-replay-credit]').forEach(function (el) { el.removeAttribute('data-replay-credit'); });
  var applyCart = function () {
    var st = load(); var hidden = []; markCredit(); markCards(); copyCredit(st); copyShare(); paintLast4(); var firstOf = [];
    document.querySelectorAll('[data-replay-item]').forEach(function (row) {
      var id = row.getAttribute('data-replay-item'); var item = st.items.filter(function (x) { return x.productId === id; })[0];
      if (!inCart(st, id)) { row.style.display = 'none'; hidden.push(row); return; }
      // The capture's maximum cart can hold the same account twice (two bundles share it): one row per account.
      if (firstOf.some(function (f) { return f.id === id && f.parent === row.parentElement; })) { row.style.display = 'none'; hidden.push(row); return; }
      firstOf.push({ id: id, parent: row.parentElement });
      if (item && product(id) && product(id).debit) row.querySelectorAll('[data-testid^="demo-card-art-debit-"]').forEach(function (a) { setArt(a, design(item.design)); });
      if (item && product(id) && product(id).debit) texts(row).forEach(function (n) { if (new RegExp('^(' + DEBIT_NAMES + ')$').test(n.nodeValue.trim())) n.nodeValue = n.nodeValue.trim().replace(new RegExp(DEBIT_NAMES), design(item.design).name); });
      // Typed opening deposit into the row; the account's Min. / Max. Deposit figures stay as they are.
      if (R.name !== 'review') { var amt = money(amountOf(st, id)); var lim = false; texts(row).forEach(function (n) { var v = n.nodeValue.trim(); if (/^M(in|ax)\. Deposit$/.test(v)) { lim = true; return; } if (lim && v) { lim = false; if (/^\$[\d,]+\.\d\d$/.test(v)) return; } if (/\$[\d,]+\.\d\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\$[\d,]+\.\d\d/g, amt); }); }
    });
    // One card can fill two bundle slots (a brand with fewer cards): its captured rows then show once per list.
    var seenCredit = [];
    document.querySelectorAll('[data-replay-credit]').forEach(function (row) {
      var nm = row.getAttribute('data-replay-credit');
      if (st.credit.indexOf(nm) < 0 && !(lendingCard(st) && nm === lendingCard(st))) { row.style.display = 'none'; hidden.push(row); return; }
      if (seenCredit.some(function (f) { return f.name === nm && f.parent === row.parentElement; })) { row.style.display = 'none'; hidden.push(row); return; }
      seenCredit.push({ name: nm, parent: row.parentElement });
    });
    // A heading left with no visible rows under it goes too.
    hidden.forEach(function (row) {
      var p = row.parentElement;
      for (var k = 0; k < 3 && p && p !== document.body; k++, p = p.parentElement) {
        var rows = p.querySelectorAll('[data-replay-item],[data-replay-credit]'); if (!rows.length) continue;
        var anyShown = Array.prototype.some.call(rows, function (r) { return r.style.display !== 'none'; });
        if (anyShown) break;
        var rest = p.cloneNode(true); rest.querySelectorAll('[data-replay-item],[data-replay-credit]').forEach(function (r) { r.remove(); });
        if ((rest.textContent || '').trim().length < 60) { p.style.display = 'none'; break; }
      }
    });
    // Debit cards outside account rows (wallet stacks): one per checking in the cart, in cart order.
    var designs = st.items.filter(function (x) { return product(x.productId) && product(x.productId).debit; }).map(function (x) { return design(x.design); });
    var loose = Array.prototype.filter.call(document.querySelectorAll('[data-testid^="demo-card-art-debit-"]'), function (a) { return !a.closest('[data-replay-item]'); });
    loose.forEach(function (a, i) { var holder = a.closest('[data-replay-card]') || a; if (i < designs.length) setArt(a, designs[i]); else if (designs.length) holder.style.display = 'none'; });
    // Totals and the funding line.
    var t = total(st);
    if (capturedTotal && R.name !== 'review') replaceAllText(document.body, new RegExp(capturedTotal.replace(/[$.]/g, '\\$&'), 'g'), function () { return money(t); });
    var fl = document.querySelector('[data-testid="demo-funding-source"]');
    if (fl) {
      var line = st.funding === 'bank' && T.bankFunding ? T.bankFunding : st.funding === 'existing' && T.existingFunding ? existingLine(T.existingFunding, st) : txt(fl);
      if (st.funding === 'card' && st.cardSource) line = line.replace(/·.*$/, '· ' + st.cardSource);
      fl.textContent = line.replace(/\$[\d,]+\.\d\d/, money(t));
    }
  };
  if (!R.live && !R.side) { applyCart(); lendingStatus(); }
  if (!R.live) fixAccountRefs();
  // Member number on the screens after the Membership group choice: the new number for a new membership, the existing
  // one otherwise.
  var screenAt = function (f) { return (R.screens || []).map(function (x) { return x.file; }).indexOf(f); };
  if (MPATH && file('membership-choice') && screenAt(here) > screenAt(file('membership-choice'))) {
    var mnum = MPATH === 'new' ? D.newMemberNumber : D.memberNumber;
    var anyNum = new RegExp('\\b(' + reEsc(D.memberNumber) + '|' + reEsc(D.newMemberNumber) + ')\\b', 'g');
    replaceAllText(document.body, anyNum, function () { return mnum; });
  }
  if (R.name === 'terms') { var stt = load(); document.querySelectorAll('[data-replay-item] input').forEach(function (inp) { var id = inp.closest('[data-replay-item]').getAttribute('data-replay-item'); var tv = typedAmt(stt, id); inp.value = tv != null ? tv : (minOf(id) % 1 ? minOf(id).toFixed(2) : String(minOf(id))); }); }
  if (R.name === 'bank-authorization') { var amt0 = money(total(load())); texts(document.body).forEach(function (n) { if (/^\s*\$[\d,]+\.\d\d\s*$/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\$[\d,]+\.\d\d/, amt0); }); }
  Array.prototype.forEach.call(document.querySelectorAll('main button, main p, main span, main div'), function (el) { if (/^All \d+ shown$/.test(txt(el)) && !el.querySelector('button, p, div')) el.style.display = 'none'; });
  // The main button may sit in a row that is now hidden (e.g. "Add to mobile wallet" on a card not in the cart).
  if (next && next.closest('[data-replay-item],[data-replay-credit]') && !next.getClientRects().length) {
    var same = Array.prototype.filter.call(document.querySelectorAll('button'), function (b) { return b !== next && txt(b) === txt(next) && b.getClientRects().length; })[0];
    if (same) { next.removeAttribute('data-replay-next'); same.setAttribute('data-replay-next', '1'); next = same; }
  }
  if (/^lending/.test(R.name || '') || R.name === 'thank-you') applyCart();

  // ---- Review: empty opening deposits, live total at the bottom ----
  if (R.name === 'review') {
    var st0 = load();
    var totalEl = document.querySelector('[data-replay-total]');
    var paintTotal = function () { if (!totalEl) return; var t = total(load()); var done = false; texts(totalEl).forEach(function (n) { if (!done && /\$[\d,]*\.?\d*/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\$[\d,]*\.?\d*/, money(t)); done = true; } }); };
    document.querySelectorAll('[data-replay-item] input').forEach(function (inp) {
      var id = inp.closest('[data-replay-item]').getAttribute('data-replay-item');
      inp.value = st0.amounts[id] != null ? st0.amounts[id] : ''; inp.removeAttribute('value');
      // The outlined field's label floats (and the outline notch opens) once it has a value or focus, as in the product.
      // Filled-state classes of this build's outlined input (label + legend), taken from the filled capture; inline fallback.
      var wrap = inp.closest('[class*="InputWrapper"]') || inp.parentElement.parentElement;
      var lab = wrap.querySelector('label[for]'); var leg = wrap.querySelector('legend');
      var swap = function (el, from, to, on) { if (!el) return false; if (on) { if (el.classList.contains(from)) { el.classList.remove(from); el.classList.add(to); } } else if (el.classList.contains(to)) { el.classList.remove(to); el.classList.add(from); } return true; };
      var known = lab && (lab.classList.contains('jmtcTY') || lab.classList.contains('ixLqXc'));
      var float = function () {
        var on = !!inp.value || document.activeElement === inp;
        if (known) { swap(lab, 'jmtcTY', 'ixLqXc', on); swap(leg, 'dcdySb', 'ioFDQY', on); return; }
        if (lab) { lab.style.transform = on ? 'translate(0.875rem, -0.4375rem) scale(0.75)' : ''; lab.style.maxWidth = on ? 'calc(133% - 2rem)' : ''; } if (leg) leg.style.maxWidth = on ? '100%' : '';
      };
      ['input', 'focus', 'blur'].forEach(function (ev) { inp.addEventListener(ev, float); }); float();
      inp.addEventListener('input', function () { var s = load(); s.amounts[id] = inp.value; save(s); paintTotal(); });
    });
    paintTotal();
  }

  // ---- Choice screens (membership group, ID document type, existing account): nothing chosen; a click swaps the group
  // to its captured selected state and enables the main button. The choice is kept for later screens. ----
  var CHOICE = T['choice:' + R.name];
  if (CHOICE) {
    var bindChoice = function () {
      document.querySelectorAll('[data-replay-choice]').forEach(function (o) {
        o.style.cursor = 'pointer';
        o.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); var k = o.getAttribute('data-replay-choice'); var tpl = CHOICE[k]; if (!tpl) return;
          var s = load(); s.choices = s.choices || {}; s.choices[R.name] = k;
          // Membership group: choosing the other membership swaps the bundles and the share account, so the cart starts over.
          if (R.name === 'membership-choice') { var pth = k === 'new' ? 'new' : 'current'; if (s.membership && s.membership !== pth) { s.items = []; s.credit = []; s.amounts = {}; s.bundle = null; } s.membership = pth; }
          save(s);
          var g = document.querySelector('[data-replay-choice-group]'); var box = document.createElement('div'); box.innerHTML = tpl; var ng = box.firstElementChild;
          if (g && ng) { g.replaceWith(ng); bindChoice(); }
          var nb = T['choiceNext:' + R.name];
          if (nb && next && !next.hasAttribute('data-replay-enabled')) { var b2 = document.createElement('div'); b2.innerHTML = nb; var nn = b2.firstElementChild; if (nn) { nn.setAttribute('data-replay-next', '1'); nn.setAttribute('data-replay-enabled', '1'); nn.removeAttribute('disabled'); nn.removeAttribute('aria-disabled'); next.replaceWith(nn); next = nn; } }
        }, true);
      });
    };
    var sc = load(); sc.choices = sc.choices || {}; var keepC = arriving && sc.choices[R.name]; if (!keepC) { delete sc.choices[R.name]; save(sc); }
    bindChoice(); if (keepC) { var oc = document.querySelector('[data-replay-choice="' + keepC + '"]'); if (oc) oc.click(); }
    guard = function () { return !!(load().choices || {})[R.name]; };
  }
  // ---- Real lending pages 08-12 (item 4): Apply now -> details -> insurances -> plans -> selected -> submitted. The chosen
  // plan and the submit live in the session store (lending), so they survive the desktop <-> phone switch. ----
  if (R.name === 'lc-insurances') { var si = load(); si.lending = si.lending || {}; si.lending.plan = null; si.choices = si.choices || {}; if (!arriving) delete si.choices['lc-plans']; save(si); }
  // The plans page opens on the product's default plan (as live), so Add and proceed is never blocked.
  if (R.name === 'lc-plans' && T.lcDefault) { var sp = load(); sp.choices = sp.choices || {}; if (!sp.choices['lc-plans']) { sp.choices['lc-plans'] = T.lcDefault; save(sp); } guard = null; }
  if (R.name === 'lc-selected') {
    var ss = load(); var pk = (ss.choices || {})['lc-plans'] || T.lcDefault; ss.lending = ss.lending || {}; ss.lending.plan = pk; save(ss);
    var lsel = (T.lcSelected || {})[pk]; var mm = document.querySelector('main');
    if (pk !== T.lcDefault && lsel && mm) { var bx = document.createElement('div'); bx.innerHTML = lsel; if (bx.firstElementChild) { mm.replaceWith(bx.firstElementChild); next = document.querySelector('[data-replay-next]'); } }
  }
  if (R.name === 'lc-submitted') { var sb = load(); sb.lending = sb.lending || {}; sb.lending.submitted = true; save(sb); }
  // ---- Existing account transfer: live total; the chosen account goes into the online banking funding line ----
  if (R.name === 'existing-account') {
    var tb = document.querySelector('[data-replay-total]'); var t3 = money(total(load()));
    if (tb) texts(tb).some(function (n) { if (/\$[\d,]+\.\d\d/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\$[\d,]+\.\d\d/, t3); return true; } return false; });
    var se = load(); se.funding = 'existing'; save(se);
  }

  // ---- Funding type: nothing chosen; the option group swaps to its captured selected state ----
  if (R.name === 'funding-type') {
    var bindFund = function () {
      document.querySelectorAll('[data-replay-fund]').forEach(function (o) {
        o.style.cursor = 'pointer';
        o.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); var k = o.getAttribute('data-replay-fund'); var s = load(); s.funding = k; save(s);
          var g = document.querySelector('[data-replay-fund-group]'); var tpl = (T.fund || {})[k];
          if (g && tpl) { var box = document.createElement('div'); box.innerHTML = tpl; var ng = box.firstElementChild; ng.setAttribute('data-replay-fund-group', '1'); g.replaceWith(ng); markOpts(ng); bindFund(); }
        }, true);
      });
    };
    var markOpts = function (g) {
      Array.prototype.forEach.call(g.children, function (c) { var x = txt(c) || c.textContent || ''; if (/existing .*account/i.test(x)) c.setAttribute('data-replay-fund', 'existing'); else if (/credit or debit card/i.test(x)) c.setAttribute('data-replay-fund', 'card'); else if (/bank account/i.test(x)) c.setAttribute('data-replay-fund', 'bank'); });
    };
    var s0 = load(); var keep = arriving && s0.funding; if (!keep) { s0.funding = null; save(s0); } bindFund();
    if (keep) { var opt = document.querySelector('[data-replay-fund="' + s0.funding + '"]'); if (opt) opt.click(); }
    guard = function () { return !!load().funding; };
  }

  // ---- Card entry: empty form takes anything; Apple Pay opens the simulated sheet ----
  if (R.name === 'card-entry') {
    var s1 = load(); s1.funding = 'card'; save(s1);
    var num4 = document.querySelector('input[name="card-number"]');
    var sub = document.querySelector('[data-testid="demo-card-submit"]');
    if (sub) sub.addEventListener('click', function () { var d = (num4 ? num4.value : '').replace(/\D/g, '').slice(-4); var s = load(); s.cardSource = d.length === 4 ? 'Card ••' + d : 'Card'; save(s); }, true);
    var ap = document.querySelector('[data-testid="demo-applepay-button"]');
    var sheet = null;
    var showSheet = function (phase) {
      var box = document.createElement('div'); box.innerHTML = (T.applepay || {})[phase] || ''; var el = box.firstElementChild; if (!el) return;
      replaceAllText(el, /\$[\d,]+\.\d\d/g, function () { return money(total(load())); });
      // The sheet's backdrop (SheetBackdrop in the demo) is not part of the captured sheet: same styles here.
      if (!sheet) {
        sheet = document.createElement('div'); sheet.setAttribute('data-replay-own', ''); var phoneW = R.variant === 'phone';
        sheet.style.cssText = 'position:fixed;inset:0;z-index:3000;display:flex;justify-content:center;background:rgba(0,0,0,.4);' + (phoneW ? 'align-items:flex-end;padding:0' : 'align-items:center;padding:16px');
        document.body.appendChild(sheet);
      }
      sheet.innerHTML = ''; sheet.appendChild(el); openNow = phase === 'review' ? { sheet: 'review' } : {};
      var cancel = el.querySelector('[aria-label="Cancel"]'); if (cancel) cancel.addEventListener('click', function () { sheet.remove(); sheet = null; openNow = {}; });
      var confirm = el.querySelector('[data-testid="demo-applepay-confirm"]');
      if (confirm) confirm.addEventListener('click', function () { var s = load(); s.cardSource = 'Apple Pay'; save(s); showSheet('faceid'); setTimeout(function () { showSheet('done'); setTimeout(function () { go(nextFile()); }, 900); }, 1300); });
    };
    if (ap) ap.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); showSheet('review'); }, true);
    reopen.sheet = function () { showSheet('review'); };
  }

  // ---- Online banking enrollment: empty fields, the live demo's rules ----
  if (R.name === 'enrollment') {
    var err = document.querySelector('[data-replay-error]'); if (err) err.style.display = 'none';
    var field = function (re) { return Array.prototype.filter.call(document.querySelectorAll('[data-testid="demo-enrollment-option-b"] input'), function (i) { var l = (i.labels && i.labels[0] && txt(i.labels[0])) || i.getAttribute('aria-label') || i.name || ''; return re.test(l); })[0]; };
    var u = field(/^username/i); var p = field(/^password/i); var r = field(/^retype/i);
    [u, p, r].forEach(function (i) { if (i) { i.value = ''; i.removeAttribute('value'); } });
    guard = function () {
      var un = u ? u.value : ''; var pw = p ? p.value : ''; var rt = r ? r.value : ''; var problem = null;
      if (un.trim().length < 6) problem = 'Username must be at least 6 characters.';
      else if (pw.length < 8) problem = 'Password must be at least 8 characters.';
      else if (pw.length > 40) problem = 'Password must be no more than 40 characters.';
      else if (rt.length < 8) problem = 'Retype password must be at least 8 characters.';
      else if (rt !== pw) problem = 'The passwords don’t match.';
      if (err) { err.style.display = problem ? '' : 'none'; if (problem) err.textContent = problem; }
      return !problem;
    };
  }

  // ---- Thank You: the offers carousel scrolls through every loan offer; "View all offers" opens the full list ----
  var OFFERS = [
    ['Debt Consolidation', 'lending-debt-consolidation'], ['Home Improvement Loans', 'lending-all'], ['Recreational Vehicle Loans', 'lending-all'],
    ['Motorcycle Loans', 'lending-all'], ['Boat Loans', 'lending-all'], ['UTV/ATV Loans', 'lending-all'], ['Storm Shelter Loans', 'lending-all']
  ];
  // Snackbars (e.g. "Success! Your credentials are set") close with their X and after 5 s, as in the product.
  document.querySelectorAll('[data-testid="snackbar-stack"] > *').forEach(function (bar) {
    var close = function () { bar.style.transition = 'opacity .3s'; bar.style.opacity = '0'; setTimeout(function () { bar.style.display = 'none'; }, 300); };
    var x = bar.querySelector('[data-testid="snackbar-close-button"]'); if (x) { x.setAttribute('data-replay-own', ''); x.addEventListener('click', function (e) { e.preventDefault(); close(); }); }
    setTimeout(close, 5000);
  });
  if (R.name === 'thank-you') {
    document.querySelectorAll('[data-replay-showall]').forEach(function (b) { b.style.display = 'none'; });
    Array.prototype.forEach.call(document.querySelectorAll('main p, main span, main div'), function (el) { if (!el.children.length && /^All \d+ shown$/.test(txt(el))) el.style.display = 'none'; });
    var region = document.querySelector('[data-testid="success-page-offers"] [aria-roledescription="carousel"]');
    var slides = region ? Array.prototype.slice.call(region.querySelectorAll('[aria-roledescription="slide"]')) : [];
    if (region && slides.length) {
      var track = slides[0].parentElement; var viewport = track.parentElement;
      var tpl = slides.filter(function (s) { return /other/i.test(txt(s)); })[0] || slides[slides.length - 1];
      OFFERS.forEach(function (o) {
        if (slides.some(function (s) { return txt(s).toLowerCase().indexOf(o[0].toLowerCase()) >= 0; })) return;
        var c = tpl.cloneNode(true); var label = texts(c).filter(function (n) { return n.nodeValue.trim().length > 3; })[0];
        if (label) label.nodeValue = o[0];
        var g = c.querySelector('[data-replay-goto]') || c.querySelector('[role="button"]'); if (g) g.setAttribute('data-replay-goto', file(o[1]) || file('lending-all'));
        track.appendChild(c);
      });
      var all = Array.prototype.slice.call(track.children);
      all.forEach(function (s, i) { s.setAttribute('aria-label', (i + 1) + ' of ' + all.length); s.style.flex = s.style.flex || ''; });
      track.style.transform = 'none'; track.style.flexWrap = 'nowrap';
      viewport.style.overflowX = 'auto'; viewport.style.scrollBehavior = 'smooth'; viewport.style.scrollSnapType = 'x mandatory';
      all.forEach(function (s) { s.style.scrollSnapAlign = 'start'; });
      var prev = region.querySelector('[aria-label="Previous slide"]'); var nxt = region.querySelector('[aria-label="Next slide"]');
      var step = function () { return (all[0] && all[0].getBoundingClientRect().width + 16) || 300; };
      var paintArrows = function () { if (prev) prev.disabled = viewport.scrollLeft <= 2; if (nxt) nxt.disabled = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2; };
      [[prev, -1], [nxt, 1]].forEach(function (b) { if (!b[0]) return; b[0].setAttribute('data-replay-own', ''); b[0].addEventListener('click', function (e) { e.preventDefault(); viewport.scrollBy({ left: b[1] * step(), behavior: 'smooth' }); setTimeout(paintArrows, 400); }); });
      viewport.addEventListener('scroll', paintArrows); setTimeout(paintArrows, 50);
      var head = region.querySelector('h2'); if (head && file('lending-all')) {
        var a = document.createElement('a'); a.textContent = 'View all offers'; a.href = file('lending-all'); a.setAttribute('data-replay-goto', file('lending-all'));
        a.style.cssText = 'display:inline-block;margin-top:6px;font-weight:600;font-size:15px;color:var(--rb-7146b5, #7146b5);text-decoration:underline;cursor:pointer';
        head.parentElement.appendChild(a);
      }
    }
  }

  // ---- Lending pages rebuilt by fix-pages.cjs (data-lending-v2): carousels and the Issued card ----
  var V2 = document.documentElement.hasAttribute('data-lending-v2');
  if (V2) {
    document.querySelectorAll('[data-lending-carousel]').forEach(function (trk) {
      var sec = trk.closest('section'); var prev = sec.querySelector('[aria-label="Previous slide"]'); var nxt = sec.querySelector('[aria-label="Next slide"]');
      var paint = function () { var atEnd = trk.scrollLeft + trk.clientWidth >= trk.scrollWidth - 2; if (prev) prev.disabled = trk.scrollLeft <= 2; if (nxt) nxt.disabled = atEnd; trk.classList.toggle('end', atEnd); };
      var step = function () { var c = trk.firstElementChild; return c ? c.getBoundingClientRect().width + 17 : 330; };
      [[prev, -1], [nxt, 1]].forEach(function (x) { if (x[0]) x[0].addEventListener('click', function (e) { e.preventDefault(); trk.scrollBy({ left: x[1] * step(), behavior: 'smooth' }); }); });
      trk.addEventListener('scroll', paint); window.addEventListener('resize', paint); paint();
    });
    if (R.name === 'lending-credit-cards') {
      var stc = load(); var grid = document.querySelector('[data-lending-grid]');
      var issued = Array.prototype.filter.call(document.querySelectorAll('[data-lending-card]'), function (c) { var on = stc.credit.indexOf(c.getAttribute('data-lending-card')) >= 0; c.setAttribute('data-issued', on ? 'true' : 'false'); return on; });
      issued.slice().reverse().forEach(function (c) { grid.insertBefore(c, grid.firstElementChild); });
      var ap = document.querySelector('[data-lending-approved]'); if (ap) ap.textContent = issued.length ? issued.length + (issued.length === 1 ? ' card' : ' cards') + ' approved · ' : '';
    }
  }
  if (!V2) {
  // ---- Lending: the general page lists every offer; every lending page links to it ----
  if (/^lending/.test(R.name || '') && file('lending-all')) {
    if (R.name === 'lending-home' || R.name === 'lending-all') {
      var explore = Array.prototype.filter.call(document.querySelectorAll('h2, h3'), function (h) { return /explore more loan options/i.test(txt(h)); })[0];
      var tileGrid = explore && (explore.closest('section') || explore.parentElement).querySelector('a, button'); tileGrid = tileGrid && tileGrid.parentElement;
      if (tileGrid) OFFERS.slice(1).forEach(function (o) {
        var c = tileGrid.lastElementChild.cloneNode(true); var ts = texts(c).filter(function (n) { return n.nodeValue.trim(); }); if (ts.length) ts[ts.length - 1].nodeValue = o[0];
        if (c.tagName === 'A') { c.setAttribute('href', file('lending-all')); c.setAttribute('data-replay-link', '1'); }
        tileGrid.appendChild(c);
      });
      if (explore && R.name === 'lending-home') {
        var see = document.createElement('a'); see.href = file('lending-all'); see.setAttribute('data-replay-link', '1'); see.textContent = 'SEE ALL LOANS →';
        see.style.cssText = 'display:inline-block;margin-top:16px;font-weight:600;letter-spacing:.06em;color:var(--rb-7146b5, #7146b5);text-decoration:none';
        var sec = explore.closest('section') || explore.parentElement; sec.appendChild(see);
      }
    } else {
      var title = document.querySelector('main h1, main h2');
      if (title) { var l = document.createElement('a'); l.href = file('lending-all'); l.setAttribute('data-replay-link', '1'); l.textContent = 'See all loan offers'; l.style.cssText = 'display:block;margin:8px 0 16px;font-weight:600;color:var(--rb-7146b5, #7146b5)'; title.parentElement.insertBefore(l, title.nextSibling); }
    }
  }
  if (R.name === 'lending-all') {
    document.title = 'All loan offers';
    var hero = Array.prototype.filter.call(document.querySelectorAll('h1, h2, p, span, div'), function (h) { return /^Hi, /.test(txt(h)) && h.children.length === 0; })[0];
    if (hero) { hero.textContent = 'All loan offers'; var sib = hero.nextElementSibling; if (sib && /possibilities/i.test(txt(sib))) sib.textContent = 'Everything ' + ((window.REPLAY_BRAND || {}).name || 'your credit union') + ' can offer you, in one place.'; }
    replaceAllText(document.body, /Look at all the possibilities we found for you!/, function () { return 'Everything ' + ((window.REPLAY_BRAND || {}).name || 'your credit union') + ' can offer you, in one place.'; });
    var offersHead = Array.prototype.filter.call(document.querySelectorAll('h2'), function (h) { return /personalized loan offers/i.test(txt(h)); })[0];
    var offerTrack = document.querySelector('[data-testid^="demo-lending-offer-"]'); offerTrack = offerTrack && offerTrack.parentElement;
    if (offerTrack) {
      var base = offerTrack.lastElementChild;
      OFFERS.slice(1).forEach(function (o) {
        var c = base.cloneNode(true); c.setAttribute('href', file('lending-all')); c.setAttribute('data-testid', 'demo-lending-offer-' + o[0].toLowerCase().replace(/\W+/g, '-'));
        var h = c.querySelector('h3'); if (h) h.textContent = o[0];
        var spans = c.querySelectorAll('div > span'); if (spans[0]) spans[0].textContent = 'Rates for you'; if (spans[1]) spans[1].textContent = 'Apply online';
        var chip = c.lastElementChild; if (chip && chip.tagName === 'SPAN') chip.style.visibility = 'hidden';
        offerTrack.appendChild(c);
      });
      var cardsAll = Array.prototype.slice.call(offerTrack.children);
      cardsAll.forEach(function (c, i) { c.setAttribute('aria-label', txt(c.querySelector('h3') || c) + ', ' + (i + 1) + ' of ' + cardsAll.length); });
      offerTrack.style.display = 'grid'; offerTrack.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))'; offerTrack.style.gridAutoFlow = 'row'; offerTrack.style.gap = '16px';
      cardsAll.forEach(function (c) { c.style.flex = 'none'; c.style.width = 'auto'; c.style.minWidth = '0'; });
      offerTrack.style.flexWrap = 'wrap'; offerTrack.style.overflow = 'visible'; offerTrack.style.transform = 'none'; offerTrack.style.maskImage = 'none'; offerTrack.style.webkitMaskImage = 'none'; offerTrack.setAttribute('data-at-end', 'true');
      document.querySelectorAll('[aria-label="Previous slide"], [aria-label="Next slide"]').forEach(function (b) { if (offersHead && offersHead.closest('section') && offersHead.closest('section').contains(b)) b.style.display = 'none'; });
      if (offersHead) offersHead.textContent = 'Every loan offer';
    }
  }
  // Lending carousels (home): arrows scroll their track.
  if (/^lending/.test(R.name || '') && R.name !== 'lending-all') {
    document.querySelectorAll('[aria-label="Next slide"], [aria-label="Previous slide"]').forEach(function (b) {
      var sec = b.closest('section') || b.parentElement.parentElement.parentElement; var trk = sec && sec.querySelector('[role="region"]'); if (!trk) return;
      b.removeAttribute('disabled');
      b.addEventListener('click', function (e) { e.preventDefault(); var dir = /next/i.test(b.getAttribute('aria-label')) ? 1 : -1; trk.scrollBy({ left: dir * ((trk.firstElementChild && trk.firstElementChild.getBoundingClientRect().width + 16) || 320), behavior: 'smooth' }); });
    });
  }
  }
  // Plaid-style screens: any bank tile picks it; Back goes back, Close returns to the funding choice.
  if (R.branch === 'bank') {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button, [role="button"], li'); if (!b) return;
      var label = b.getAttribute('aria-label') || '';
      if (/^back$/i.test(label)) { e.preventDefault(); e.stopPropagation(); history.back(); return; }
      if (/^close$/i.test(label)) { e.preventDefault(); e.stopPropagation(); go(file('funding-type')); return; }
      if (R.name === 'bank-institution' && /bank|federal|trust|savings|national/i.test(txt(b)) && !/search/i.test(label)) { e.preventDefault(); e.stopPropagation(); forward(true); }
    }, true);
  }

  // ---- Eligibility, joint applicants, beneficiaries and the simulated email handoff ----
  // DEMO ONLY: production has no email invitation for a joint applicant or beneficiary; this mirrors the live demo's simulation
  // (ao-demo: test/demo/handoff/EmailHandoff.tsx). Nothing is sent. State (chosen eligibility option, invited people) lives in the
  // same session store as the cart, so it survives the desktop <-> phone switch; the open dialog is part of the switch snapshot.
  var handoffModal = function (dlg) { // same overlay as the cart dialog (modal() is defined below the early return for cart-less screens)
    var o = document.createElement('div'); o.setAttribute('data-replay-cart', '');
    o.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(17,24,39,.45);display:flex;align-items:center;justify-content:center;overflow:auto';
    dlg.style.position = 'relative'; dlg.style.inset = 'auto'; dlg.style.transform = 'none'; dlg.style.margin = 'auto'; dlg.style.maxHeight = '100vh'; dlg.style.overflow = 'auto';
    o.appendChild(dlg); document.body.appendChild(o); return o;
  };
  var ELIG = D.eligibility;
  var chosenElig = function () { var k = (load().choices || {}).eligibility || (ELIG && ELIG.selected); return ELIG && ELIG.options.filter(function (o) { return o.id === k; })[0]; };
  var peopleOf = function () { var s = load(); s.people = s.people || { joint: [], beneficiary: [] }; s.people.joint = s.people.joint || []; s.people.beneficiary = s.people.beneficiary || []; return s.people; };
  var POOL = { joint: ['Pepper Potts', 'Steve Rogers', 'Bruce Banner', 'Clint Barton'], beneficiary: ['Morgan Stark', 'Happy Hogan', 'Maria Hill', 'Nick Fury'] };
  var capturedName = function (kind) { return POOL[kind][0]; };
  var capturedEmail = function (kind) { return POOL[kind][0].toLowerCase().replace(' ', '.') + '@example.com'; };
  var swapAll = function (root, from, to) { replaceAllText(root, new RegExp(reEsc(from), 'g'), function () { return to; }); };
  if (R.name === 'review') {
    if (ELIG && ELIG.selected) { var cur = ELIG.captured ? { description: ELIG.captured } : ELIG.options.filter(function (o) { return o.id === ELIG.selected; })[0]; var ch = chosenElig(); if (cur && ch && cur.description !== ch.description) replaceText(document.body, cur.description, ch.description); }
    var pe = peopleOf();
    if ((pe.joint.length || pe.beneficiary.length) && T.reviewPeople) {
      var heading = Array.prototype.filter.call(document.querySelectorAll('main h2'), function (h) { return /^Add joint applicants/i.test((h.textContent || '').trim()); })[0];
      var card = heading && heading.closest('article'); var outer = card && card.parentElement && card.parentElement.closest('article');
      if (heading) heading.textContent = heading.textContent.replace(/^Add/, 'Edit');
      if (outer && !outer.querySelector(':scope > hr')) {
        var hb = document.createElement('div'); hb.innerHTML = T.reviewPeople; var div = hb.querySelector('div');
        [['joint', 'Joint Applicants'], ['beneficiary', 'Beneficiaries']].forEach(function (kk) {
          var h4 = Array.prototype.filter.call(div.querySelectorAll('h4'), function (h) { return (h.textContent || '').trim().toLowerCase() === kk[1].toLowerCase(); })[0]; if (!h4) return; var ol = h4.nextElementSibling;
          if (!pe[kk[0]].length) { h4.remove(); if (ol) ol.remove(); return; }
          var li0 = ol.querySelector('li'); ol.innerHTML = '';
          pe[kk[0]].forEach(function (x) { var li = li0.cloneNode(true); li.textContent = x.name + ' (invited, pending)'; ol.appendChild(li); });
        });
        while (hb.firstChild) outer.appendChild(hb.firstChild);
      }
    }
  }
  if (R.name === 'jb-list') {
    var pl = peopleOf();
    ['joint', 'beneficiary'].forEach(function (kind) {
      var tpl = T['jb:' + kind]; var list = pl[kind]; if (!tpl || !list.length) return;
      var phRe = kind === 'joint' ? /^No joint applicant added yet$/ : /^No beneficiary added yet$/;
      var ph = Array.prototype.filter.call(document.querySelectorAll('main span'), function (sp) { return phRe.test(txt(sp)); })[0];
      var phBox = ph && ph.closest('article') && ph.closest('article').parentElement; if (!phBox) return;
      var hb = document.createElement('div'); hb.innerHTML = tpl; var ul = hb.firstElementChild; var li0 = ul.querySelector('li'); ul.innerHTML = '';
      list.forEach(function (x, i) {
        var li = li0.cloneNode(true); swapAll(li, capturedName(kind), x.name);
        li.querySelectorAll('[aria-label]').forEach(function (e) { e.setAttribute('aria-label', e.getAttribute('aria-label').replace(capturedName(kind), x.name)); });
        var del = li.querySelector('[aria-label^="Delete"]');
        if (del) del.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var s = load(); s.people = peopleOf(); s.people[kind].splice(i, 1); save(s); location.reload(); }, true);
        ul.appendChild(li);
      });
      phBox.replaceWith(ul);
    });
  }
  if (R.name === 'add-joint' || R.name === 'add-beneficiary') {
    var kind = R.name === 'add-joint' ? 'joint' : 'beneficiary';
    var link = document.querySelector('[data-testid="demo-email-handoff-link"]'); var hOverlay = null;
    var typedVal = function (n) { var i = document.querySelector('input[name="' + n + '"]'); return i ? i.value.trim() : ''; };
    var invitee = function () {
      var f = typedVal('firstName'); var l = typedVal('lastName'); var fb = POOL[kind][peopleOf()[kind].length % POOL[kind].length].split(' ');
      var first = f && l ? f : fb[0]; var last = f && l ? l : fb[1]; var em = typedVal('email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) em = (first + '.' + last + '@example.com').toLowerCase();
      return { name: first + ' ' + last, email: em };
    };
    var closeHandoff = function () { if (hOverlay) { hOverlay.remove(); hOverlay = null; } openNow = {}; };
    var backToList = function () { closeHandoff(); go(file('jb-list')); };
    var showHandoff = function (phase, who) {
      closeHandoff(); var tpl = T['handoff:' + kind + ':' + phase]; if (!tpl) return;
      var box = document.createElement('div'); box.innerHTML = tpl; var dlg = box.firstElementChild; if (!dlg) return;
      swapAll(dlg, capturedEmail(kind), who.email); swapAll(dlg, capturedName(kind), who.name);
      Array.prototype.forEach.call(dlg.querySelectorAll('button'), function (b) {
        var label = txt(b) + ' ' + (b.getAttribute('aria-label') || '');
        b.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (/send invitation/i.test(label)) { var s = load(); s.people = peopleOf(); s.people[kind].push(who); save(s); showHandoff('sent', who); }
          else if (/back to the list/i.test(label)) backToList();
          else if (/cancel|close/i.test(label)) { if (phase === 'sent') backToList(); else closeHandoff(); }
        }, true);
      });
      hOverlay = handoffModal(dlg); openNow = { handoff: phase };
    };
    if (link) link.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); showHandoff('confirm', invitee()); }, true);
    reopen.handoff = function (phase) { var ppl = peopleOf()[kind]; showHandoff(phase, phase === 'sent' && ppl.length ? ppl[ppl.length - 1] : invitee()); };
  }
  // ---- Live: product selection, cart and debit card selector ----
  if (R.live !== 'account-types' && R.live !== 'products') return;
  var tplBox = document.createElement('div'); tplBox.innerHTML = T.cart || '';
  var cartTpl = tplBox.firstElementChild;
  var rowsTpl = cartTpl ? Array.prototype.slice.call(cartTpl.querySelectorAll('ul > li')) : [];
  var shareTpl = rowsTpl.filter(function (li) { return !li.querySelector('button') && !li.hasAttribute('data-demo-credit-card'); })[0];
  var acctTpl = rowsTpl.filter(function (li) { return li.querySelector('button') && !li.hasAttribute('data-demo-credit-card'); })[0];
  var creditTpl = rowsTpl.filter(function (li) { return li.hasAttribute('data-demo-credit-card'); })[0];
  var ptpl = document.createElement('div'); ptpl.innerHTML = T.panel || ''; var panelTpl = ptpl.firstElementChild;
  // Members' lists were captured with an empty cart (no cart button): swap in the bar captured with a filled cart,
  // shown only while the live cart holds something.
  var filledBar = null;
  if (R.live === 'products' && !document.querySelector('[data-testid="multiple-accounts-button"]') && T.typesFooterFilled) {
    var fb0 = document.createElement('div'); fb0.innerHTML = T.typesFooterFilled; var old0 = document.querySelector('footer');
    if (old0 && fb0.firstElementChild) { filledBar = fb0.firstElementChild; old0.replaceWith(filledBar); var c0 = Array.prototype.filter.call(filledBar.querySelectorAll('button'), function (x) { return /^continue/i.test(txt(x)); })[0]; if (c0) { c0.setAttribute('data-replay-next', '1'); next = c0; } }
  }
  if (R.live === 'account-types' && !document.querySelector('[data-testid="multiple-accounts-button"]') && (T.typesFooterFilled || T.typesFooter)) {
    var fb = document.createElement('div'); fb.innerHTML = T.typesFooterFilled || T.typesFooter; var foot = fb.firstElementChild; var mainEl = document.querySelector('main'); if (T.typesFooterFilled) filledBar = foot;
    if (mainEl) { mainEl.parentElement.insertBefore(foot, mainEl.nextSibling); var c = Array.prototype.filter.call(foot.querySelectorAll('button'), function (x) { return /^continue/i.test(txt(x)); })[0]; if (c) { c.setAttribute('data-replay-next', '1'); next = c; } }
  }
  // Members have no automatic Share Savings, so their product lists were captured with an empty cart and a disabled
  // Continue: once the live cart holds something, swap in the enabled Continue captured after choosing a bundle.
  var enableContinue = function () {
    var st = load(); if (!st.items.length && !st.credit.length && !D.requiredShare) return;
    var tb = document.createElement('div'); tb.innerHTML = T.typesContinue || '';
    Array.prototype.forEach.call(document.querySelectorAll('footer button, [data-replay-next]'), function (c) {
      if (!/^continue/i.test(txt(c)) || !(c.disabled || c.getAttribute('aria-disabled') === 'true')) return;
      var en = tb.firstElementChild ? tb.firstElementChild.cloneNode(true) : null;
      if (en) { if (c.hasAttribute('data-replay-next')) en.setAttribute('data-replay-next', '1'); c.replaceWith(en); if (next === c) next = en; }
      else { c.removeAttribute('disabled'); c.removeAttribute('aria-disabled'); }
    });
  };
  var syncBar = function () { if (!filledBar) return; var st = load(); filledBar.style.display = st.items.length || st.credit.length || D.requiredShare ? '' : 'none'; };
  if (R.live) { enableContinue(); syncBar(); document.addEventListener('replay-cart', function () { enableContinue(); syncBar(); }); }
  var cartBtn = document.querySelector('[data-testid="multiple-accounts-button"]');
  var tplName = function (li) { var names = texts(li).map(function (n) { return n.nodeValue.trim(); }); return (D.products || []).filter(function (x) { return names.indexOf(x.name) >= 0; })[0]; };

  var setRowArt = function (row, d) {
    row.setAttribute('data-design', d.id);
    var name = row.querySelector('[data-testid="demo-cart-debit-name"]'); if (name) name.textContent = d.name;
    var art = row.querySelector('[data-testid^="demo-card-art-debit-"]');
    if (art) { art.setAttribute('data-testid', 'demo-card-art-debit-' + d.id); art.style.backgroundImage = 'url("../../assets/' + d.image + '")'; art.style.backgroundSize = 'cover'; art.setAttribute('aria-label', d.name + ' debit card'); }
  };
  // Design radios inside a captured panel/dialog: swap the captured on/off classes on click.
  var designRadios = function (root, start, onPick) {
    var radios = Array.prototype.slice.call(root.querySelectorAll('[role="radio"], input[type="radio"]')).filter(function (r) { return (D.debitDesigns || []).some(function (d) { return d.name === (txt(r) || (r.labels && r.labels[0] && txt(r.labels[0])) || r.value); }); });
    var onCls = (radios.filter(function (r) { return r.getAttribute('aria-checked') === 'true' || r.checked; })[0] || {}).className;
    var offCls = (radios.filter(function (r) { return r.getAttribute('aria-checked') !== 'true' && !r.checked; })[0] || {}).className;
    var pick = start;
    var nameOf = function (r) { return txt(r) || (r.labels && r.labels[0] && txt(r.labels[0])) || r.value; };
    var paint = function () { radios.forEach(function (r) { var on = nameOf(r) === design(pick).name; r.setAttribute('aria-checked', on ? 'true' : 'false'); if (r.type === 'radio') r.checked = on; if (onCls && offCls && r.getAttribute('role') === 'radio') r.className = on ? onCls : offCls; }); };
    radios.forEach(function (r) { (r.closest('label') || r).addEventListener('click', function () { pick = (D.debitDesigns.filter(function (d) { return d.name === nameOf(r); })[0] || {}).id || pick; paint(); onPick(pick); }); });
    paint();
  };

  // Cloned rows get their own ids so aria-labelledby names each button after its own row.
  var uid = 0;
  var reId = function (root) {
    var map = {}; root.querySelectorAll('[id]').forEach(function (el) { var n = el.id + '-r' + (++uid); map[el.id] = n; el.id = n; });
    root.querySelectorAll('[aria-labelledby],[aria-describedby],[for],[aria-controls]').forEach(function (el) { ['aria-labelledby', 'aria-describedby', 'for', 'aria-controls'].forEach(function (a) { var v = el.getAttribute(a); if (v) el.setAttribute(a, v.split(' ').map(function (x) { return map[x] || x; }).join(' ')); }); });
  };
  var overlay;
  var closeCart = function () { if (overlay) { overlay.remove(); overlay = null; } openNow = {}; };
  var openPanel = function (dlg, item, state) {
    if (!panelTpl) return;
    var p = panelTpl.cloneNode(true); var pr = product(item.productId);
    var title = p.querySelector('h3'); if (title) title.textContent = pr.name + ' options';
    var pick = item.design || design().id;
    designRadios(p, pick, function (v) { pick = v; });
    // Instant issue (item 2): "Instant digital card" / "Mailed card only" swap in the captured selected state; kept with the account.
    var dPick = item.delivery || 'instant';
    var dPaint = function () {
      var g = p.querySelector('[role="radiogroup"]:has([data-testid^="demo-debit-delivery-"])'); var tpl = (T.delivery || {})[dPick]; if (!g || !tpl) return;
      var bx = document.createElement('div'); bx.innerHTML = tpl; var ng = bx.firstElementChild; if (!ng) return; g.replaceWith(ng);
      ng.querySelectorAll('[data-testid^="demo-debit-delivery-"]').forEach(function (r) { r.addEventListener('click', function (e) { e.preventDefault(); dPick = r.getAttribute('data-testid').replace('demo-debit-delivery-', ''); dPaint(); }); });
    };
    dPaint();
    Array.prototype.slice.call(p.querySelectorAll('button')).forEach(function (b) {
      if (/^save$/i.test(txt(b))) b.addEventListener('click', function () { item.design = pick; item.delivery = dPick; save(state); p.remove(); renderCart(); });
      if (/close options/i.test(b.getAttribute('aria-label') || '')) b.addEventListener('click', function () { p.remove(); });
    });
    dlg.style.position = dlg.style.position || 'fixed'; dlg.appendChild(p);
  };
  var modal = function (dlg) {
    var o = document.createElement('div'); o.setAttribute('data-replay-cart', '');
    o.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(17,24,39,.45);display:flex;align-items:center;justify-content:center;overflow:auto';
    dlg.style.position = 'relative'; dlg.style.inset = 'auto'; dlg.style.transform = 'none'; dlg.style.margin = 'auto'; dlg.style.maxHeight = '100vh'; dlg.style.overflow = 'auto';
    o.appendChild(dlg); document.body.appendChild(o); return o;
  };
  var renderCart = function () {
    var state = load(); closeCart(); if (!cartTpl) return;
    var dlg = cartTpl.cloneNode(true); var ul = dlg.querySelector('ul'); if (!ul) return;
    ul.innerHTML = '';
    if (D.requiredShare && shareTpl) ul.appendChild(shareTpl.cloneNode(true));
    else if (D.requiredShare && acctTpl && product(D.requiredShare)) {
      // Captured without a share row (existing member): an account row named as the share, no buttons, no debit card.
      var sl = acctTpl.cloneNode(true); var w0 = tplName(sl); var spr = product(D.requiredShare);
      if (w0) { texts(sl).forEach(function (n) { if (n.nodeValue.indexOf(w0.name) >= 0) n.nodeValue = n.nodeValue.split(w0.name).join(spr.name); }); replaceText(sl, w0.typeName, spr.typeName); }
      sl.querySelectorAll('button').forEach(function (b) { b.remove(); }); var dr = sl.querySelector('[data-testid="demo-cart-debit-row"]'); if (dr) (dr.closest('[data-demo-cart-debit]') || dr).remove();
      reId(sl); ul.appendChild(sl);
    }
    state.items.forEach(function (item) {
      var pr = product(item.productId); if (!pr || !acctTpl) return;
      var li = acctTpl.cloneNode(true); var was = tplName(li);
      if (was) { texts(li).forEach(function (n) { if (n.nodeValue.indexOf(was.name) >= 0) n.nodeValue = n.nodeValue.split(was.name).join(pr.name); }); replaceText(li, was.typeName, pr.typeName); }
      li.querySelectorAll('[aria-label]').forEach(function (n) { if (was) n.setAttribute('aria-label', n.getAttribute('aria-label').replace(was.name, pr.name)); });
      var debit = li.querySelector('[data-testid="demo-cart-debit-row"]');
      if (debit) { if (pr.debit) setRowArt(debit, design(item.design)); else (debit.closest('[data-demo-cart-debit]') || debit).remove(); }
      li.querySelectorAll('button').forEach(function (b) {
        var label = b.getAttribute('aria-label') || txt(b);
        if (/change debit card/i.test(label)) b.addEventListener('click', function () { openPanel(dlg, item, state); });
        else if (/remove/i.test(label)) b.addEventListener('click', function () { var s = load(); s.items = s.items.filter(function (x) { return x.productId !== item.productId; }); delete s.amounts[item.productId]; save(s); renderCart(); document.dispatchEvent(new Event('replay-cart')); });
      });
      reId(li); ul.appendChild(li);
    });
    state.credit.forEach(function (name) {
      if (!creditTpl) return; var li = creditTpl.cloneNode(true); var old = li.getAttribute('data-demo-credit-card');
      texts(li).forEach(function (n) { if (n.nodeValue.indexOf(old) >= 0) n.nodeValue = n.nodeValue.split(old).join(name); }); li.setAttribute('data-demo-credit-card', name);
      li.querySelectorAll('[aria-label]').forEach(function (n) { n.setAttribute('aria-label', n.getAttribute('aria-label').replace(old, name)); });
      reId(li); li.querySelectorAll('button').forEach(function (b) { if (/remove/i.test(b.getAttribute('aria-label') || txt(b))) b.addEventListener('click', function () { var s = load(); s.credit = s.credit.filter(function (c) { return c !== name; }); save(s); renderCart(); document.dispatchEvent(new Event('replay-cart')); }); });
      ul.appendChild(li);
    });
    dlg.querySelectorAll('button').forEach(function (b) {
      if (b.closest('ul')) return;
      if (/^(close|ok)$/i.test(txt(b)) || /close/i.test(b.getAttribute('aria-label') || '')) b.addEventListener('click', closeCart);
    });
    overlay = modal(dlg); openNow = { cart: true };
    if (cartBtn) replaceCount(state);
  };
  var replaceCount = function (state) {
    var n = state.items.length + state.credit.length + (D.requiredShare ? 1 : 0); var w = document.createTreeWalker(cartBtn, NodeFilter.SHOW_TEXT);
    for (var t = w.nextNode(); t; t = w.nextNode()) if (/^\d+$/.test(t.nodeValue.trim())) { t.nodeValue = String(n); return; }
  };
  var addProducts = function (ids, credit, designId, from) {
    var state = load();
    ids.forEach(function (id) { if (id !== D.requiredShare && !state.items.some(function (x) { return x.productId === id; })) state.items.push({ productId: id, design: designId || (D.debitDesigns[0] || {}).id, from: from || null }); });
    (credit || []).forEach(function (c) { if (state.credit.indexOf(c) < 0) state.credit.push(c); });
    save(state); renderCart(); document.dispatchEvent(new Event('replay-cart'));
  };
  reopen.cart = renderCart;
  if (cartBtn) { replaceCount(load()); cartBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); renderCart(); }, true); document.addEventListener('replay-cart', function () { replaceCount(load()); }); }

  // One bundle at a time: choosing another bundle takes out the earlier bundle's accounts and credit card (accounts
  // added one by one stay), so the cart never holds two bundles' cards.
  var chooseBundle = function (bundle) {
    var state = load(); var prev = (D.bundles || []).filter(function (x) { return x.name === state.bundle && x.name !== bundle.name; })[0];
    if (prev) {
      state.items = state.items.filter(function (x) { return x.from !== prev.name; });
      state.credit = state.credit.filter(function (c) { return prev.creditCards.indexOf(c) < 0; });
      Object.keys(state.amounts).forEach(function (k) { if (!inCart(state, k)) delete state.amounts[k]; });
    }
    state.bundle = bundle.name; save(state); addProducts(bundle.products, bundle.creditCards, null, bundle.name);
  };
  var showNext = function () { var on = load().items.length || load().credit.length; if (next) next.style.visibility = on ? '' : 'hidden'; var f = next && next.closest('footer'); if (f && R.live === 'account-types') f.style.display = on ? '' : 'none'; };
  if (R.live === 'account-types') {
    // Bundle cards: same header height and card height at every width (titles wrap differently), button pinned below.
    var evenBundles = function () {
      var sec = document.querySelector('[data-testid="demo-bundles"]'); if (!sec) return;
      var heads = Array.prototype.slice.call(sec.querySelectorAll('[class*="CardHeaderGroup"]')); var cards = heads.map(function (h) { return h.parentElement; });
      heads.concat(cards).forEach(function (el) { el.style.minHeight = ''; });
      var hh = Math.max.apply(null, heads.map(function (h) { return h.getBoundingClientRect().height; })); heads.forEach(function (h) { h.style.minHeight = Math.ceil(hh) + 'px'; });
      var ch = Math.max.apply(null, cards.map(function (c) { return c.getBoundingClientRect().height; })); cards.forEach(function (c) { c.style.minHeight = Math.ceil(ch) + 'px'; });
    };
    evenBundles(); window.addEventListener('resize', evenBundles); if (document.fonts && document.fonts.ready) document.fonts.ready.then(evenBundles);
    showNext(); document.addEventListener('replay-cart', showNext);
    document.querySelectorAll('button').forEach(function (b) {
      if (!/choose this bundle/i.test(txt(b))) return;
      var card = b; while (card.parentElement && card.parentElement.querySelectorAll('button').length === 1) card = card.parentElement;
      var bundle = (D.bundles || []).filter(function (x) { return txt(card).indexOf(x.name) >= 0; })[0];
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (bundle) chooseBundle(bundle); }, true);
    });
    // Recommended for You box (item 1): "Open both" chooses its bundle; a product card's Add adds that account.
    var rec = document.querySelector('[data-testid="demo-recommended-bundle"]');
    if (rec) {
      var recB = (D.bundles || []).filter(function (x) { return x.name === rec.getAttribute('aria-label'); })[0] || (D.bundles || []).filter(function (x) { return txt(rec).indexOf(x.name) >= 0; })[0] || (D.bundles || []).filter(function (x) { return x.name === R.bundle; })[0];
      rec.querySelectorAll('button').forEach(function (b) { if (/^open both/i.test(txt(b)) && recB) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); chooseBundle(recB); }, true); });
      rec.querySelectorAll('[data-testid="demo-recommended-product"]').forEach(function (pc) {
        var pr = (D.products || []).filter(function (x) { return txt(pc).indexOf(x.name) >= 0; }).sort(function (a, b) { return b.name.length - a.name.length; })[0];
        pc.querySelectorAll('button:not([disabled])').forEach(function (b) { if (pr) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); addProducts([pr.id]); }, true); });
      });
    }
    var typeNames = (D.products || []).map(function (x) { return x.typeName; });
    Array.prototype.slice.call(document.querySelectorAll('body *')).forEach(function (el) {
      var label = txt(el); if (typeNames.indexOf(label) < 0 || Array.prototype.some.call(el.children, function (c) { return txt(c) === label; })) return;
      var f = byFile(function (s) { return s.live === 'products' && label && s.name === 'products-' + label.split(' ')[0].toLowerCase(); });
      if (!f) return; var tile = el.closest('[role="button"], button, article, a') || el.parentElement;
      tile.style.cursor = 'pointer'; tile.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(f); }, true);
    });
  }
  if (R.live === 'products') {
    var listType = (R.name || '').replace('products-', '');
    document.querySelectorAll('button[disabled]').forEach(function (b) { if (/^continue/i.test(txt(b))) b.removeAttribute('disabled'); });
    var types = byFile(function (s) { return s.live === 'account-types'; });
    var openFeatures = function (pr) {
      var src = (T.features || {})[listType]; if (!src) { addProducts([pr.id]); return; }
      var box = document.createElement('div'); box.innerHTML = src; var dlg = box.firstElementChild;
      var was = tplName(dlg); if (was) texts(dlg).forEach(function (n) { if (n.nodeValue.indexOf(was.name) >= 0) n.nodeValue = n.nodeValue.replace(was.name, pr.name); });
      var pick = (D.debitDesigns[0] || {}).id; designRadios(dlg, pick, function (v) { pick = v; });
      var o = modal(dlg); openNow = { features: pr.id }; var shut = o.remove.bind(o); o.remove = function () { openNow = {}; shut(); };
      dlg.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.removeAttribute('disabled'); });
      dlg.querySelectorAll('button').forEach(function (b) {
        var label = b.getAttribute('aria-label') || txt(b);
        if (/^add account$/i.test(txt(b))) b.addEventListener('click', function (e) { e.preventDefault(); o.remove(); addProducts([pr.id], [], pick); });
        else if (/close/i.test(label)) b.addEventListener('click', function (e) { e.preventDefault(); o.remove(); });
      });
    };
    reopen.features = function (id) { var pr = product(id); if (pr) openFeatures(pr); };
    document.querySelectorAll('main button').forEach(function (b) {
      var label = txt(b); if (!/^(\+\s*)?add\b/i.test(label)) return;
      var pr = productByName(label.replace(/^(\+\s*)?add\s+/i, ''));
      if (!pr) { var only = (D.products || []).filter(function (p) { return p.type === listType || p.type.indexOf(listType) === 0; }); if (only.length === 1) pr = only[0]; }
      if (!pr) return;
      b.removeAttribute('disabled'); b.removeAttribute('aria-disabled');
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openFeatures(pr); }, true);
    });
    document.querySelectorAll('button').forEach(function (b) { if (/^continue/i.test(txt(b))) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(types); }, true); });
    document.querySelectorAll('header button, [aria-label*="back" i]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(types); }, true); });
  }
})();
