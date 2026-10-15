# zwrld.org

ZWrld's artist site, hosted on Netlify from this repo.

- Edit content at **https://zwrld.org/admin** (log in with GitHub). Every save commits here and Netlify rebuilds the site in about a minute.
- `content/` — tour dates, social links, about text, latest release, blog posts (markdown).
- `src/` — page templates, CSS, images.
- `build.mjs` — renders `src/` + `content/` into `dist/` (`npm run build`).
