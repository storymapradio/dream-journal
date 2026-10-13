/* sdj-stage — the two instruments the journal listens and speaks with.
 *
 * SDJStage.listen(host, opts) — the wheel of three triangles, turning while
 *   the bank plays. It begins on its own, moves from one recording to the
 *   next, keeps the listening clock, and rests when paused.
 *
 * SDJStage.record(host, opts) — the voice's own circle, breathing with what
 *   the microphone hears, with the four buttons: arm, record, pause, stop.
 *
 * Both wear the journal's colors and its liquid glass.
 */
(function () {
  'use strict';

  function ink() {
    const s = getComputedStyle(document.documentElement);
    return {
      accent: (s.getPropertyValue('--amber') || '#ffd24d').trim(),
      quiet: (s.getPropertyValue('--g-dim') || 'rgba(221,221,221,0.55)').trim(),
      ring: (s.getPropertyValue('--g-faint') || 'rgba(221,221,221,0.3)').trim(),
    };
  }
  function rgba(hex, a) {
    const h = (hex || '').trim();
    if (h.startsWith('rgb')) return h.replace(/rgba?\(([^)]+)\)/, (m, inner) => {
      const p = inner.split(',').map((x) => x.trim());
      return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
    });
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!m) return 'rgba(255,210,77,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' +
      parseInt(m[3], 16) + ',' + a + ')';
  }

  const GLYPH = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
    rewind: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
    done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  };

  function ensureCSS() {
    if (document.getElementById('sdj-stage-css')) return;
    const st = document.createElement('style');
    st.id = 'sdj-stage-css';
    st.textContent = [
      '.stStage { position:relative; width:min(300px, 74vw); height:min(300px, 74vw);',
      '  display:flex; align-items:center; justify-content:center; margin:0 auto; }',
      '.stStage canvas { position:absolute; inset:0; width:100%; height:100%; }',
      '.stCtl { position:relative; z-index:2; display:flex; align-items:center; gap:8px; }',
      '.stBtn { position:relative; width:44px; height:44px; border-radius:50%;',
      '  border:2px solid var(--g-faint, rgba(221,221,221,0.3));',
      '  background:rgba(10,10,8,0.55); backdrop-filter:blur(9px); -webkit-backdrop-filter:blur(9px);',
      '  color:var(--text, #ddd); cursor:pointer; display:flex; align-items:center;',
      '  justify-content:center; box-shadow:0 3px 0 rgba(0,0,0,0.55);',
      '  transition:transform .12s, border-color .18s, color .18s, background .18s; }',
      '.stBtn:active { transform:translateY(2px); }',
      '.stBtn svg { width:18px; height:18px; }',
      '.stBtn:disabled { opacity:0.3; cursor:default; }',
      '.stBtn.on { border-color:var(--amber, #ffd24d); color:var(--amber, #ffd24d);',
      '  background:rgba(46,36,12,0.7); box-shadow:0 3px 0 rgba(0,0,0,0.55), 0 0 20px; }',
      '.stBtn .lbl { position:absolute; bottom:-17px; left:50%; transform:translateX(-50%);',
      '  font-size:10px; letter-spacing:0.12em; text-transform:uppercase;',
      '  color:var(--g-dim, rgba(221,221,221,0.5)); }',
      '.stStatus { text-align:center; font-size:16px; letter-spacing:0.1em;',
      '  color:var(--g-dim, rgba(221,221,221,0.55)); min-height:22px; }',
      '.stClock { text-align:center; font-size:22px; letter-spacing:0.12em;',
      '  color:var(--amber, #ffd24d); min-height:26px; }',
      '.stDone { font-family:inherit; font-size:17px; letter-spacing:0.1em; color:#fff;',
      '  background:#1f9e4d; border:2px solid #2fd06a; border-radius:9px; padding:9px 26px;',
      '  cursor:pointer; box-shadow:0 3px 0 rgba(0,0,0,0.55); transition:transform .12s; }',
      '.stDone:active { transform:translateY(2px); }',
    ].join('\n');
    document.head.appendChild(st);
  }

  function btn(glyph, label, fn) {
    const b = document.createElement('button');
    b.className = 'stBtn';
    b.innerHTML = glyph + '<span class="lbl">' + label + '</span>';
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
    return b;
  }
  function clock(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ── the listening wheel ──────────────────────────────────────────────
  function listen(host, opts) {
    ensureCSS();
    opts = opts || {};
    const tracks = (opts.tracks || []).slice();
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = tracks[i]; tracks[i] = tracks[j]; tracks[j] = t;
    }
    const wrap = document.createElement('div');
    const stage = document.createElement('div');
    stage.className = 'stStage';
    const cv = document.createElement('canvas');
    stage.appendChild(cv);
    const ctl = document.createElement('div');
    ctl.className = 'stCtl';
    stage.appendChild(ctl);
    const clockEl = document.createElement('div');
    clockEl.className = 'stClock';
    const status = document.createElement('div');
    status.className = 'stStatus';
    status.textContent = tracks.length ? 'listening' : 'the bank is quiet';
    wrap.appendChild(stage);
    wrap.appendChild(clockEl);
    wrap.appendChild(status);
    host.appendChild(wrap);

    const audio = new Audio();
    audio.preload = 'auto';
    let at = 0, playing = false, angle = 0, raf = null, last = 0;
    let heard = 0, tick = null;
    const size = () => Math.round(stage.getBoundingClientRect().width) || 300;

    function draw() {
      const S = size();
      if (cv.width !== S || cv.height !== S) { cv.width = S; cv.height = S; }
      const ctx = cv.getContext('2d');
      const C = S / 2, R = Math.round(S * 0.41), T = Math.round(S * 0.03);
      const k = ink();
      ctx.clearRect(0, 0, S, S);
      const grd = ctx.createRadialGradient(C, C, R - 8, C, C, R + 26);
      grd.addColorStop(0, playing ? rgba(k.accent, 0.14) : 'rgba(180,180,190,0.06)');
      grd.addColorStop(1, rgba(k.accent, 0));
      ctx.beginPath(); ctx.arc(C, C, R + 26, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2);
      ctx.strokeStyle = playing ? rgba(k.accent, 0.55) : k.ring;
      ctx.lineWidth = playing ? 2 : 1.6;
      if (playing) { ctx.shadowBlur = 12; ctx.shadowColor = rgba(k.accent, 0.45); }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.save(); ctx.translate(C, C); ctx.rotate(angle);
      ctx.fillStyle = playing ? rgba(k.accent, 0.9) : 'rgba(190,190,200,0.3)';
      if (playing) { ctx.shadowBlur = 8; ctx.shadowColor = rgba(k.accent, 0.55); }
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate((i * 2 * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(R, 0); ctx.lineTo(R - T, -T); ctx.lineTo(R - T, T);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.shadowBlur = 0; ctx.restore();
    }
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      const dt = last ? (ts - last) / 1000 : 0;
      last = ts;
      if (playing) angle += 0.3 * dt;
      draw();
    }
    raf = requestAnimationFrame(loop);

    function load(i) {
      if (!tracks.length) return false;
      at = ((i % tracks.length) + tracks.length) % tracks.length;
      const t = tracks[at];
      if (opts.urlFor) {
        return opts.urlFor(t).then((u) => { audio.src = u; return true; });
      }
      audio.src = t.url;
      return Promise.resolve(true);
    }
    async function play() {
      if (!tracks.length) return;
      if (!audio.src) await load(at);
      try { await audio.play(); } catch (e) {}
      playing = true;
      status.textContent = 'listening';
      if (opts.onHeard) opts.onHeard(tracks[at]);
      if (!tick) tick = setInterval(() => {
        heard += 1000;
        clockEl.textContent = clock(heard) + (opts.window ? ' of ' + opts.window + ':00' : '');
        if (opts.window && heard >= opts.window * 60000) { pause(); status.textContent = 'the window is full'; }
      }, 1000);
      sync();
    }
    function pause() {
      audio.pause();
      playing = false;
      status.textContent = 'paused';
      if (tick) { clearInterval(tick); tick = null; }
      sync();
    }
    audio.addEventListener('ended', async () => {
      if (!playing) return;
      await load(at + 1);
      try { await audio.play(); } catch (e) {}
      if (opts.onHeard) opts.onHeard(tracks[at]);
    });
    audio.addEventListener('error', async () => {
      if (playing && tracks.length > 1) { await load(at + 1); try { await audio.play(); } catch (e) {} }
    });

    const bPlay = btn(GLYPH.play, 'play', () => play());
    const bPause = btn(GLYPH.pause, 'pause', () => pause());
    ctl.appendChild(bPlay);
    ctl.appendChild(bPause);
    function sync() {
      bPlay.classList.toggle('on', playing);
      bPause.classList.toggle('on', !playing && heard > 0);
      bPlay.disabled = playing || !tracks.length;
      bPause.disabled = !playing;
    }
    sync();
    clockEl.textContent = clock(0) + (opts.window ? ' of ' + opts.window + ':00' : '');

    const done = document.createElement('button');
    done.className = 'stDone';
    done.textContent = 'DONE';
    done.addEventListener('click', (e) => {
      e.stopPropagation();
      stop();
      if (opts.onDone) opts.onDone(heard);
    });
    wrap.appendChild(done);

    function stop() {
      audio.pause();
      playing = false;
      if (tick) { clearInterval(tick); tick = null; }
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }
    // it begins on its own
    if (tracks.length) setTimeout(() => play(), 350);
    return { stop, el: wrap };
  }

  // ── the voice's own circle ───────────────────────────────────────────
  function record(host, opts) {
    ensureCSS();
    opts = opts || {};
    const LIMIT_MS = (opts.limitMinutes || 15) * 60000;
    const wrap = document.createElement('div');
    const stage = document.createElement('div');
    stage.className = 'stStage';
    const cv = document.createElement('canvas');
    stage.appendChild(cv);
    const ctl = document.createElement('div');
    ctl.className = 'stCtl';
    stage.appendChild(ctl);
    const clockEl = document.createElement('div');
    clockEl.className = 'stClock';
    clockEl.textContent = '0:00';
    wrap.appendChild(stage);
    wrap.appendChild(clockEl);
    host.appendChild(wrap);

    // the curve: one hundred and twenty-eight angles around the circle,
    // each reading its own place in the spectrum
    const N = 128;
    const COS = new Float64Array(N), SIN = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      COS[i] = Math.cos(a); SIN[i] = Math.sin(a);
    }
    let smoothR = null, spikeR = null, bins = null, minBin = 1, maxBin = 2;
    let media = null, rec = null, chunks = [], ac = null, analyser = null;
    let freqData = null, timeData = null;
    let state = 'idle', raf = null, phase = 0, smoothAmp = 0;
    let elapsed = 0, t0 = 0, tick = null;

    function size() { return Math.round(stage.getBoundingClientRect().width) || 300; }
    function draw() {
      const S = size();
      if (cv.width !== S || cv.height !== S) { cv.width = S; cv.height = S; }
      const ctx = cv.getContext('2d');
      const C = S / 2, BASE = Math.round(S * 0.38);
      const k = ink();
      const accent = (a) => rgba(state === 'recording' ? '#ff5046' : k.accent, a);
      ctx.clearRect(0, 0, S, S);

      if (!analyser || !freqData) {
        // at rest: a plain ring, holding still
        const grd = ctx.createRadialGradient(C, C, BASE - 4, C, C, BASE + 16);
        grd.addColorStop(0, accent(0.08));
        grd.addColorStop(1, accent(0));
        ctx.beginPath(); ctx.arc(C, C, BASE + 16, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(C, C, BASE, 0, Math.PI * 2);
        ctx.strokeStyle = k.ring; ctx.lineWidth = 1.6; ctx.stroke();
        return;
      }
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length);
      smoothAmp = smoothAmp * 0.8 + rms * 0.2;
      const vol = smoothAmp;

      if (!smoothR || smoothR.length !== N) {
        smoothR = new Float32Array(N).fill(BASE);
        spikeR = new Float32Array(N).fill(0);
      }
      const dynBase = BASE + vol * S * 0.04;
      const DEFORM = S * 0.085, WOBBLE = S * 0.018, SPIKE = S * 0.065, MAXR = S * 0.488;
      const finalR = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const bin = bins[i];
        let amp = freqData[Math.max(minBin, bin - 2)] + freqData[Math.max(minBin, bin - 1)] +
          freqData[bin] + freqData[Math.min(maxBin, bin + 1)] + freqData[Math.min(maxBin, bin + 2)];
        amp = (amp / 5) / 255;
        const a = (i / N) * Math.PI * 2;
        const wob = Math.sin(a * 3 + phase) * WOBBLE +
          Math.sin(a * 5 + phase * 1.4) * WOBBLE * 0.45 +
          Math.sin(a * 2 + phase * 0.65) * WOBBLE * 0.3;
        smoothR[i] = smoothR[i] * 0.7 + (dynBase + amp * DEFORM + wob) * 0.3;
        const raw = freqData[bin] / 255;
        spikeR[i] = spikeR[i] * 0.44 + Math.pow(raw, 1.6) * SPIKE * 0.56;
        finalR[i] = Math.min(smoothR[i] + spikeR[i], MAXR);
      }
      if (vol > 0.015) {
        const grd = ctx.createRadialGradient(C, C, 0, C, C, BASE * 1.18);
        grd.addColorStop(0, accent(vol * 0.07));
        grd.addColorStop(1, accent(0));
        ctx.beginPath(); ctx.arc(C, C, BASE * 1.18, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
      }
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const x1 = C + finalR[i] * COS[i], y1 = C + finalR[i] * SIN[i];
        const x2 = C + finalR[j] * COS[j], y2 = C + finalR[j] * SIN[j];
        if (i === 0) {
          const kk = N - 1;
          ctx.moveTo((C + finalR[kk] * COS[kk] + x1) / 2, (C + finalR[kk] * SIN[kk] + y1) / 2);
        }
        ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
      }
      ctx.closePath();
      ctx.strokeStyle = accent(0.28 + vol * 0.62);
      ctx.lineWidth = 1.5 + vol * 2.5;
      ctx.shadowBlur = 5 + vol * 18;
      ctx.shadowColor = accent(0.55);
      ctx.stroke();
      ctx.shadowBlur = 0;
      phase += 0.018;
    }
    function loop() { raf = requestAnimationFrame(loop); draw(); }
    raf = requestAnimationFrame(loop);

    async function arm() {
      if (state !== 'idle') { disarm(); return; }
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) { return; }
      ac = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      ac.createMediaStreamSource(media).connect(analyser);
      const binHz = ac.sampleRate / analyser.fftSize;
      minBin = Math.max(1, Math.round(80 / binHz));
      maxBin = Math.min(analyser.frequencyBinCount - 1, Math.round(8000 / binHz));
      const logMin = Math.log(80), logMax = Math.log(8000);
      bins = new Int32Array(N);
      for (let i = 0; i < N; i++) {
        const f = Math.exp(logMin + (i / N) * (logMax - logMin));
        bins[i] = Math.max(minBin, Math.min(maxBin, Math.round(f / binHz)));
      }
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
      smoothR = null; spikeR = null;
      chunks = [];
      rec = new MediaRecorder(media);
      rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.push(e.data);
        /* a long take is kept as it goes, so nothing is lost if the page closes.
           Nothing asks for this unless it passes saveEvery, and the Wheel does not. */
        if (opts.onChunk) {
          const mime = (rec && rec.mimeType) || 'audio/mp4';
          try { opts.onChunk(new Blob(chunks, { type: mime }), elapsed); } catch (e2) {}
        }
      };
      rec.onstop = async () => {
        const mime = (rec && rec.mimeType) || 'audio/mp4';
        const blob = new Blob(chunks, { type: mime });
        chunks = [];
        if (blob.size && opts.onBlob) {
          try { await opts.onBlob(blob, elapsed); } catch (e2) {}
        }
      };
      state = 'armed';
      sync();
    }
    function disarm() {
      if (media) media.getTracks().forEach((t) => t.stop());
      media = null; analyser = null; freqData = null; timeData = null;
      if (ac) { try { ac.close(); } catch (e) {} ac = null; }
      state = 'idle';
      sync();
    }
    function start() {
      if (state === 'armed' && rec && rec.state === 'inactive') rec.start(opts.saveEvery || 1000);
      else if (state === 'paused' && rec && rec.state === 'paused') rec.resume();
      else return;
      state = 'recording';
      t0 = Date.now();
      if (!tick) tick = setInterval(() => {
        const total = elapsed + (Date.now() - t0);
        clockEl.textContent = clock(total) + ' / 15:00';
        if (total >= LIMIT_MS) stop();
      }, 250);
      sync();
    }
    function pause() {
      if (state !== 'recording') return;
      if (rec && rec.state === 'recording') rec.pause();
      elapsed += Date.now() - t0;
      if (tick) { clearInterval(tick); tick = null; }
      state = 'paused';
      sync();
    }
    function stop() {
      if (state === 'idle') return;
      if (state === 'recording') elapsed += Date.now() - t0;
      if (tick) { clearInterval(tick); tick = null; }
      if (rec && rec.state !== 'inactive') rec.stop();
      if (media) media.getTracks().forEach((t) => t.stop());
      media = null; analyser = null; freqData = null; timeData = null;
      if (ac) { try { ac.close(); } catch (e) {} ac = null; }
      state = 'idle';
      sync();
    }

    const bArm = btn(GLYPH.mic, 'arm', () => arm());
    const bRec = btn(GLYPH.play, 'record', () => start());
    const bPause = btn(GLYPH.pause, 'pause', () => pause());
    const bStop = btn(GLYPH.stop, 'stop', () => stop());
    [bArm, bRec, bPause, bStop].forEach((b) => ctl.appendChild(b));
    function sync() {
      [bArm, bRec, bPause, bStop].forEach((b) => b.classList.remove('on'));
      bArm.disabled = state === 'recording' || state === 'paused';
      bRec.disabled = !(state === 'armed' || state === 'paused');
      bPause.disabled = state !== 'recording';
      bStop.disabled = state === 'idle';
      if (state === 'armed') bArm.classList.add('on');
      if (state === 'recording') bRec.classList.add('on');
      if (state === 'paused') bPause.classList.add('on');
      if (opts.onState) { try { opts.onState(state); } catch (e) {} }
    }
    sync();
    return {
      el: wrap,
      stop: () => { stop(); if (raf) cancelAnimationFrame(raf); raf = null; },
    };
  }

  window.SDJStage = { listen, record };
})();
