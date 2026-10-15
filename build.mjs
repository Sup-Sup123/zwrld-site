// Builds zwrld.org: renders the templates in /src with the content in /content into /dist.
// Content lives in /content; every commit to main is built and published by GitHub Actions (.github/workflows/pages.yml).
// Links are written relative to the page ({{ROOT}}), so the site works both at zwrld.org and at a project URL like sup-sup123.github.io/zwrld-site/.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, "src"), CONTENT = path.join(ROOT, "content"), DIST = path.join(ROOT, "dist");
const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const site = json(path.join(CONTENT, "site.json"));
const socials = json(path.join(CONTENT, "socials.json"));
const tour = json(path.join(CONTENT, "tour.json"));
const presave = fs.existsSync(path.join(CONTENT, "presave.json")) ? json(path.join(CONTENT, "presave.json")) : {};
const rel = site.latest_release || {};

// ---- nav
const NAV_ITEMS = [["", "Home"], ["about.html", "About"], ["presave/", "Pre-save"], ["newsletter/", "Newsletter"], ["contact.html", "Contact"]];
const nav = (current, root) => `  <nav class="nav" aria-label="Pages">\n` + NAV_ITEMS.map(([href, label]) => `    <a href="${root}${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`).join("\n") + `\n  </nav>`;

// ---- socials (only the ones with a URL show)
const SOCIAL_ORDER = [["soundcloud", "SoundCloud"], ["youtube", "YouTube"], ["facebook", "Facebook"], ["x", "X"], ["snapchat", "Snapchat"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["spotify", "Spotify"]];
const socialsHtml = `    <ul class="socials">\n` + SOCIAL_ORDER.filter(([k]) => socials[k] && String(socials[k]).trim()).map(([k, label]) => `      <li><a href="${esc(socials[k].trim())}" target="_blank" rel="noopener">${label}</a></li>`).join("\n") + `\n    </ul>`;

// ---- pre-save page: the other platforms as small links (Spotify has its own big button there)
const platformsHtml = `    <ul class="socials socials-small">\n` + SOCIAL_ORDER.filter(([k]) => k !== "spotify" && socials[k] && String(socials[k]).trim()).map(([k, label]) => `      <li><a href="${esc(socials[k].trim())}" target="_blank" rel="noopener">${label}</a></li>`).join("\n") + `\n    </ul>`;
const fmtRelease = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ""; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }); };
const releaseCard = (r, root) => { const url = String(r.presave_url || "").trim(); const date = fmtRelease(r.release_date); const cover = String(r.cover || "").trim();
  return `    <article class="release-card">\n` + (cover ? `      <img class="release-cover" src="${esc(root + cover)}" alt="${esc(r.title)} cover" width="600" height="600" loading="lazy">\n` : "") + `      <div class="release-body">\n        <p class="kicker">${date ? "Out " + esc(date) : "Coming soon"}</p>\n        <h3 class="release-name">${esc(r.title)}</h3>\n` + (r.blurb ? `        <p class="release-blurb">${esc(r.blurb)}</p>\n` : "") + (url ? `        <a class="btn btn-primary btn-big" href="${esc(url)}" target="_blank" rel="noopener">${esc(r.presave_label || "Pre-save " + r.title)}</a>\n        <p class="small">One tap saves it to your library the moment it drops.</p>\n` : `        <p class="small">Pre-save link coming soon.</p>\n`) + `      </div>\n    </article>`; };
const presaveUrl = String(presave.presave_url || "").trim();
const presaveReleases = Array.isArray(presave.releases) ? presave.releases.filter(r => r && r.title) : [];
const presaveButton = presaveReleases.length ? `    <div class="release-list">\n` + presaveReleases.map(r => releaseCard(r, "../")).join("\n") + `\n    </div>` : presaveUrl ? `    <div class="presave-live">\n      <p class="kicker">Out soon</p>\n      <a class="btn btn-primary btn-big" href="${esc(presaveUrl)}" target="_blank" rel="noopener">${esc(presave.presave_label || "Pre-save the new song")}</a>\n      <p class="small">One tap saves it to your library the moment it drops.</p>\n    </div>` : "";

// ---- tour (future shows, sorted; empty message otherwise)
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const shows = (tour.shows || []).filter(s => s && s.date && new Date(s.date + "T23:59:59Z") >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)));
const tourHtml = shows.length
  ? `    <ul class="tour-list">\n` + shows.map(s => `      <li><span class="tour-date">${esc(new Date(s.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }))}</span><div class="tour-where">${esc(s.venue)}<span>${esc(s.city)}</span></div>${s.tickets ? `<a class="btn" href="${esc(s.tickets)}" target="_blank" rel="noopener">Tickets</a>` : ""}</li>`).join("\n") + `\n    </ul>`
  : `    <p class="empty">${esc(tour.empty_message || "New dates coming soon.")}</p>`;

// ---- blog
const posts = fs.readdirSync(path.join(CONTENT, "blog")).filter(f => f.endsWith(".md")).map(f => {
  const raw = read(path.join(CONTENT, "blog", f));
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const fm = {}; if (m) for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); }
  const body = m ? m[2] : raw;
  const date = String(fm.date || "").slice(0, 10) || f.slice(0, 10);
  const title = fm.title || f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
  const slug = fm.slug ? slugify(fm.slug) : slugify(f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""));
  return { title, date, summary: fm.summary || "", slug, html: marked.parse(body) };
}).filter(p => !/^(true|yes)$/i.test(String(p.draft))).sort((a, b) => b.date.localeCompare(a.date));

// ---- common replacements
const common = {
  TAGLINE: esc(site.tagline), ABOUT_SHORT: esc(site.about_short), ABOUT_BIO: marked.parse(site.about_bio || ""), BOOKING_EMAIL: esc(site.booking_email),
  REL_TITLE: esc(rel.title), REL_TYPE: esc(rel.type || "Single"), REL_TYPE_LOWER: esc(String(rel.type || "single").toLowerCase()), REL_DATE: esc(rel.date ? fmtDate(rel.date) : ""), REL_BLURB: esc(rel.blurb),
  REL_SC: esc(rel.soundcloud_url), REL_SC_ENC: encodeURIComponent(rel.soundcloud_url || "").replace(/%2F/g, "/"), REL_MP3: esc(rel.mp3_url),
  SOCIAL_SOUNDCLOUD: esc(socials.soundcloud || "https://soundcloud.com/zwrlddd"), SOCIALS: socialsHtml, TOUR: tourHtml,
  CONTACT_ENDPOINT: esc(site.contact_endpoint || ""),
  SUBSCRIBE_ENDPOINT: esc(presave.subscribe_endpoint || ((site.contact_endpoint || "").replace(/\/+$/, "") + "/subscribe")),
  PRESAVE_HEADLINE: esc(presave.headline || "New music is coming"), PRESAVE_INTRO: esc(presave.intro || ""), PRESAVE_BUTTON: presaveButton,
  SPOTIFY_ARTIST: esc(presave.spotify_artist_url || (socials.spotify || "").split("?")[0] || "https://open.spotify.com/artist/3NOvBcSzOHUpAqjqtWXLzQ"), PLATFORMS: platformsHtml,
};
const render = (tpl, vars) => tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => (k in vars ? vars[k] : ""));

// ---- write dist
// ROOT is the relative path back to the site root from the page being written ("./" at the top, "../" one level down, ...).
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
for (const [file, current] of [["index.html", ""], ["about.html", "about.html"], ["contact.html", "contact.html"], ["thanks.html", "contact.html"]]) {
  fs.writeFileSync(path.join(DIST, file), render(read(path.join(SRC, file)), { ...common, ROOT: "./", NAV: nav(current, "./") }));
}
const postsHtml = posts.length ? posts.map(p => `      <li><h3><a href="./${p.slug}/">${esc(p.title)}</a></h3><p class="meta"><time datetime="${p.date}">${esc(fmtDate(p.date))}</time></p>${p.summary ? `<p>${esc(p.summary)}</p>` : ""}</li>`).join("\n") : `      <li><p class="empty">First post coming soon.</p></li>`;
fs.mkdirSync(path.join(DIST, "newsletter"), { recursive: true });
fs.writeFileSync(path.join(DIST, "newsletter", "index.html"), render(read(path.join(SRC, "newsletter.html")), { ...common, ROOT: "../", NAV: nav("newsletter/", "../"), POSTS: postsHtml }));
fs.mkdirSync(path.join(DIST, "presave"), { recursive: true });
fs.writeFileSync(path.join(DIST, "presave", "index.html"), render(read(path.join(SRC, "presave.html")), { ...common, ROOT: "../", NAV: nav("presave/", "../") }));
const postTpl = read(path.join(SRC, "post.html"));
for (const p of posts) {
  fs.mkdirSync(path.join(DIST, "newsletter", p.slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, "newsletter", p.slug, "index.html"), render(postTpl, { ...common, ROOT: "../../", NAV: nav("newsletter/", "../../"), POST_TITLE: esc(p.title), POST_SUMMARY: esc(p.summary || `${p.title} — an update from ZWrld.`), POST_SLUG: p.slug, POST_DATE_ISO: p.date, POST_DATE: esc(fmtDate(p.date)), POST_BODY: p.html }));
}

// ---- old /blog/* addresses: small static redirect pages to /newsletter/* (GitHub Pages has no server-side redirects)
const redirectPage = (to, label) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Moved: ${esc(label)}</title>
<meta name="robots" content="noindex"><link rel="canonical" href="https://zwrld.org/newsletter/${to.replace(/^(\.\.\/)+newsletter\//, "")}">
<meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)});</script>
<style>body{font-family:system-ui,sans-serif;background:#140d0a;color:#f3e9df;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#e8894a}</style></head>
<body><p>This page moved to <a href="${to}">${esc(label)}</a>.</p></body></html>\n`;
fs.mkdirSync(path.join(DIST, "blog"), { recursive: true });
fs.writeFileSync(path.join(DIST, "blog", "index.html"), redirectPage("../newsletter/", "the Newsletter"));
for (const p of posts) {
  fs.mkdirSync(path.join(DIST, "blog", p.slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, "blog", p.slug, "index.html"), redirectPage(`../../newsletter/${p.slug}/`, p.title));
}

// ---- 404 page (GitHub Pages serves /404.html for missing addresses) and a placeholder at /admin
const simplePage = (title, body) => render(read(path.join(SRC, "thanks.html")), { ...common, ROOT: "./", NAV: nav("", "./") })
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} &middot; ZWrld</title>`)
  .replace(/<main>[\s\S]*<\/main>/, `<main>\n  <section class="section section-first">\n${body}\n  </section>\n</main>`)
  .replace(/<link rel="canonical"[^>]*>\n?/, "").replace(/<meta property="og:url"[^>]*>\n?/, "").replace(/<\/head>/, (m, _o, s) => (/name="robots"/.test(s) ? m : '<meta name="robots" content="noindex">\n</head>'));
const baseScript = `<script>document.write('<base href="' + (location.pathname.indexOf("/zwrld-site/") === 0 ? "/zwrld-site/" : "/") + '">')</script>`;
fs.writeFileSync(path.join(DIST, "404.html"), simplePage("Page not found", `    <p class="kicker">404</p>\n    <h2>Page not found</h2>\n    <p class="blurb">That address doesn&rsquo;t exist here. The music is one tap away.</p>\n    <a class="btn btn-primary" href="./">Back to the music</a>`).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + baseScript));
fs.mkdirSync(path.join(DIST, "admin"), { recursive: true });
fs.writeFileSync(path.join(DIST, "admin", "index.html"), simplePage("Admin", `    <p class="kicker">Admin</p>\n    <h2>Coming soon</h2>\n    <p class="blurb">The site editor is being rebuilt for the new hosting. Check back soon.</p>\n    <a class="btn btn-primary" href="../">Back to the site</a>`).replace(/\.\/(styles\.css|assets\/)/g, "../$1").replace(/href="\.\/"/g, 'href="../"').replace(/href="\.\/(about|contact|newsletter|presave)/g, 'href="../$1'));

for (const f of ["styles.css", "og.jpg"]) fs.copyFileSync(path.join(SRC, f), path.join(DIST, f));
fs.cpSync(path.join(SRC, "assets"), path.join(DIST, "assets"), { recursive: true });
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

// ---- short links (content/redirects.json): /<slug>/ -> instant client-side redirect (GitHub Pages has no server redirects)
const redirectsPath = path.join(CONTENT, "redirects.json");
const redirects = fs.existsSync(redirectsPath) ? json(redirectsPath) : {};
let redirectCount = 0;
for (const [slug, target] of Object.entries(redirects)) {
  if (slug.startsWith("_") || !/^https?:\/\//.test(String(target))) continue;
  const t = esc(String(target).trim()); const dirp = path.join(DIST, slug);
  fs.mkdirSync(dirp, { recursive: true });
  fs.writeFileSync(path.join(dirp, "index.html"), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<meta http-equiv="refresh" content="0; url=${t}">\n<link rel="canonical" href="${t}">\n<title>ZWrld</title>\n<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#120b08;color:#f6ebdc;font-family:Inter,system-ui,sans-serif;text-align:center}a{color:#f2c27b}</style>\n<script>location.replace(${JSON.stringify(String(target).trim())});</script>\n</head>\n<body><p>Taking you there&hellip;<br><a href="${t}">Tap here if nothing happens</a></p></body>\n</html>\n`);
  redirectCount++;
}
console.log(`built ${redirectCount} short links, ${4 + 2 + posts.length} pages into dist/ (${posts.length} newsletter post${posts.length === 1 ? "" : "s"}, ${shows.length} upcoming show${shows.length === 1 ? "" : "s"})`);
