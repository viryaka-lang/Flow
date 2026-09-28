# Flow

A simple, private period tracker that runs in the browser and installs as an app (PWA).
It does two things:

1. **Tracks when each period starts and ends.**
2. **Predicts the next periods** from your own history.

All data stays on your device (localStorage). There are no accounts, servers or trackers.

## Using it

- **Today**: shows whether you're on your period (and which day), or how many days until
  the next one, and whether it's late. Big buttons: *Period started today* / *Period ended today*,
  plus "on another day…" for anything you log late. Every change can be undone from the toast.
- **Calendar**: logged periods are filled, predicted ones are dashed. Tap any day to mark
  a start or an end, edit or delete a period.
- **History**: every logged period with its length and cycle length. Add past periods here
  to get personalised predictions straight away.
- **Settings**: typical cycle/period length (used until you've logged enough periods),
  export/import a JSON backup, erase all data.

## How predictions work

- Cycle length = the **median** of your last 6 cycles (start to next start). Period length = the
  median of your last 6 finished periods. The median means one forgotten or unusual month doesn't
  throw everything off.
- Until two periods are logged, the typical lengths from Settings are used.
- The "± days" is the average distance of your recent cycles from that median.
- When a period is late, the next one is shown as "any day now" and later predictions shift with it.

The logic lives in `js/cycle.js` (pure functions) and is covered by `tests/cycle.test.js`.

## Upgrading from FlowSync

On first launch, Flow imports your periods from the old FlowSync app on the same device.
It uses the profile that was active and skips FlowSync's demo profiles (Sarah, Elena, Maya).
The old data itself is left untouched. Old FlowSync backup files can also be imported from Settings.

## Development

```sh
npm start   # serves on http://localhost:8080
npm test    # runs the prediction tests (Node 20+)
```

No build step and no dependencies: plain HTML, CSS and ES modules.
