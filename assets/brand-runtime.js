// Brand colors for the replay, shared by the build (node apply-brand.cjs) and every page (site/assets/brand-runtime.js).
// The frozen screens keep each brand shade as a CSS variable: --rb-<source hex> (and --rb-<source hex>-rgb for rgba()).
// mapShade() turns a shade of the source primary into the same shade of another primary: same hue offset, saturation
// scaled, lightness kept on the same white-to-primary-to-black scale (the primary maps to the primary, white stays white).
// In a page, a color picked on the launcher (localStorage "replay-brand-colors") overrides the built colors at runtime.
(function (root) {
  var hexToRgb = function (hex) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  var rgbToHex = function (c) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); };
  var rgbToHsl = function (c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b); var l = (mx + mn) / 2; var d = mx - mn; if (!d) return [0, 0, l];
    var s = d / (1 - Math.abs(2 * l - 1)); var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [((h * 60) + 360) % 360, s, l];
  };
  var hslToRgb = function (h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s; var x = c * (1 - Math.abs(((h / 60) % 2) - 1)); var m = l - c / 2; var p = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(p[0] + m) * 255, (p[1] + m) * 255, (p[2] + m) * 255];
  };
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  /** Is this color a shade of the source primary (same hue family, not a grey)? */
  var isShade = function (hex, sourcePrimary) {
    var c = rgbToHsl(hexToRgb(hex)); var p = rgbToHsl(hexToRgb(sourcePrimary)); var dh = Math.abs(((c[0] - p[0] + 540) % 360) - 180);
    // Greyish lavenders (borders), dark inks and flag/monogram navies in the replicas are not brand shades.
    return dh <= 18 && c[2] > 0.04 && c[2] < 0.985 && c[1] > 0.25 && (c[2] >= 0.4 || c[1] > 0.4);
  };
  var mapShade = function (hex, sourcePrimary, targetPrimary) {
    // A lighter shade is the source primary mixed with white by t; a darker one is it scaled toward black by k. The same
    // mix of the target primary gives the target shade (soft tints stay soft, the primary maps to the primary).
    var c = hexToRgb(hex); var p = hexToRgb(sourcePrimary); var n = hexToRgb(targetPrimary);
    var avg = function (f) { return (f(0) + f(1) + f(2)) / 3; };
    if (rgbToHsl(c)[2] >= rgbToHsl(p)[2]) { var t = clamp(avg(function (i) { return p[i] >= 255 ? 1 : (c[i] - p[i]) / (255 - p[i]); })); return rgbToHex(n.map(function (v) { return v + (255 - v) * t; })); }
    var k = clamp(avg(function (i) { return p[i] ? c[i] / p[i] : 0; })); return rgbToHex(n.map(function (v) { return v * k; }));
  };
  var luminance = function (hex) { return hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (t, v, i) { return t + v * [0.2126, 0.7152, 0.0722][i]; }, 0); };
  /** WCAG contrast of white text on this color (4.5 or more reads well for normal text). */
  var whiteContrast = function (hex) { return 1.05 / (luminance(hex) + 0.05); };
  /** The full shade table for a target primary (and optional exact secondary). */
  var shadeTable = function (shades, sourcePrimary, sourceSecondary, targetPrimary, targetSecondary) {
    var out = {}; shades.forEach(function (s) { out[s] = targetSecondary && sourceSecondary && s === sourceSecondary.toLowerCase() ? targetSecondary.toLowerCase() : mapShade(s, sourcePrimary, targetPrimary); }); return out;
  };
  var api = { hexToRgb: hexToRgb, rgbToHex: rgbToHex, isShade: isShade, mapShade: mapShade, whiteContrast: whiteContrast, shadeTable: shadeTable };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.REPLAY_BRAND_COLORS = api;

  // ---- In a page ----
  var B = root.REPLAY_BRAND; if (!B || typeof document === 'undefined') return;
  var picked = null; try { picked = JSON.parse(localStorage.getItem('replay-brand-colors') || 'null'); } catch (e) { /* storage off */ }
  var valid = function (h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); };
  if (picked && valid(picked.primary)) {
    var table = shadeTable(B.shades, B.source.primary, B.source.secondary, picked.primary, valid(picked.secondary) ? picked.secondary : null);
    var css = ':root{' + Object.keys(table).map(function (s) { var c = hexToRgb(table[s]); return '--rb-' + s.slice(1) + ':' + table[s] + ';--rb-' + s.slice(1) + '-rgb:' + c.join(',') + ';'; }).join('') + '}';
    var st = document.createElement('style'); st.setAttribute('data-brand-runtime', ''); st.textContent = css; (document.head || document.documentElement).appendChild(st);
    // Illustrations drawn from SVG files (<img>) can't see CSS variables: recolor their source the same way.
    var recolor = function () {
      document.querySelectorAll('img[data-rb-svg]').forEach(function (img) {
        fetch(img.getAttribute('data-rb-svg')).then(function (r) { return r.text(); }).then(function (svg) {
          var outSvg = svg.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, function (m) { var h = '#' + hexToRgb(m).map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); return table[h] || m; });
          outSvg = outSvg.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, function (m, r, g, b, a) { var t = table[rgbToHex([+r, +g, +b])]; if (!t) return m; var c = hexToRgb(t); return a ? 'rgba(' + c.join(', ') + a + ')' : 'rgb(' + c.join(', ') + ')'; });
          img.src = URL.createObjectURL(new Blob([outSvg], { type: 'image/svg+xml' }));
        }).catch(function () { /* keep the built colors */ });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recolor); else recolor();
  }
  // White logo on every card face (debit, credit, wallet, lending cards) when the brand asks for it.
  if (B.cardLogo && B.logoWhite) {
    var mark = function () {
      document.querySelectorAll('[data-testid^="demo-card-art-"], [data-lending-card] img, img[data-card-art]').forEach(function (el) {
        var host = el.tagName === 'IMG' ? el.parentElement : el; if (!host || host.querySelector(':scope > .rb-card-logo')) return;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        var w = el.getBoundingClientRect().width || 100; var logo = document.createElement('img'); logo.className = 'rb-card-logo'; logo.alt = ''; logo.src = B.logoWhite;
        // Top-right corner: the printed card names (e.g. "Visa Signature") run along the top-left.
        logo.style.cssText = 'position:absolute;right:5%;top:7%;height:' + Math.max(6, Math.round(w * 0.07)) + 'px;width:auto;max-width:26%;object-fit:contain;object-position:right;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));z-index:1';
        host.appendChild(logo);
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
    var queued = false; var start = function () { new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; mark(); }, 60); }).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  // ---- Browser-only overrides from the launcher (IndexedDB "replay-overrides", store "o", key "current") ----
  // { primary, logo, logoWhite, cards: { "debit-classic": dataURL, … } }. Logos replace every data-rb-logo picture (and
  // the source brand lockup), card pictures replace every card face of that slot. Re-applied as screens change.
  var readOverrides = function () { return new Promise(function (ok) { try { var r = indexedDB.open('replay-overrides', 1); r.onupgradeneeded = function () { r.result.createObjectStore('o'); };
    r.onsuccess = function () { try { var g = r.result.transaction('o').objectStore('o').get('current'); g.onsuccess = function () { ok(g.result || null); }; g.onerror = function () { ok(null); }; } catch (e) { ok(null); } }; r.onerror = function () { ok(null); }; } catch (e) { ok(null); } }); };
  root.REPLAY_READ_OVERRIDES = readOverrides;
  readOverrides().then(function (O) {
    if (!O || !(O.logo || O.logoWhite || (O.cards && Object.keys(O.cards).length))) return;
    var url = function (d) { try { var m = /^data:([^;]+);base64,(.*)$/.exec(d); var bin = atob(m[2]); var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([a], { type: m[1] })); } catch (e) { return d; } };
    var L = { logo: O.logo ? url(O.logo) : null, white: O.logoWhite ? url(O.logoWhite) : null }; L.mark = L.logo; if (!L.white) L.white = L.logo; if (!L.logo) L.logo = L.mark = L.white;
    var cards = {}; Object.keys(O.cards || {}).forEach(function (k) { cards[k] = url(O.cards[k]); });
    var css = Object.keys(cards).map(function (k) { var kind = k.split('-')[0], id = k.slice(kind.length + 1);
      return '[data-testid="demo-card-art-' + kind + '-' + id + '"],div[data-rb-card="' + k + '"],span[data-rb-card="' + k + '"]{background-image:url("' + cards[k] + '") !important;background-size:cover !important;background-position:center !important}'; }).join('');
    var st = document.createElement('style'); st.setAttribute('data-browser-overrides', ''); st.textContent = css; (document.head || document.documentElement).appendChild(st);
    var apply = function () {
      document.querySelectorAll('img[data-rb-logo]').forEach(function (i) { var u = L[i.getAttribute('data-rb-logo')]; if (u && i.src !== u) { i.src = u; i.srcset = ''; i.style.objectFit = 'contain'; } });
      document.querySelectorAll('[data-rb-lockup]').forEach(function (s) { if (!L.logo || s.getAttribute('data-rb-lockup') === 'done') return; s.innerHTML = ''; var i = document.createElement('img'); i.setAttribute('data-rb-logo', 'logo'); i.src = L.logo; i.alt = ''; i.style.cssText = 'height:34px;width:auto;max-width:240px;object-fit:contain'; s.appendChild(i); s.style.width = 'auto'; s.setAttribute('data-rb-lockup', 'done'); });
      document.querySelectorAll('img[data-rb-card]').forEach(function (i) { var u = cards[i.getAttribute('data-rb-card')]; if (u && i.src !== u) { i.src = u; i.srcset = ''; } });
      document.querySelectorAll('img[data-card-art], [data-lending-card] img').forEach(function (i) { var t = i.closest('[data-testid^="demo-card-art-"]'); if (!t) return; var k = t.getAttribute('data-testid').replace('demo-card-art-', ''); if (cards[k] && i.src !== cards[k]) i.src = cards[k]; });
    };
    var queued = false; var start = function () { apply(); new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; apply(); }, 30); }).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  });
})(typeof window !== 'undefined' ? window : this);
