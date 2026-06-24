# Moor

A quiet, mobile-first PWA of anxiety-relief exercises — breathing, grounding, and body practices — that runs fully offline once installed.

**What's inside**

- **Settle me now** — one tap straight into box breathing: slow, even, and steadying
- **Breathe** — box breathing (with a square that traces one side per phase), plus 4-7-8 and the physiological sigh, each with a rising/falling tide, a phase ring, soft sound cues and gentle haptics
- **Ground** — 5-4-3-2-1 senses walkthrough, and a "name them" category game anyone can play
- **Body** — head-to-toe tense & release (PMR), and a 5-minute movement timer
- Installable, offline-capable, soft lavender theme, respects reduced-motion

## Run it locally

Any static server works, e.g.:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(A plain file:// open won't register the service worker — use a server.)

## Host on GitHub Pages

1. Push these files to the repo root (`index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, and the `icons/` folder).
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **/(root)** → Save.
3. Wait ~1 minute. Your app is live at `https://<username>.github.io/moor/`.

## Notes

- All paths are **relative**, so it works correctly from a project subpath like `/moor/`.
- Fonts load from Google Fonts on first online visit, then get cached for offline use.
- To install on a phone: open the Pages URL, then "Add to Home Screen."
- Bumping the cache: change `VERSION` in `sw.js` when you update files, so clients pick up the new version.
