/* The Dream Journal keeps its dreams, reflections, prompts and the day's activities in a handful of tables and
   its voices in one bucket, sdj-audio. On the site the database fills in the dreamer and the day; here the
   dreamer is the one person on this device, and the day is the same calendar day the site's database keeps.

   The open rhythm is a class written in Oral Histories, read through two functions, oh_sequence and
   oh_sequence_save. They are answered here from the same cards (local/seed.json), and the person on this
   device keeps the rhythm: under SOLOS, "your rhythm" lays the activities out to move, lengthen and save. */
(function () {
  'use strict';
  /* the database's CURRENT_DATE: the calendar day in UTC, which is what the journal compares against */
  function today() { return new Date().toISOString().slice(0, 10); }
  var mine = { user_id: '$uid', day: today };

  /* how a card of the class reads as a step of the rhythm, as the site's oh_sequence has it */
  var SDJ_OF = { record: 'speak', reflect: 'reflect', listen_back: 'listen_back', along: 'read_other',
    listen: 'listen_others', read: 'speak_other', prompt: 'prompt_share', instruction: 'instruction' };
  var CARD_OF = { speak: 'record', reflect: 'reflect', listen_back: 'listen_back', read_other: 'along',
    add: 'listen', listen_others: 'listen', speak_other: 'read', prompt_share: 'prompt', instruction: 'instruction' };
  function sdjKind(c) { var s = c.source_ref || {}; return s.sdj || s.sdj_kind || SDJ_OF[c.kind] || 'reflect'; }
  function num(v, d) { return v == null || v === '' || isNaN(Number(v)) ? d : Number(v); }

  LocalSupabase.configure({
    name: 'dream-journal',
    you: { display_name: 'You' },
    defaults: {
      sdj_dreams: Object.assign({ kind: 'spoken', is_seed: false, class_id: null, parent_dream_id: null, transcript: null, duration_secs: null }, mine),
      sdj_activities: Object.assign({ status: 'done', payload: {} }, mine),
      sdj_reflections: Object.assign({ body: '', minutes: null }, mine),
      sdj_prompt_shares: mine,
      sdj_enrollments: { user_id: '$uid', class: 'dream-journal', cohort_id: null, day_zero: today, active: true, lat: null, lng: null, tz: null }
    },
    relations: {
      sdj_swaps: { sdj_dreams: { table: 'sdj_dreams', local: 'dream_id', foreign: 'id', many: false } },
      sdj_prompt_shares: { sdj_prompts: { table: 'sdj_prompts', local: 'prompt_id', foreign: 'id', many: false } },
      sdj_sequence_items: { sdj_exercises: { table: 'sdj_exercises', local: 'exercise_id', foreign: 'id', many: false } }
    },
    rpc: {
      /* the class's rhythm cards, in the order of the day */
      oh_sequence: function (args, db) {
        return db.rows('oh_cards')
          .filter(function (c) { return c.class_id === args.cid && c.active !== false && c.rhythm; })
          .sort(function (a, b) { return num(a.section, 0) - num(b.section, 0) || num(a.slot, 0.5) - num(b.slot, 0.5); })
          .map(function (c) {
            var s = c.source_ref || {};
            return { card_id: c.id, class_id: c.class_id, kind: c.kind, sdj_kind: sdjKind(c), label: c.title, note: c.text,
              section: num(c.section, 0), slot: num(c.slot, 0.5), dur_h: num(c.dur_h, 1), cadence_n: num(c.cadence_n, 1),
              cadence_unit: c.cadence_unit || 'days', rotate: !!c.rotate, start_day: c.start_day || today(),
              ring: num(c.ring, 0), for_facilitator: !!s.for_facilitator, times_per_day: num(c.times_per_day, 1), number: c.number };
          });
      },
      /* the wheel written back: each item finds its card (or becomes one), and a card left off steps out of the rhythm */
      oh_sequence_save: async function (args, db) {
        var cid = args.cid, items = Array.isArray(args.items) ? args.items : [], cards = db.rows('oh_cards');
        var inClass = function () { return cards.filter(function (c) { return c.class_id === cid; }); };
        var touched = [], made = 0;
        items.forEach(function (it) {
          var target = null;
          if (it.card_id) target = inClass().filter(function (c) { return c.id === it.card_id; })[0] || null;
          if (!target && it.sdj_kind) target = inClass().filter(function (c) { return sdjKind(c) === it.sdj_kind; })[0] || null;
          if (!target) {
            if (!it.sdj_kind) return;
            var next = inClass().reduce(function (m, c) { return Math.max(m, num(c.number, 0)); }, 0) + 1;
            target = { id: db.uuid(), class_id: cid, number: next, kind: CARD_OF[it.sdj_kind] || 'question',
              title: it.label || it.sdj_kind, text: it.note || '', active: true, rhythm: true, times_per_day: 1,
              source_ref: { sdj: it.sdj_kind, for_facilitator: !!it.for_facilitator }, created_at: db.now() };
            cards.push(target);
            made += 1;
          }
          target.rhythm = it.rhythm == null ? true : !!it.rhythm;
          target.active = it.active == null ? true : !!it.active;
          ['section', 'cadence_n', 'ring'].forEach(function (k) { if (it[k] != null) target[k] = Math.round(Number(it[k])); });
          ['slot', 'dur_h'].forEach(function (k) { if (it[k] != null) target[k] = Number(it[k]); });
          if (it.cadence_unit) target.cadence_unit = it.cadence_unit;
          if (it.rotate != null) target.rotate = !!it.rotate;
          target.start_day = it.start_day || target.start_day || today();
          target.updated_at = db.now();
          touched.push(target.id);
        });
        inClass().forEach(function (c) { if (c.rhythm && touched.indexOf(c.id) < 0) { c.rhythm = false; c.updated_at = db.now(); } });
        await db.save('oh_cards');
        return { ok: true, kept: touched.length, made: made };
      }
    },
    seedUrl: 'local/seed.json'
  });

  /* a dream taken out of the library takes its recording with it, so the device keeps nothing it no longer shows */
  var C = LocalSupabase.client, from = C.from;
  C.from = function (t) {
    var q = from.call(C, t);
    if (t !== 'sdj_dreams') return q;
    var del = q.delete;
    q.delete = function (opts) {
      del.call(q, opts);
      var then = q.then;
      q.then = function (res, rej) {
        var asked = q.ret != null;
        if (!asked) q.ret = 'id, audio_path';
        return then.call(q, async function (r) {
          var paths = ((r && r.data) || []).map(function (d) { return d.audio_path; }).filter(Boolean);
          if (paths.length) await C.storage.from('sdj-audio').remove(paths);
          return asked ? r : Object.assign({}, r, { data: null });
        }).then(res, rej);
      };
      return q;
    };
    return q;
  };

  /* on the site a newcomer meets the welcome before the wheel; here too, once */
  try {
    if (!/welcome\.html$/.test(location.pathname) && location.protocol !== 'file:' && !localStorage.getItem('sdj-seen-welcome')) {
      location.replace('welcome.html?replay=1');
    }
  } catch (e) {}
})();
