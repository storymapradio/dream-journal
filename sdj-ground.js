/* sdj-ground.js — the moving grounds.
 *
 * Slow balatro paint behind the whole page: five patterns, each drawn
 * small, posterized to three tones of one chosen hue, and scaled up
 * chunky. Reads LS 'ivr:theme' { bg, bgHue, bgScope }; pages carrying
 * data-home="1" always show the ground, other pages only when the
 * scope is 'everywhere'. window.SDJGround.sync() re-reads everything.
 */
(function () {
  'use strict';
  var PAGE_IS_HOME = !!(document.currentScript && document.currentScript.dataset.home);
  var BGS = [
    { key: 'off',      label: 'off',          hue: null },
    { key: 'swirl',    label: 'the swirl',    hue: 130 },
    { key: 'undertow', label: 'the undertow', hue: 220 },
    { key: 'lava',     label: 'the lava',     hue: 25 },
    { key: 'smoke',    label: 'the smoke',    hue: 285 },
    { key: 'pour',     label: 'the pour',     hue: 55 },
  ];
  var PAT = {
    swirl: function (u, w, r, a, t) {
      var ang = a + 0.25 * t + 4.0 / (r + 0.35);
      var band = Math.sin(ang * 3 + Math.sin(r * 6 - t * 0.7) * 2);
      return Math.sin(band * 2 + Math.cos(ang * 2 - t * 0.5) + r * 4);
    },
    undertow: function (u, w, r, a, t) {
      return Math.sin(w * 5 + Math.sin(u * 3 + t * 0.8) * 1.4 - t * 0.6) * 0.7 +
             Math.sin(w * 9 + u * 2 - t * 0.9) * 0.5;
    },
    lava: function (u, w, r, a, t) {
      var f = 0;
      for (var k = 0; k < 4; k++) {
        var bx = Math.sin(t * 0.4 + k * 2.2) * 0.7, by = Math.cos(t * 0.33 + k * 1.7) * 0.8;
        var dx = u - bx, dy = w - by;
        f += 0.05 / (dx * dx + dy * dy + 0.02);
      }
      return f - 1.15;
    },
    smoke: function (u, w, r, a, t) {
      return (Math.sin(u * 4 + t * 0.5) + Math.sin(w * 5 - t * 0.4) +
              Math.sin((u + w) * 3 + t * 0.9) + Math.sin(r * 6 - t * 0.5)) / 2;
    },
    pour: function (u, w, r, a, t) {
      return Math.sin((u * 0.8 + w * 1.6) * 4 - t * 1.2 + Math.sin(w * 6 + t) * 0.7);
    },
  };
  function readTheme() {
    try { return JSON.parse(localStorage.getItem('ivr:theme') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function h2rgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  var raf = null, canvas = null;
  function ensureCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.id = 'sdjGround';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;' +
      'image-rendering:pixelated;pointer-events:none;opacity:0.5;display:none;';
    var host = document.getElementById('sdjDevice') || document.body;
    host.insertBefore(canvas, host.firstChild);
    return canvas;
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (canvas) canvas.style.display = 'none';
    if (document.body) document.body.style.background = '';
    document.documentElement.classList.remove('sdj-grounded');
  }
  function start(v, bgHue) {
    var cv = ensureCanvas();
    cv.style.display = 'block';
    document.body.style.background = 'transparent';
    document.documentElement.classList.add('sdj-grounded');
    var ctx = cv.getContext('2d');
    var W = 96, H = 170;
    cv.width = W; cv.height = H;
    var img = ctx.createImageData(W, H), px = img.data;
    var h = bgHue || 0;
    var cols = [10, 22, 38].map(function (l) {
      return h ? h2rgb(h, 62, l) : h2rgb(0, 0, l + 8);
    });
    var fn = PAT[v.key] || PAT.swirl;
    var last = 0;
    var frame = function (t) {
      raf = requestAnimationFrame(frame);
      if (t - last < 66) return;      // an easy fifteen frames a second
      last = t;
      var tt = t / 1000 * 0.08;       // molasses
      var i = 0;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var u = (x / W - 0.5) * 2, w = (y / H - 0.5) * 2.1;
          var r = Math.sqrt(u * u + w * w), a = Math.atan2(w, u);
          var p = fn(u, w, r, a, tt);
          var col = p > 0.45 ? cols[2] : p > -0.2 ? cols[1] : cols[0];
          px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
          i += 4;
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    var t = readTheme();
    var v = null;
    for (var i = 0; i < BGS.length; i++) if (BGS[i].key === t.bg) v = BGS[i];
    stop();
    if (!v || v.hue === null) return;
    if (!PAGE_IS_HOME && t.bgScope !== 'everywhere') return;
    var bh = t.bgHue != null ? parseInt(t.bgHue, 10) : v.hue;
    start(v, bh);
  }
  window.SDJGround = { BGS: BGS, sync: sync };
  if (document.body) sync();
  else document.addEventListener('DOMContentLoaded', sync);
  window.addEventListener('storage', function (e) { if (e.key === 'ivr:theme') sync(); });
})();
