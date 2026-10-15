# zwrld.org

ZWrld's artist site. Built from this repo and published by GitHub Pages (`.github/workflows/pages.yml` runs on every push to `main`).

- `content/` — tour dates, social links, about text, latest release, the contact form's address, newsletter posts (markdown).
- `src/` — page templates, CSS, images.
- `build.mjs` — renders `src/` + `content/` into `dist/` (`npm run build`). Links are relative, so the build works at zwrld.org and at the project URL alike.
- The contact form posts to a small Cloudflare Worker (address in `content/site.json`, `contact_endpoint`) that emails the message to the booking address.
- Old `/blog/*` addresses are static redirect pages to `/newsletter/*`.
- `admin/` is the old Decap CMS setup (Netlify Identity); it is not published while the site is on GitHub Pages — `/admin` shows a "coming soon" page.
