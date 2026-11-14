// Story screens runtime (site/<id>/story/, copied to site/assets/story.js): the Activation Agent, the direct deposit flow
// and the branch portal screens after account opening. Left and right arrows walk agent (ready, sent) -> direct deposit
// (landing, consent, employer, find account) -> Conversations -> the opened thread -> Recommendations; left from the
// first goes back; day 7 (the agent's button) counts as "sent". Two-key pairs, the same as the live demo: A G = Activation
// Agent, B C = branch Conversations, B R = branch Recommendations, O B = back to online banking (in the view the
// presenter came from). G then L = demo library. Hold ? = the list of these keys. Buttons captured as links (Fire the nudge, a conversation row) move on.
(function () {
  var S = window.REPLAY_STORY || {}; var ORDER = S.order || [];
  var LABELS = { ag: 'Activation Agent', bc: 'Branch portal: Conversations', br: 'Branch portal: Recommendations', ob: S.homeLabel || 'Online banking' };
  // A G only where the agent was captured; B R opens Wanda's application in the review story (capture-story.cjs).
  var TARGET = S.targets || { ag: 'agent-ready', bc: 'branch-conversations', br: 'branch-recommendations' };
  var go = function (f) { if (f) location.href = new URL(f, location.href).href; };
  var view = function () { try { if (window.parent !== window && window.parent.REPLAY_VIEW) return window.parent.REPLAY_VIEW(); } catch (e) { /* opened on its own */ } return 'desktop'; };
  var onlineBanking = function () { var v = view(); var ob = S.home || S.onlineBanking || {}; return ob[v] ? '../' + v + '/' + ob[v] : null; };
  var toast = function (label, then) {
    var t = document.createElement('div'); t.setAttribute('role', 'status'); t.textContent = 'Switching to ' + label;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483001;padding:12px 20px;border-radius:999px;background:rgb(16 24 40 / 92%);box-shadow:0 6px 20px rgb(16 24 40 / 30%);color:#fff;font:600 15px/1.3 system-ui,sans-serif;white-space:nowrap';
    document.body.appendChild(t); setTimeout(then, 600);
  };
  var at = ORDER.indexOf(S.standsFor || S.name);
  window.REPLAY_NAV = function (d) {
    if (d < 0) { if (at > 0) go(ORDER[at - 1] + '.html'); else history.back(); return; }
    if (at >= 0 && at < ORDER.length - 1) go(ORDER[at + 1] + '.html');
  };
  window.REPLAY_SWITCH = function (pair) {
    if (pair === 'ob') { var f = onlineBanking(); if (f) toast(LABELS.ob, function () { go(f); }); return; }
    if (!TARGET[pair] || TARGET[pair] === S.name) return;
    toast(LABELS[pair], function () { go(TARGET[pair] + '.html'); });
  };
  window.REPLAY_LIBRARY = function () {
    if (!window.confirm('Return to the demo library? Your cart will be lost.')) return;
    try { Object.keys(sessionStorage).forEach(function (k) { if (/^replay-(cart|switch)/.test(k)) sessionStorage.removeItem(k); }); } catch (e) { /* private mode */ }
    var lib = new URL('../../index.html', location.href).href; try { window.top.location.href = lib; } catch (e) { location.href = lib; }
  };
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-replay-goto]');
    if (g) { e.preventDefault(); e.stopPropagation(); go(g.getAttribute('data-replay-goto') + '.html'); return; }
    if (e.target.closest && e.target.closest('a, button, [role="button"], [role="tab"]')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  var first = ''; var firstAt = 0;
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    var a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); window.REPLAY_NAV(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.key === 'h' || e.key === 'H') { try { if (window.parent !== window && window.parent.REPLAY_TOGGLE_BAR) window.parent.REPLAY_TOGGLE_BAR(); } catch (err) { /* opened on its own */ } }
    var k = (e.key || '').toLowerCase(); if (!/^[a-z]$/.test(k)) { first = ''; return; }
    var pair = first + k; var inTime = Date.now() - firstAt <= 1000; first = k; firstAt = Date.now();
    if (!inTime) return;
    if (pair === 'gl') { first = ''; e.preventDefault(); window.REPLAY_LIBRARY(); return; }
    if (LABELS[pair] && (pair === 'ob' || TARGET[pair])) { first = ''; e.preventDefault(); window.REPLAY_SWITCH(pair); }
  });
  // Hold ? (Shift + /): the keyboard shortcuts that work on this screen (shown by the wrapper when it can), gone on release.
  var inWrapper = function (fn) { try { return window.parent !== window && typeof window.parent[fn] === 'function'; } catch (err) { return false; } };
  window.REPLAY_SHORTCUTS = function () {
    var move = []; if (at >= 0 && at < ORDER.length - 1) move.push({ keys: ['→'], label: 'Next screen' }); move.push({ keys: ['←'], label: 'Previous screen' });
    var jump = []; ['ag', 'bc', 'br'].forEach(function (k) { if (TARGET[k] && TARGET[k] !== S.name) jump.push({ keys: k.toUpperCase().split(''), then: true, label: k === 'br' && S.kind === 'review' ? 'Branch portal: the application in manual review' : LABELS[k] }); });
    if (onlineBanking()) jump.push({ keys: ['O', 'B'], then: true, label: LABELS.ob });
    var controls = []; if (inWrapper('REPLAY_TOGGLE_BAR')) controls.push({ keys: ['H'], label: 'Show or hide the previous / next bar' });
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
    var a = document.activeElement; if (e.key !== '?' || e.altKey || e.metaKey || e.ctrlKey || (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable))) return;
    e.preventDefault(); showKeySheet();
  }, true);
  document.addEventListener('keyup', function (e) { if (e.key === '?' || e.key === '/' || e.key === 'Shift') hideKeySheet(); }, true);
  window.addEventListener('blur', hideKeySheet);
  try { if (window.parent !== window && window.parent.REPLAY_SCREEN) window.parent.REPLAY_SCREEN({ file: '../story/' + S.name + '.html', story: true, name: S.name, title: document.title, next: at < ORDER.length - 1, index: -1, count: 0 }); } catch (e) { /* opened on its own */ }
})();
