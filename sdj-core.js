/**
 * SOLOS: Dream Journal — shared core.
 *
 * The day's structure is alive in two ways. The eight wheel sections are
 * solar: four day quarters sunrise-to-sunset, four night quarters
 * sunset-to-sunrise, so the wheel expands and contracts with the seasons.
 * Activities live inside sections at a slot, so their windows ride the
 * moving sections. Personal calibration then shifts each window toward
 * the hour the dreamer actually keeps (median of recent days), so after
 * four or five days the schedule fits the life rather than the reverse.
 *
 * Recording transcribes live through the device's own speech engine
 * (webkitSpeechRecognition — Apple's on iPhone and Safari), the same way
 * the standalones lean on the device rather than any outside service.
 *
 * Include after the Supabase SDK.
 */
(function () {
  'use strict';

  const NS = (window.SDJ = window.SDJ || {});
  const wNS = 'http://www.w3.org/2000/svg';
  const DEG = Math.PI / 180;

  // ── schedule ─────────────────────────────────────────────────────────
  NS.loadSchedule = async function () {
    if (NS.schedule) return NS.schedule;
    const r = await fetch('./schedule.json');
    NS.schedule = await r.json();
    return NS.schedule;
  };

  NS.nowHour = function () {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };

  // ── solar sections (the seasons move the wheel) ──────────────────────
  // Sunrise and sunset from date and latitude — the same declination
  // arithmetic as the engine wheel and the seasons animation.
  NS.solar = function (date, lat) {
    const start = new Date(date.getFullYear(), 0, 0);
    const dayOfYear = (date - start) / 86400000;
    const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const latRad = lat * DEG, declRad = decl * DEG;
    const cosH = (Math.cos(90.833 * DEG) - Math.sin(latRad) * Math.sin(declRad)) /
                 (Math.cos(latRad) * Math.cos(declRad));
    let dayHours;
    if (cosH > 1) dayHours = 0;
    else if (cosH < -1) dayHours = 24;
    else dayHours = 2 * (Math.acos(cosH) / DEG) / 15;
    const sunrise = 13 - dayHours / 2;   // ~1pm solar noon in clock time, DST-friendly
    return { sunrise, sunset: sunrise + dayHours, dayHours };
  };

  // ── the dreamer's own place ──────────────────────────────────────────
  // Timing anchors to where the dreamer actually is: the device's
  // geolocation, remembered locally and on the enrollment, with the
  // schedule's default only as a last resort.
  NS._loc = null;
  NS.location = function () {
    if (NS._loc) return NS._loc;
    try {
      const cached = JSON.parse(localStorage.getItem('sdj-loc') || 'null');
      if (cached && cached.lat != null) return (NS._loc = cached);
    } catch (e) {}
    return (NS.schedule && NS.schedule.location) || { lat: 40, lng: -74 };
  };
  NS.captureLocation = async function () {
    if (!navigator.geolocation) return NS.location();
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        NS._loc = loc;
        try { localStorage.setItem('sdj-loc', JSON.stringify(loc)); } catch (e) {}
        try { localStorage.removeItem('sdj-shifts'); } catch (e) {}
        const u = await NS.user();
        if (u) {
          await NS.client().from('sdj_enrollments')
            .update({ lat: loc.lat, lng: loc.lng,
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
            .eq('user_id', u.id);
        }
        resolve(loc);
      }, () => resolve(NS.location()), { maximumAge: 3600000, timeout: 8000 });
    });
  };
  // A signed-in dreamer whose enrollment already knows their place gets it
  // even on a fresh device.
  NS.loadEnrollmentLocation = async function () {
    const u = await NS.user();
    if (!u) return;
    const { data } = await NS.client().from('sdj_enrollments')
      .select('lat,lng').eq('user_id', u.id).maybeSingle();
    if (data && data.lat != null) {
      NS._loc = { lat: data.lat, lng: data.lng };
      try { localStorage.setItem('sdj-loc', JSON.stringify(NS._loc)); } catch (e) {}
    }
  };

  // Eight sections for today: four equal day quarters, four equal night
  // quarters, named from schedule.json. start/end in hours (end may pass 24).
  NS.sectionsOn = function (date) {
    const sol = NS.solar(date, NS.location().lat);
    const dq = sol.dayHours / 4;
    const nq = (24 - sol.dayHours) / 4;
    const out = [];
    for (let i = 0; i < 4; i++) out.push({
      name: NS.schedule.sectionNames.day[i], start: sol.sunrise + i * dq, end: sol.sunrise + (i + 1) * dq, kind: 'day' });
    for (let i = 0; i < 4; i++) out.push({
      name: NS.schedule.sectionNames.night[i], start: sol.sunset + i * nq, end: sol.sunset + (i + 1) * nq, kind: 'night' });
    return out;
  };
  NS.sectionsToday = function () { return NS.sectionsOn(new Date()); };

  // ── personal calibration ─────────────────────────────────────────────
  // The median hour the dreamer actually completes each activity, from
  // their own recent history; the window shifts toward it, clamped.
  NS.personalShifts = async function () {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const cached = JSON.parse(localStorage.getItem('sdj-shifts') || 'null');
      if (cached && cached.day === today) return cached.shifts;
    } catch (e) {}
    const shifts = {};
    const u = await NS.user();
    if (u) {
      const cal = NS.schedule.calibration || {};
      const since = new Date(Date.now() - (cal.lookbackDays || 14) * 86400000)
        .toISOString().slice(0, 10);
      const { data } = await NS.client().from('sdj_activities')
        .select('kind,created_at').eq('user_id', u.id).gte('day', since);
      const byKind = {};
      for (const row of (data || [])) {
        const d = new Date(row.created_at);
        (byKind[row.kind] = byKind[row.kind] || []).push(d.getHours() + d.getMinutes() / 60);
      }
      const windows = NS.rawWindows();
      for (const kind in byKind) {
        const hours = byKind[kind].sort((a, b) => a - b);
        if (hours.length < (cal.minSamples || 4)) continue;
        const median = hours[Math.floor(hours.length / 2)];
        const w = windows.find((x) => x.kind === kind);
        if (!w) continue;
        const mid = w.start + w.durH / 2;
        const max = cal.maxShiftHours || 2;
        shifts[kind] = Math.max(-max, Math.min(max, median - mid));
      }
    }
    try { localStorage.setItem('sdj-shifts', JSON.stringify({ day: today, shifts })); } catch (e) {}
    return shifts;
  };

  // The Dream Journal, as it stands in Oral Histories: one class, whose cards
  // are these nine exercises. The rhythm is written there and read here.
  NS.OH_CLASS = 'd4ea3a71-0000-4d00-9c00-000000000001';

  // ── the sequence, from the database: a class supersedes the open
  //    rhythm for its members; the schedule file is the offline floor ──
  NS.loadSequence = async function (onlyClass) {
    try {
      const u = await NS.user();
      if (!u) throw 0;
      NS._uid = u.id;
      const c = NS.client();
      const mem = await c.from('sdj_class_members')
        .select('class_id, focused, position, role').eq('user_id', u.id);
      NS._classes = mem.data || [];
      const focused = NS._classes.find((m) => m.focused);
      NS._focusClass = focused ? focused.class_id : null;
      // A class of its own comes first, as it always has. Under it is the open
      // rhythm, which is no longer kept here: the Dream Journal is a class
      // written in Oral Histories and its nine exercises are that class's
      // cards, so this asks for them and reads them as the sequence. The old
      // table stays underneath as the last floor.
      let rows = [];
      if (onlyClass) {
        const { data } = await c.from('sdj_sequence_items')
          .select('*, sdj_exercises(*)').eq('active', true).eq('class_id', onlyClass);
        rows = data || [];
      }
      if (!rows.length) {
        const { data: seq } = await c.rpc('oh_sequence', { cid: NS.OH_CLASS });
        rows = (seq || []).map((r) => ({
          id: r.card_id, class_id: null, section: r.section, slot: r.slot,
          dur_h: r.dur_h, cadence_n: r.cadence_n, cadence_unit: r.cadence_unit,
          rotate: r.rotate, start_day: r.start_day, ring: r.ring, active: true,
          sdj_exercises: { kind: r.sdj_kind, label: r.label, note: r.note,
            for_facilitator: r.for_facilitator }
        }));
      }
      if (!rows.length) {
        const { data } = await c.from('sdj_sequence_items')
          .select('*, sdj_exercises(*)').eq('active', true).is('class_id', null);
        rows = data || [];
      }
      NS._activeClass = onlyClass || null;
      NS._seq = rows;
      NS._rot = {};
      const rotIds = [...new Set(rows.filter((r) => r.rotate && r.class_id).map((r) => r.class_id))];
      for (const cid of rotIds) {
        const ms = await c.from('sdj_class_members')
          .select('user_id, position').eq('class_id', cid).order('position');
        NS._rot[cid] = ms.data || [];
      }
      return true;
    } catch (e) { NS._seq = null; return false; }
  };

  // Windows from sections alone (no personal shift) — the day's defaults.
  NS.rawWindows = function () {
    const sections = NS.sectionsToday();
    if (NS._seq && NS._seq.length) {
      const dayN = Math.floor(Date.now() / 86400000);
      const out = [];
      for (const it of NS._seq) {
        const ex = it.sdj_exercises;
        if (!ex) continue;
        const sec = sections[it.section % 8];
        const start = sec.start + it.slot * (sec.end - sec.start);
        if (ex.for_facilitator) {
          const m = (NS._classes || []).find((x) => x.class_id === it.class_id && x.role === 'facilitator');
          if (!m) continue;
          out.push({ kind: ex.kind, label: ex.label, section: it.section, slot: it.slot,
            durH: it.dur_h, start, secName: sec.name, note: ex.note, red: true,
            ring: it.ring || 0, classId: it.class_id });
          continue;
        }
        const cad = it.cadence_n * (it.cadence_unit === 'weeks' ? 7 : 1);
        const startN = Math.floor(new Date(it.start_day + 'T00:00:00').getTime() / 86400000);
        const diff = dayN - startN;
        if (diff < 0 || cad <= 0) continue;
        if (it.rotate && it.class_id) {
          // taking turns: everyone comes round once per cadence, and the
          // class is spread evenly across its days — twenty-eight people
          // on a seven day turn means four of them each day
          const ms = (NS._rot || {})[it.class_id] || [];
          if (ms.length) {
            const mine = ms.find((m) => m.user_id === NS._uid);
            if (!mine) continue;
            const dayInCycle = ((diff % cad) + cad) % cad;
            if ((mine.position % cad) !== dayInCycle) continue;
          } else if (diff % cad !== 0) { continue; }
        } else if (diff % cad !== 0) { continue; }
        out.push({ kind: ex.kind, label: ex.label, section: it.section, slot: it.slot,
          durH: it.dur_h, start, secName: sec.name, note: ex.note, ring: it.ring || 0,
          classId: it.class_id, turn: !!it.rotate });
      }
      return out;
    }
    return (NS.schedule.activities || []).map((a) => {
      const sec = sections[a.section];
      const start = sec.start + a.slot * (sec.end - sec.start);
      return { ...a, start, durH: a.durH, secName: sec.name };
    });
  };

  // Today's real windows: sections + personal shift, kept inside the day.
  NS.windowsToday = async function () {
    // the times are the times: personal drift is off until it is asked for
    const shifts = NS.schedule.calibration && NS.schedule.calibration.enabled
      ? await NS.personalShifts() : {};
    return NS.rawWindows().map((w) => {
      const shift = shifts[w.kind === 'listen_others' ? 'listen_back' : w.kind] || 0;
      const start = w.start + shift;
      return { ...w, start, end: start + w.durH, tuned: !!shift, shiftH: shift };
    });
  };

  const inWindow = (w, hour) => {
    const h24 = ((hour % 24) + 24) % 24;
    const s = ((w.start % 24) + 24) % 24, e = s + w.durH;
    return (h24 >= s && h24 < e) || (h24 + 24 >= s && h24 + 24 < e);
  };
  NS.currentActivities = function (windows, hour) {
    return windows.filter((w) => inWindow(w, hour));
  };
  NS.nextActivity = function (windows, hour) {
    const sorted = [...windows].sort((a, b) => (a.start % 24) - (b.start % 24));
    return sorted.find((w) => (w.start % 24) > hour) || sorted[0] || null;
  };

  NS.fmtWindow = function (w) {
    const f = (h) => {
      let hh = ((h % 24) + 24) % 24;
      let m = Math.round((hh % 1) * 60);
      let H = Math.floor(hh);
      if (m === 60) { m = 0; H = (H + 1) % 24; }
      const ap = H < 12 ? 'am' : 'pm';
      let n = H % 12; if (n === 0) n = 12;
      return n + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
    };
    return f(w.start) + ' to ' + f(w.start + w.durH);
  };

  // Each activity lives on its own ring so spans never collide.
  // three tracks ring the wheel; a star rides the one it was given, and
  // several on the same track never sit on top of one another
  NS.RING_R = [0.42, 0.545, 0.67];
  NS.wheelRingFor = function (windows, w, WR) {
    if (w.red) return WR * 0.30;
    const track = Math.max(0, Math.min(2, w.ring == null ? 0 : w.ring));
    return WR * NS.RING_R[track];
  };

  // ── the wheel ────────────────────────────────────────────────────────
  NS.renderWheel = function (svg, opts) {
    opts = opts || {};
    const sections = NS.sectionsToday();
    const windows = opts.windows || NS.rawWindows().map((w) => ({ ...w, end: w.start + w.durH }));
    const hour = opts.hour != null ? opts.hour : NS.nowHour();
    const WCX = 180, WCY = 180, WR = opts.r || 140;
    // opts.inkHue: 0 draws the wheel in phosphor gray, any other hue in
    // that color; absent, the legacy greens stand.
    const IH = opts.inkHue;
    const G = (a, l) => IH == null ? null :
      (IH ? 'hsla(' + IH + ',62%,' + l + '%,' + a + ')'
          : 'hsla(0,0%,' + Math.min(l + 30, 92) + '%,' + a + ')');
    const A = (a) => IH == null ? null :
      (IH ? 'hsla(' + ((IH + 40) % 360) + ',85%,62%,' + a + ')' : 'hsla(0,0%,88%,' + a + ')');
    svg.innerHTML = '';

    const polar = (angle, r) => {
      const rad = (angle - 90) * DEG;
      return [WCX + r * Math.cos(rad), WCY + r * Math.sin(rad)];
    };
    const hourToAngle = (h) => (((h % 24) + 24) % 24) / 24 * 360;
    const el = (tag, attrs) => {
      const e = document.createElementNS(wNS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      svg.appendChild(e);
      return e;
    };

    [WR, WR * 0.75, WR * 0.48].forEach((r, i) => {
      el('circle', { cx: WCX, cy: WCY, r, fill: 'none',
        stroke: G(0.12, 50) || 'rgba(34,197,94,0.12)', 'stroke-width': i === 0 ? 0.5 : 0.3 });
    });

    for (const s of sections) {
      const a0 = hourToAngle(s.start), a1 = hourToAngle(s.end);
      const [x1, y1] = polar(a0, WR), [x2, y2] = polar(a1, WR);
      let sweep = a1 - a0; if (sweep <= 0) sweep += 360;
      const large = sweep > 180 ? 1 : 0;
      const h24 = ((hour % 24) + 24) % 24;
      const s24 = ((s.start % 24) + 24) % 24;
      const active = (h24 >= s24 && h24 < s24 + (s.end - s.start)) ||
        (h24 + 24 >= s24 && h24 + 24 < s24 + (s.end - s.start));
      el('path', {
        d: `M ${WCX} ${WCY} L ${x1} ${y1} A ${WR} ${WR} 0 ${large} 1 ${x2} ${y2} Z`,
        fill: active ? (G(0.20, 50) || 'rgba(34,197,94,0.20)') : (s.kind === 'day' ? (G(0.07, 50) || 'rgba(34,197,94,0.07)') : (G(0.03, 50) || 'rgba(34,197,94,0.03)')),
        stroke: active ? (G(0.85, 55) || 'rgba(34,197,94,0.85)') : (G(0.30, 50) || 'rgba(34,197,94,0.30)'),
        'stroke-width': active ? 1.4 : 0.6,
      });
      const mid = s.start + (s.end - s.start) / 2;
      const [lx, ly] = polar(hourToAngle(mid), WR * 0.8);
      const t = el('text', { x: lx, y: ly, 'text-anchor': 'middle',
        'dominant-baseline': 'middle', fill: active ? (G(0.95, 70) || 'rgba(134,239,172,0.95)') : (G(0.6, 50) || 'rgba(34,197,94,0.6)'),
        'font-size': Math.round(WR * (active ? 0.104 : 0.082)), 'letter-spacing': '0.04em',
        stroke: '#0a0a0a', 'stroke-width': 4, 'paint-order': 'stroke' });
      t.textContent = s.name;
    }

    if (opts.stars !== false && opts.crown !== false) {
      // the live section's name, engraved along the top rim
      const act = sections.find((s) => {
        const h24 = ((hour % 24) + 24) % 24;
        const s24 = ((s.start % 24) + 24) % 24, d = s.end - s.start;
        return (h24 >= s24 && h24 < s24 + d) || (h24 + 24 >= s24 && h24 + 24 < s24 + d);
      });
      if (act) {
        // the oval keeps its own size and shape; the wheel fills it
        const RY = WR + 16, RX = RY + 44;
        const ink = G(0.9, 70) || 'rgba(134,239,172,0.9)';
        const H = 52;
        const epolar = (angle, rx, ry) => {
          const rad = (angle - 90) * DEG;
          return [WCX + rx * Math.cos(rad), WCY + ry * Math.sin(rad)];
        };
        // one width for every title: the longest name sets the ribbon
        const LONGEST = 18;
        const px = LONGEST * 24.8 + 56;
        const rAvg = (RX + RY) / 2 + 18;
        const half = Math.min(62, (px / (2 * Math.PI * rAvg)) * 180);
        const notch = Math.min(6, half * 0.13);
        const RM = [(RX + RX + H) / 2, (RY + RY + H) / 2];
        const pL0 = epolar(-half, RX, RY), pL1 = epolar(-half, RX + H, RY + H);
        const pR1 = epolar(half, RX + H, RY + H), pR0 = epolar(half, RX, RY);
        // the ribbon's ends are cut with a notch, the way a banner is
        const aR = epolar(half - notch, RM[0], RM[1]);
        const aL = epolar(-half + notch, RM[0], RM[1]);
        const ribbon = `M ${pL1[0]} ${pL1[1]} ` +
          `A ${RX + H} ${RY + H} 0 0 1 ${pR1[0]} ${pR1[1]} ` +
          `L ${aR[0]} ${aR[1]} L ${pR0[0]} ${pR0[1]} ` +
          `A ${RX} ${RY} 0 0 0 ${pL0[0]} ${pL0[1]} ` +
          `L ${aL[0]} ${aL[1]} Z`;
        el('path', { d: ribbon, fill: '#0c0c0a', stroke: 'none' });
        el('ellipse', { cx: WCX, cy: WCY, rx: RX, ry: RY, fill: 'none',
          stroke: ink, 'stroke-width': 2 });
        el('path', { d: ribbon, fill: 'none', stroke: ink, 'stroke-width': 2,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
        const gid = 'glint' + Math.floor(Math.random() * 1e6);
        const gdefs = document.createElementNS(wNS, 'defs');
        const clip = document.createElementNS(wNS, 'clipPath');
        clip.setAttribute('id', gid);
        const clipPath = document.createElementNS(wNS, 'path');
        clipPath.setAttribute('d', ribbon);
        clip.appendChild(clipPath);
        gdefs.appendChild(clip);
        svg.appendChild(gdefs);
        const gwrap = document.createElementNS(wNS, 'g');
        gwrap.setAttribute('clip-path', 'url(#' + gid + ')');
        gwrap.setAttribute('class', 'sdj-glint');
        const shine = document.createElementNS(wNS, 'rect');
        shine.setAttribute('x', WCX - RX - H - 140);
        shine.setAttribute('y', WCY - RY - H - 30);
        shine.setAttribute('width', 46);
        shine.setAttribute('height', (RY + H) * 1.2);
        shine.setAttribute('fill', 'rgba(255,255,255,0.55)');
        shine.setAttribute('transform', 'skewX(-20)');
        gwrap.appendChild(shine);
        svg.appendChild(gwrap);
        const [cx1, cy1] = epolar(-(half - 2), RX + 18, RY + 18);
        const [cx2, cy2] = epolar(half - 2, RX + 18, RY + 18);
        const pid = 'crownPath' + Math.floor(Math.random() * 1e6);
        const defs = document.createElementNS(wNS, 'defs');
        const cp = document.createElementNS(wNS, 'path');
        cp.setAttribute('id', pid);
        cp.setAttribute('d', `M ${cx1} ${cy1} A ${RX + 18} ${RY + 18} 0 0 1 ${cx2} ${cy2}`);
        defs.appendChild(cp);
        svg.appendChild(defs);
        const t = document.createElementNS(wNS, 'text');
        t.setAttribute('font-size', 40);
        t.setAttribute('letter-spacing', '0.12em');
        t.setAttribute('fill', G(0.98, 76) || 'rgba(160,245,190,0.98)');
        const tp = document.createElementNS(wNS, 'textPath');
        tp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + pid);
        tp.setAttribute('href', '#' + pid);
        tp.setAttribute('startOffset', '50%');
        tp.setAttribute('text-anchor', 'middle');
        tp.textContent = act.name;
        t.appendChild(tp);
        svg.appendChild(t);
      }
    }
    if (opts.stars !== false) {
      const done = opts.done;
      for (const w of windows) {
        const live = inWindow(w, hour);
        const isDone = !!(done && done.has && done.has(w.kind));
        const rr = NS.wheelRingFor(windows, w, WR);
        if (!w.red) {
          // the window's whole span, drawn as an arc on its ring
          const a0 = hourToAngle(w.start), a1 = hourToAngle(w.start + w.durH);
          const [x1, y1] = polar(a0, rr), [x2, y2] = polar(a1, rr);
          let sweep = a1 - a0; if (sweep <= 0) sweep += 360;
          el('path', { d: `M ${x1} ${y1} A ${rr} ${rr} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`,
            fill: 'none',
            stroke: live ? (A(0.9) || 'rgba(255,210,77,0.9)')
              : isDone ? (G(0.85, 62) || 'rgba(134,239,172,0.85)')
              : (G(0.32, 50) || 'rgba(34,197,94,0.32)'),
            'stroke-width': live ? 4.5 : isDone ? 3.4 : 2.2,
            'stroke-linecap': 'round' });
        }
        // the star: filled when done, hollow while it waits
        const mid = w.start + w.durH / 2;
        const [sx, sy] = polar(hourToAngle(mid), rr);
        const c = el('circle', { cx: sx, cy: sy, r: live ? 7 : 5,
          fill: w.red ? 'rgba(255,80,70,0.92)'
            : live ? (A(0.95) || 'rgba(255,210,77,0.95)')
            : isDone ? (G(0.95, 68) || 'rgba(134,239,172,0.95)') : '#0d0d0b',
          stroke: w.red ? 'rgba(255,80,70,0.92)'
            : live ? (A(0.95) || 'rgba(255,210,77,0.95)')
            : (G(0.8, 55) || 'rgba(34,197,94,0.8)'),
          'stroke-width': 1.7, 'data-kind': w.kind });
        if (live) c.setAttribute('class', 'sdj-star-live');
      }
    }

    const [hx, hy] = polar(hourToAngle(hour), WR - 6);
    el('line', { x1: WCX, y1: WCY, x2: hx, y2: hy,
      stroke: A(0.9) || 'rgba(255,210,77,0.9)', 'stroke-width': 1.6 });
    el('circle', { cx: WCX, cy: WCY, r: 3.4, fill: A(0.95) || 'rgba(255,210,77,0.95)' });
  };

  // ── data ─────────────────────────────────────────────────────────────
  NS.client = function () {
    return (window.__sdjClient = window.__sdjClient ||
      window.supabase.createClient(
        'https://local-supabase.invalid',
        'local'));
  };

  NS.user = async function () {
    const { data } = await NS.client().auth.getUser();
    return data && data.user ? data.user : null;
  };

  NS.logActivity = async function (kind, payload) {
    const u = await NS.user();
    if (!u) return;
    await NS.client().from('sdj_activities').insert({
      user_id: u.id, kind, payload: payload || {},
    });
    try { localStorage.removeItem('sdj-shifts'); } catch (e) {}
  };

  NS.stats = async function () {
    const u = await NS.user();
    if (!u) return { days: 0, recordings: 0, people: 0 };
    const c = NS.client();
    const [acts, dreams, swaps] = await Promise.all([
      c.from('sdj_activities').select('day').eq('user_id', u.id),
      c.from('sdj_dreams').select('id').eq('user_id', u.id),
      c.from('sdj_swaps').select('from_user,to_user').or(`from_user.eq.${u.id},to_user.eq.${u.id}`),
    ]);
    const days = new Set((acts.data || []).map((r) => r.day)).size;
    const others = new Set();
    for (const s of (swaps.data || [])) {
      if (s.from_user !== u.id) others.add(s.from_user);
      if (s.to_user !== u.id) others.add(s.to_user);
    }
    return { days, recordings: (dreams.data || []).length, people: others.size };
  };

  // ── recording + the device's own transcription ───────────────────────
  // Inside the app, the finished recording goes to the shell, which runs
  // Apple's on-device recognizer over the file — the way voice memos
  // does — and hands the words back. In a plain browser, the live web
  // speech engine stands in.
  const NATIVE_TR = () => !!(window.webkit && window.webkit.messageHandlers &&
    window.webkit.messageHandlers.transcribe);
  NS._trWaits = {};
  window.__transcribed = function (id, text) {
    const w = NS._trWaits[id];
    if (w) { delete NS._trWaits[id]; w(text || ''); }
  };
  NS.transcribeNative = function (blob) {
    return new Promise((resolve) => {
      const id = 't' + Date.now() + Math.floor(Math.random() * 1e6);
      const fr = new FileReader();
      fr.onload = () => {
        const b64 = String(fr.result).split(',')[1] || '';
        if (!b64) { resolve(''); return; }
        NS._trWaits[id] = resolve;
        setTimeout(() => {
          if (NS._trWaits[id]) { delete NS._trWaits[id]; resolve(''); }
        }, 90000);
        window.webkit.messageHandlers.transcribe.postMessage({ id, b64, mime: blob.type || 'audio/mp4' });
      };
      fr.onerror = () => resolve('');
      fr.readAsDataURL(blob);
    });
  };
  NS.recorder = function () {
    let media = null, rec = null, chunks = [];
    let speech = null, transcript = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return {
      start: async function () {
        media = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = []; transcript = '';
        rec = new MediaRecorder(media);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.start(1000);
        if (SR && !NATIVE_TR()) {
          try {
            speech = new SR();
            speech.continuous = true;
            speech.interimResults = false;
            speech.onresult = (e) => {
              for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ';
              }
            };
            speech.onend = () => { try { if (rec && rec.state === 'recording') speech.start(); } catch (err) {} };
            speech.start();
          } catch (err) { speech = null; }
        }
      },
      stop: function () {
        return new Promise((resolve) => {
          if (speech) { speech.onend = null; try { speech.stop(); } catch (e) {} }
          const mime = (rec && rec.mimeType) || 'audio/mp4';
          rec.onstop = async () => {
            media.getTracks().forEach((t) => t.stop());
            media = null;
            const blob = new Blob(chunks, { type: mime });
            let text = transcript.trim();
            if (NATIVE_TR()) {
              try { text = (await NS.transcribeNative(blob)).trim(); } catch (e) {}
            }
            resolve({ blob, transcript: text });
          };
          rec.stop();
        });
      },
      active: () => !!(rec && rec.state === 'recording'),
    };
  };

  NS.saveDream = async function (blob, kind, parentId, transcript) {
    const u = await NS.user();
    if (!u) throw new Error('signed out');
    const day = new Date().toISOString().slice(0, 10);
    const path = `${u.id}/${day}-${Date.now()}.webm`;
    const c = NS.client();
    const up = await c.storage.from('sdj-audio').upload(path, blob, { contentType: 'audio/webm' });
    if (up.error) throw up.error;
    const row = await c.from('sdj_dreams').insert({
      user_id: u.id, class_id: NS._focusClass || null, audio_path: path, kind: kind || 'spoken',
      parent_dream_id: parentId || null,
      transcript: transcript || null,
    }).select().single();
    if (row.error) throw row.error;
    return row.data;
  };

  NS.keepLocal = function (key, blob) {
    return new Promise((res, rej) => {
      const rq = indexedDB.open('sdj-local', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('dreams');
      rq.onsuccess = () => {
        const tx = rq.result.transaction('dreams', 'readwrite');
        tx.objectStore('dreams').put(blob, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      };
      rq.onerror = () => rej(rq.error);
    });
  };

  NS.audioUrl = async function (path) {
    const { data, error } = await NS.client().storage.from('sdj-audio')
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };
})();
