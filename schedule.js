// the schedule, inlined for the bundled app (file:// cannot fetch)
window.SDJ_SCHEDULE = {
  "about": "The day's structure. Sections are solar: four day quarters from sunrise to sunset, four night quarters from sunset to sunrise, so the wheel expands and contracts with the seasons. Each activity lives inside a section at a slot (0..1 through the section), so when the sections move, the windows move with them. Personal calibration then shifts each window toward the hour the dreamer actually keeps (median of their last days, up to two hours either way). The defaults below land on: speak 7-9a, reflect 10-11a, listen back + read aloud 12p, listen to others 3-6p, instruction 9p.",
  "location": {
    "lat": 37.77,
    "lng": -122.42
  },
  "sectionNames": {
    "day": [
      "Morning Exercise",
      "Daylight Encounter",
      "Daydream",
      "Evening Exercise"
    ],
    "night": [
      "Night School",
      "Night Encounter",
      "Dream Time",
      "Invocation"
    ]
  },
  "calibration": {
    "minSamples": 4,
    "lookbackDays": 14,
    "maxShiftHours": 2
  },
  "activities": [
    {
      "kind": "speak",
      "label": "Speak your dream",
      "section": 0,
      "slot": 0.18,
      "durH": 2.0,
      "daily": true,
      "note": "Upon waking. A suggested five to ten minutes. No timer."
    },
    {
      "kind": "reflect",
      "label": "Reflect about your dream",
      "section": 1,
      "slot": 0.09,
      "durH": 1.0,
      "daily": false,
      "note": "Thirty minutes of journaling."
    },
    {
      "kind": "listen_back",
      "label": "Listen back to your dream",
      "section": 1,
      "slot": 0.7,
      "durH": 1.0,
      "daily": true,
      "note": "Your dream, in your voice or in someone else's."
    },
    {
      "kind": "read_other",
      "label": "Read a dream aloud",
      "section": 1,
      "slot": 0.7,
      "durH": 1.0,
      "daily": false,
      "note": "Read the transcription while their voice plays, or simply read it aloud."
    },
    {
      "kind": "add",
      "label": "Add to your dream",
      "section": 2,
      "slot": 0.0,
      "durH": 1.0,
      "daily": false,
      "note": "Once you have listened back, speak what comes next."
    },
    {
      "kind": "listen_others",
      "label": "Listen to other dreams",
      "section": 2,
      "slot": 0.6,
      "durH": 3.0,
      "daily": false,
      "note": "The dreams spoken for you, in the afternoon."
    },
    {
      "kind": "prompt_share",
      "label": "Share a dream prompt",
      "section": 3,
      "slot": 0.4,
      "durH": 1.5,
      "daily": false,
      "note": "A prompt from the bank goes out for tonight."
    },
    {
      "kind": "speak_other",
      "label": "Speak someone else's dream",
      "section": 4,
      "slot": 0.0,
      "durH": 1.2,
      "daily": false,
      "note": "Their dream, in your voice."
    },
    {
      "kind": "instruction",
      "label": "Listen to dream instruction",
      "section": 4,
      "slot": 0.52,
      "durH": 1.5,
      "daily": true,
      "note": "Tonight's teaching, in audio."
    }
  ]
};
