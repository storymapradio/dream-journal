
(function () {
  'use strict';

  var canvas = document.getElementById('wheel-canvas');
  var ctx = canvas.getContext('2d');
  var W = 960, CX = W / 2, CY = W / 2, R = 420;
  var DEG = Math.PI / 180;
  var dateEl = document.getElementById('wheel-date');
  var daylightEl = document.getElementById('wheel-daylight');

  var ENCOUNTERS = [
    { name: 'Morning Exercise', type: 'day' },
    { name: 'Daydream', type: 'day' },
    { name: 'Daylight Encounter', type: 'day' },
    { name: 'Evening Exercise', type: 'day' },
    { name: 'Night School', type: 'night' },
    { name: 'Night Encounter', type: 'night' },
    { name: 'Dream Time', type: 'night' },
    { name: 'Invocation', type: 'night' }
  ];

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function getDayHours(dayOfYear, lat) {
    var decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    var latRad = lat * DEG, declRad = decl * DEG;
    var cosH = (Math.cos(90.833 * DEG) - Math.sin(latRad) * Math.sin(declRad))
              / (Math.cos(latRad) * Math.cos(declRad));
    if (cosH > 1) return { day: 0, sunrise: 12, sunset: 12 };
    if (cosH < -1) return { day: 24, sunrise: 0, sunset: 24 };
    var H = Math.acos(cosH) / DEG;
    var B = (2 * Math.PI / 365) * (dayOfYear - 81);
    var eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    var solarNoon = 12 - eot / 60;
    var sunrise = solarNoon - H / 15;
    var sunset = solarNoon + H / 15;
    return { day: sunset - sunrise, sunrise: sunrise, sunset: sunset };
  }

  function hourToAngle(h) {
    return ((h % 24) / 24) * Math.PI * 2 - Math.PI / 2;
  }

  function polarXY(angle, dist) {
    return [CX + dist * Math.cos(angle), CY + dist * Math.sin(angle)];
  }

  function drawArc(cx2, cy2, r, startAngle, endAngle, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(cx2, cy2);
    ctx.arc(cx2, cy2, r, startAngle, endAngle);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  function formatTime(h) {
    h = ((h % 24) + 24) % 24;
    var hh = Math.floor(h);
    var mm = Math.round((h - hh) * 60);
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function dayOfYearToDate(doy) {
    var d = new Date(2025, 0, 1);
    d.setDate(d.getDate() + Math.floor(doy));
    return d;
  }

  var LAT = 40;
  var YEAR_DURATION = 30000;
  var startTime = performance.now();

  function render(ts) {
    var elapsed = ts - startTime;
    var yearFrac = (elapsed % YEAR_DURATION) / YEAR_DURATION;
    var dayOfYear = yearFrac * 365;
    var solar = getDayHours(dayOfYear, LAT);
    var nightH = 24 - solar.day;

    ctx.clearRect(0, 0, W, W);

    // Concentric rings
    var rings = [R, R * 0.75, R * 0.48];
    for (var ri = 0; ri < rings.length; ri++) {
      ctx.beginPath();
      ctx.arc(CX, CY, rings[ri], 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34,197,94,' + (0.3 - ri * 0.05) + ')';
      ctx.lineWidth = 1.2 - ri * 0.3;
      ctx.stroke();
    }

    // Compute 8 section boundaries
    var boundaries = [];
    for (var i = 0; i <= 4; i++) {
      boundaries.push(solar.sunrise + i * (solar.day / 4));
    }
    for (var i = 1; i <= 4; i++) {
      boundaries.push(solar.sunset + i * (nightH / 4));
    }

    var dayFills = [
      'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.09)',
      'rgba(34,197,94,0.14)', 'rgba(34,197,94,0.10)'
    ];
    var nightFills = [
      'rgba(34,197,94,0.04)', 'rgba(34,197,94,0.025)',
      'rgba(34,197,94,0.02)', 'rgba(34,197,94,0.035)'
    ];

    for (var i = 0; i < 8; i++) {
      var startH = boundaries[i];
      var endH = boundaries[i + 1] !== undefined ? boundaries[i + 1] : boundaries[0] + 24;
      var a1 = hourToAngle(startH);
      var a2 = hourToAngle(endH);
      var fill = i < 4 ? dayFills[i] : nightFills[i - 4];
      drawArc(CX, CY, R, a1, a2, fill, 'rgba(34,197,94,0.25)', 0.8);
    }

    // Spoke lines at section boundaries
    for (var i = 0; i < 8; i++) {
      var a = hourToAngle(boundaries[i]);
      var p1 = polarXY(a, R * 0.2);
      var p2 = polarXY(a, R);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.strokeStyle = 'rgba(34,197,94,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Time label
      var tp = polarXY(a, R + 28);
      ctx.save();
      ctx.translate(tp[0], tp[1]);
      var rot = a + Math.PI / 2;
      if (rot > Math.PI / 2 && rot < Math.PI * 1.5) rot += Math.PI;
      ctx.rotate(rot);
      ctx.font = '16px Chicago, monospace';
      ctx.fillStyle = 'rgba(34,197,94,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatTime(boundaries[i]), 0, 0);
      ctx.restore();
    }

    // Encounter name labels
    for (var i = 0; i < 8; i++) {
      var startH = boundaries[i];
      var endH = i < 7 ? boundaries[i + 1] : boundaries[0] + 24;
      var midH = (startH + endH) / 2;
      var a = hourToAngle(midH);
      var lp = polarXY(a, R * 0.58);
      var isDay = i < 4;

      ctx.save();
      ctx.translate(lp[0], lp[1]);
      var rot = a + Math.PI / 2;
      if (rot > Math.PI / 2 && rot < Math.PI * 1.5) rot += Math.PI;
      ctx.rotate(rot);
      ctx.font = '17px Chicago, monospace';
      ctx.fillStyle = isDay ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ENCOUNTERS[i].name, 0, 0);
      ctx.restore();
    }

    // Hour markers
    for (var h = 0; h < 24; h += 3) {
      var a = hourToAngle(h);
      var hp = polarXY(a, R + 52);
      ctx.font = 'bold 20px Chicago, monospace';
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h), hp[0], hp[1]);
    }

    // Cardinal labels
    var cardinals = [
      { h: 0, label: 'MIDNIGHT' },
      { h: 6, label: 'SUNRISE' },
      { h: 12, label: 'NOON' },
      { h: 18, label: 'SUNSET' }
    ];
    for (var ci = 0; ci < cardinals.length; ci++) {
      var c = cardinals[ci];
      var a = hourToAngle(c.h);
      var cp = polarXY(a, R + 88);
      ctx.font = '13px Chicago, monospace';
      ctx.fillStyle = 'rgba(34,197,94,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, cp[0], cp[1]);
    }

    // Sunrise/sunset indicator dots
    var sunriseA = hourToAngle(solar.sunrise);
    var sunsetA = hourToAngle(solar.sunset);
    var dots = [sunriseA, sunsetA];
    for (var di = 0; di < dots.length; di++) {
      var dp = polarXY(dots[di], R + 4);
      ctx.beginPath();
      ctx.arc(dp[0], dp[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = di === 0 ? '#4ade80' : 'rgba(34,197,94,0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,197,94,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(CX, CY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e';
    ctx.fill();

    // Date & daylight info
    var d = dayOfYearToDate(dayOfYear);
    dateEl.textContent = MONTHS[d.getMonth()] + ' ' + d.getDate() + ' \u2014 ' + formatTime(solar.sunrise) + ' sunrise / ' + formatTime(solar.sunset) + ' sunset';
    var dH = Math.floor(solar.day);
    var dM = Math.round((solar.day - dH) * 60);
    var nH = Math.floor(nightH);
    var nM = Math.round((nightH - nH) * 60);
    daylightEl.textContent = dH + 'h ' + dM + 'm daylight / ' + nH + 'h ' + nM + 'm night';

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
