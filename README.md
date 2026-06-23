# Stillpoint

A quiet, mobile-first PWA of anxiety-relief exercises — breathing, grounding, and body practices — that runs fully offline once installed.

**What's inside**

- **Settle me now** — one tap straight into the physiological sigh, the fastest acute tool
- **Breathe** — box breathing, 4-7-8, and the physiological sigh, each with an animated breathing orb, a phase ring, soft sound cues and gentle haptics
- **Ground** — 5-4-3-2-1 senses walkthrough, and a "name them" category game
- **Body** — head-to-toe tense & release (PMR), and a 5-minute movement timer
- Installable, offline-capable, warm light theme, respects reduced-motion

## Run it locally

Any static server works, e.g.:

```bash
cd stillpoint
python3 -m http.server 8000
# open http://localhost:8000
```

(A plain file:// open won't register the service worker — use a server.)

## Host on GitHub Pages

**Option A — web upload (no terminal)**

1. Create a new repo on GitHub, e.g. `stillpoint`.
2. Upload everything in this folder (`index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, and the `icons/` folder) to the repo root.
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **/(root)** → Save.
4. Wait ~1 minute. Your app is live at `https://<username>.github.io/stillpoint/`.

**Option B — git (paste and run)**

```bash
cd stillpoint
git init
git add .
git commit -m "Stillpoint PWA"
git branch -M main
git remote add origin https://github.com/<username>/stillpoint.git
git push -u origin main
```

Then enable Pages as in Option A, step 3.

## Notes

- All paths are **relative**, so it works correctly from a project subpath like `/stillpoint/`.
- Fonts load from Google Fonts on first online visit, then get cached for offline use.
- To install on a phone: open the Pages URL, then "Add to Home Screen."
- Bumping the cache: change `VERSION` in `sw.js` when you update files, so clients pick up the new version.
