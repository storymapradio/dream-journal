# Dream Journal

Speak your dream on waking, reflect, listen back and add to it, and carry a prompt into the night, on a wheel of the day that turns with the seasons. Everything stays on your own device.

**Play it:** https://storymapradio.github.io/dream-journal/

**The instrument as it lives on the site:** https://asynchronousinstruments.com

&nbsp;

The Dream Journal is a day of dream practice laid around a wheel.

The wheel is a clock of twenty-four hours cut into eight encounters: four quarters of daylight from sunrise to sunset, and four quarters of night from sunset to sunrise. They are named Morning Exercise, Daylight Encounter, Daydream, Evening Exercise, Night School, Night Encounter, Dream Time and Invocation. The sections follow the sun where you are, so the wheel widens and narrows with the seasons, and each activity rides inside its section at its own hour.

Each activity is a window on the wheel. When a window opens, its card comes to the draw. The hand deals itself the first time you open the journal each day, you lift a card, and you tap to begin. A finished card rests in the grave, four can stand on the field at once, and at two in the morning the wheel turns over and a new hand deals itself. Ten to thirty minutes a turn, two or three turns a day, is the whole practice.

&nbsp;

## The day

**Speak your dream.** In the hours before and after sunrise, speak the dream you have just left. Arm the microphone, record, pause and stop. Five to ten minutes is plenty, and there is no timer.

**Reflect about your dream.** Speak what the dream stirred, or write it with the pen moving.

**Listen back to your dream.** The listening wheel plays your recent dreams and keeps the listening clock.

**Add to your dream.** Once you have listened back, speak what comes next, and the addition is kept beside the dream it continues.

**Share a dream prompt.** In the evening, a prompt comes to you from the bank to carry into the night.

Three cards are always in the hand: **listen**, thirty minutes of your own dreams in a stream; **record**, five more takes for whatever else the day brings; and **library**, every recording, reflection and prompt you have kept, with the dreams you have heard, ready to play or to let go.

&nbsp;

## Your wheel, on your device

Everything you speak and write stays in this browser. You are the keeper of your own wheel, so every door opens when you choose it, and **check cards** lays the whole draw out to look through. Under **SOLOS**, **your rhythm** shows every activity on the wheel to move by hand, lengthen, set to a cadence of days or weeks, or take off the wheel, and **save** writes the rhythm the journal follows from then on. The menu holds the screen, the moving backgrounds, the colors, the tutorial that plays a whole day on the wheel, and the welcome.

&nbsp;

## What belongs to the shared site

The Dream Journal on asynchronousinstruments.com is also a community. There, dreams pass between people: someone reads your dream aloud, you listen to the dreams spoken for you, and you speak someone else's dream in your own voice. Classes gather a cohort around a facilitator, who addresses the room, speaks prompts into the bank and records the night's instruction. Those parts need other dreamers, so they live on the site. This version is the solo practice, whole, and it is where the habit begins.

&nbsp;

## Run it yourself

Open the link above, or serve this folder from any static file server and open `index.html`:

```
npx serve .
```

The microphone needs the page to come from `https://` or `localhost`, so opening the file straight from disk works only for reading and listening.

&nbsp;

## How this version works

This is the same code as the instrument on asynchronousinstruments.com, published from that project as the instrument grows. Where the site keeps what people make in a shared database, this version keeps it in your own browser: `local/local-supabase.js` answers the same calls from IndexedDB on your device, and `local/local.js` holds the few things this instrument needs from it.

There is no login, no account and no server. This page uploads nothing you record or write: it all stays in this browser, and clearing this site's data in your browser clears it.

&nbsp;

## Where it comes from

Made by Aaron Goldstein at Asynchronous Instruments, https://asynchronousinstruments.com. This repository is written by the build in the main project (`storymapradio/open`), so changes made here directly are replaced at the next publication. Issues and ideas are welcome.

&nbsp;

## License

MIT. See `LICENSE`.
