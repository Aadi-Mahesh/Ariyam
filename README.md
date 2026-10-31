# Ariyam

Student-made map of STEM places in Kerala and nearby South India. Shares `shared.css` with Arivu.

## Run it
    npm install        # copies Fuse.js into vendor/ (postinstall)
    npm run dev        # http://localhost:5173

Open it through a server, not by double-clicking: `map_locs.json` is loaded with fetch().

## Layout
- `index.html`: page markup
- `ariyam.js`: all behaviour (ES module)
- `ariyam.css`: map-only styles; `shared.css`: tokens + shared components
- `map_locs.json`: the data. Each entry: id, name, place, type, access (open | events | appointment | register), coords [lat, lng], shortDesc, longDesc, website, img, imgSource (link to the photo's source page for credit)
- `shared.css` sits next to `index.html`. If Arivu and Ariyam share one copy on the same site, point the link at that instead.

## Adding a location
Add an object to `map_locs.json` with a unique `id`. `type` must be one of: Robotics, Space, Science Centre, Deep Tech, Biotech, Marine Science. Share links look like `index.html#<id>`.

## Checks and deploy
- `npm run validate` checks `map_locs.json`; `npm run validate:links` also requests every URL (needs internet).
- `netlify.toml` sets headers and caching. Its enforced Content-Security-Policy uses SHA-256 hashes for the two inline scripts in `index.html`; recompute them if either script changes.
- Still to add once the domain is final: `og:url`, a canonical link, `og:image` and `twitter:image` pointing at `/icons/og-image.png`.
