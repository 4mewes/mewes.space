# Pigeon Webring

A self-contained static webring embed. Sites include one script, and that script loads the CSS, the site list, and the local PNG animation frames.

## Embed

Host this directory somewhere public, then add this to participating sites:

```html
<script src="https://your-domain.example/pigeon-webring.js" defer></script>
```

The default behavior is:

- first pigeon tries to appear after one minute
- later pigeons try to appear once every minute
- each pigeon walks for 15 seconds
- pigeons sometimes stop or peck before walking again
- the link above the pigeon points to a random site in `pigeon-sites.js`
- the current hostname is excluded from the random target list
- a small bottom-right square links to `pigeon-info.html`

## Sites

Edit `pigeon-sites.js` to add or remove ring members:

```js
window.PigeonWebringSites = [
  "https://www.mewes-space.xyz",
  "https://www.wikipedia.org"
];
```

## Configuration

Set `window.PigeonWebring.config` before loading the script:

```html
<script>
  window.PigeonWebring = {
    config: {
      intervalMs: 60000,
      durationMs: 15000,
      spawnChance: 1
    }
  };
</script>
<script src="https://your-domain.example/pigeon-webring.js" defer></script>
```

Useful options:

- `intervalMs`: time between spawn attempts
- `initialDelayMs`: time before the first spawn attempt
- `durationMs`: how long the pigeon walks before flying away
- `spawnChance`: chance from `0` to `1` for each spawn attempt
- `hoverStopRadius`: distance in pixels where the cursor makes the pigeon stop
- `hoverIdleFrameMs`: frame speed for the slow hover pause animation
- `peckChance`: chance that an idle decision becomes a peck
- `pauseChance`: chance that an idle decision becomes a pause
- `linkPrefix`: text before the destination hostname
- `linkTarget`: anchor target, defaults to `_blank`
- `infoHref`: info-page link for the bottom-right square
- `infoIcon`: icon filename loaded from `assets/`
- `infoText`: bottom-right badge label

## Local Demo

Run a static server from this directory:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

## Files

- `pigeon-webring.js`: loader and runtime
- `pigeon-webring.css`: injected by the loader
- `pigeon-sites.js`: injected by the loader
- `pigeon-info.html`: placeholder info page
- `assets/*.png`: copied walk frames used by the runtime
- `index.html`: local demo page
