# Kin Unit Converter

A simple, free unit converter. No account, no ads, no tracking. Works offline.

**Live:** [davidnb3.github.io/keyfinder](https://davidnb3.github.io/keyfinder/) *(rename repo to update URL)*

---

## What it converts

| Category    | Units                                          |
|-------------|------------------------------------------------|
| Temperature | °C · °F · K                                   |
| Weight      | mg · g · kg · oz · lb · st                    |
| Length      | mm · cm · m · km · in · ft · mi               |
| Speed       | km/h · mph · m/s · kn                         |
| Volume      | ml · L · tsp · tbsp · fl oz · cup · pt · gal  |
| Area        | cm² · m² · km² · ha · ft² · ac               |
| Data        | B · KB · MB · GB · TB · PB                    |
| Pressure    | hPa · kPa · bar · psi · atm                   |

Type in any field — all others in the same category update instantly.

---

## Stack

- React 18 + Vite
- PWA (installable, offline-capable)
- Zero runtime dependencies — all conversion math is plain JavaScript
- Deployed via GitHub Actions to GitHub Pages

## Development

```bash
npm install
npm run dev
```

## Deploy

Push to `main`. GitHub Actions builds and deploys to GitHub Pages automatically.
