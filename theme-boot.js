/**
 * theme-boot — SOLOS screens, applied BEFORE first paint.
 *
 * Two screens, after sfpc.study:
 *   · cathode ray (default) — white phosphor on near-black, scanlines,
 *     the glass of an old monitor. Monochrome unless a hue is set.
 *   · liquid crystal — pale gray panel, dark gray figures, no glow.
 * The universal color slider tints either screen: 0 is monochrome,
 * anything else colorizes the phosphor (or tints the crystal).
 *
 * Stored in LS 'ivr:theme' as {screen:'crt'|'lcd', hue:0..360}.
 * Legacy {mode:'light'} reads as liquid crystal.
 * pipe-menu re-applies later for live changes, harmlessly.
 */
(function () {
  'use strict';
  var t = {};
  try { t = JSON.parse(localStorage.getItem('ivr:theme') || '{}') || {}; } catch (e) {}
  var screen = t.screen === 'lcd' ? 'lcd' : (t.screen === 'crt' ? 'crt' : (t.mode === 'light' ? 'lcd' : 'crt'));
  var hue = parseInt(t.hue, 10) || 0;
  var doc = document.documentElement;
  doc.classList.toggle('solos-lcd', screen === 'lcd');
  doc.classList.toggle('solos-crt', screen === 'crt');

  // The whole application passes through the tube. Pages keep their own
  // ink; the screen decides what color the light is.
  var f;
  if (screen === 'lcd') {
    f = 'grayscale(1) invert(1) brightness(0.94) contrast(0.8)';
    if (hue) f += ' sepia(0.45) saturate(1.8) hue-rotate(' + ((hue + 310) % 360) + 'deg)';
  } else {
    f = hue
      ? 'grayscale(1) sepia(1) saturate(3.4) hue-rotate(' + ((hue + 310) % 360) + 'deg) brightness(1.08) contrast(1.05)'
      : 'grayscale(1) brightness(1.14) contrast(1.06)';
  }
  doc.style.filter = f;
  doc.style.backgroundColor = screen === 'lcd' ? '#0a0a0a' : '#050505';

  if (!document.getElementById('solos-theme-css')) {
    var st = document.createElement('style');
    st.id = 'solos-theme-css';
    st.textContent = [
      /* photographs stay positive on the crystal panel */
      'html.solos-lcd img, html.solos-lcd video { filter: invert(1); }',
      /* nothing anywhere shows a scrollbar — scrolling still works */
      '* { scrollbar-width: none !important; -ms-overflow-style: none !important; }',
      '*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }',
      /* the tube: scanlines over everything, under nothing */
      '#solosCRT { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; display: none;',
      '  background: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.22) 50%),',
      '    linear-gradient(90deg, rgba(255,0,0,0.05), rgba(0,255,0,0.02), rgba(0,0,255,0.05));',
      '  background-size: 100% 2px, 3px 100%; }',
      'html.solos-crt #solosCRT { display: block; }',
    ].join('\n');
    (document.head || doc).appendChild(st);
  }
  function mountOverlay() {
    if (document.getElementById('solosCRT')) return;
    var ov = document.createElement('div');
    ov.id = 'solosCRT';
    ov.setAttribute('aria-hidden', 'true');
    (document.body || doc).appendChild(ov);
  }
  if (document.body) mountOverlay();
  else document.addEventListener('DOMContentLoaded', mountOverlay);

  // Nothing shows before the boot: an opaque cover from the first paint.
  // pipe-menu takes it over and plays the page's power-on; on pages
  // without the chrome (games, embeds) it simply fades away.
  if (!document.getElementById('solosBootCover')) {
    var cov = document.createElement('div');
    cov.id = 'solosBootCover';
    cov.setAttribute('aria-hidden', 'true');
    cov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;' +
      'z-index:2147483002;pointer-events:none;transition:opacity 1.1s ease;';
    doc.appendChild(cov);
    setTimeout(function () {
      var c = document.getElementById('solosBootCover');
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }, 9000);
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        if (window.__solosBootTakeover) return;
        var c = document.getElementById('solosBootCover');
        if (!c) return;
        c.style.opacity = '0';
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 1200);
      }, 950);
    });
  }

  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    (document.head || doc).appendChild(meta);
  }
  meta.setAttribute('content', screen === 'lcd' ? '#e0dedf' : '#050505');
})();
