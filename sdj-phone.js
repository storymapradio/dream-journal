/* sdj-phone — the column the journal stands in.
 *
 * The journal takes the whole of whatever window it is opened in. The column
 * is still here because it carries a transform, which makes it the containing
 * block for the app's fixed corners and frame, so nothing escapes it.
 */
(function () {
  'use strict';
  /* opened inside a window of the Engine: the housing has the corners already, so
     the journal gives up its own band and fills the window it is given */
  var framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed) {
    var fs = document.createElement('style');
    fs.textContent = 'html.in-window .solos-corner { padding-top:5px; }' +
      'html.in-window #frame { inset:34px 0 0 0 !important; border:0 !important; border-radius:0 !important; }';
    (document.head || document.documentElement).appendChild(fs);
    document.documentElement.classList.add('in-window');
  }
  if (window.__sdjDevice) return;
  // a phone is already a phone: the column is only for the wide screens
  var inApp = !!(window.webkit && window.webkit.messageHandlers &&
    window.webkit.messageHandlers.haptic);
  if (inApp || window.innerWidth < 520) return;
  var st = document.createElement('style');
  st.textContent = [
    'html, body { background:#000; }',
    '#sdjDevice { position:fixed; top:0; bottom:0; left:50%;',
    '  width:100vw;',
    '  transform:translateX(-50%) translateZ(0);',
    '  overflow:hidden; }',
    '#sdjGround { left:0 !important; right:0 !important; width:100% !important; }',
  ].join('\n');
  (document.head || document.documentElement).appendChild(st);
  function mount() {
    if (window.__sdjDevice) return;
    var d = document.createElement('div');
    d.id = 'sdjDevice';
    var kids = Array.prototype.slice.call(document.body.childNodes);
    document.body.appendChild(d);
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n === d) continue;
      if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE')) continue;
      d.appendChild(n);
    }
    window.__sdjDevice = d;
    window.dispatchEvent(new Event('resize'));
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
