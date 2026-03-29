# KeyFinder

Upload any audio file and instantly detect its musical key and Camelot wheel notation — entirely in your browser, with no server, no account, and no tracking.

## Features

- Detects musical key (e.g. A minor, C major) and Camelot wheel notation (e.g. 8A, 8B)
- Works with MP3, WAV, FLAC, OGG, AAC, M4A and any format the browser can decode
- Light and dark theme with system preference detection
- Installs as a PWA — works offline after the first visit
- No data ever leaves your device

## How it works

Audio is decoded locally via the Web Audio API. A chromagram is computed from the raw PCM samples using a short-time Fourier transform, then compared against the 24 Krumhansl-Schmuckler key profiles (12 major + 12 minor) using Pearson correlation. The highest-correlation profile determines the key. No external libraries are used for DSP.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output goes to `dist/`. The build is a fully static site that can be hosted on any static host.

## Deploy

The app requires HTTPS for PWA install prompts. Recommended hosts (all free):

- **Vercel**: `vercel --prod` or connect the GitHub repo
- **Netlify**: drag the `dist/` folder to [app.netlify.com](https://app.netlify.com)
- **GitHub Pages**: push `dist/` to the `gh-pages` branch

## PWA icons

The current icon is an SVG (`public/icons/icon.svg`), which works in Chrome and modern browsers. For full iOS home-screen support, generate PNG versions at 192×192 and 512×512 and update `vite.config.js` to reference them.
