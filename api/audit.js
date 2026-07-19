// PromoStrats — live site audit endpoint (Vercel serverless function)
//
// Runs on Vercel automatically because it lives in the root /api directory.
// Fetches a visitor-supplied URL server-side (browsers can't fetch other
// origins), parses the HTML, and returns TWO scored reports: an SEO score and
// a Design/UX foundations score, each with plain-English findings + fixes.
//
// NOTE: this only runs on the deployed site (or `vercel dev`), not under a
// plain `astro dev` server — astro dev doesn't execute /api functions.

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 3_000_000; // 3 MB cap on downloaded HTML

// ---------------------------------------------------------------------------
// SSRF protection — refuse to fetch internal / private hosts.
// ---------------------------------------------------------------------------
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
  }
  return false;
}

function normaliseUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

// ---------------------------------------------------------------------------
// Tiny HTML helpers (regex-based — good enough for these surface checks).
// ---------------------------------------------------------------------------
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}
function firstMatch(re, html) {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}
function countMatches(re, html) {
  const m = html.match(re);
  return m ? m.length : 0;
}
function has(re, html) {
  return re.test(html);
}
function getMetaContent(html, nameOrProp) {
  const re = new RegExp('<meta[^>]*(?:name|property)\\s*=\\s*["\']' + nameOrProp + '["\'][^>]*>', 'i');
  const tag = firstMatch(new RegExp('(' + re.source + ')', 'i'), html);
  if (!tag) return null;
  return firstMatch(/content\s*=\s*["']([^"']*)["']/i, tag);
}

function scoreGroup(findings) {
  const weight = { pass: 1, warn: 0.5, fail: 0 };
  const max = findings.length;
  const got = findings.reduce((s, f) => s + weight[f.status], 0);
  const score = max ? Math.round((got / max) * 100) : 0;
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const counts = {
    pass: findings.filter((f) => f.status === 'pass').length,
    warn: findings.filter((f) => f.status === 'warn').length,
    fail: findings.filter((f) => f.status === 'fail').length,
  };
  return { score, grade, counts, findings };
}

// ---------------------------------------------------------------------------
// The analysis — exported separately so it can be unit-tested in Node.
// ---------------------------------------------------------------------------
export function analyze(rawHtml, ctx = {}) {
  const html = stripComments(rawHtml || '');
  const seo = [];
  const design = [];
  const addSeo = (label, status, detail, advice) => seo.push({ label, status, detail, advice });
  const addDes = (label, status, detail, advice) => design.push({ label, status, detail, advice });

  // ======================= SEO =============================================

  // HTTPS
  if (ctx.finalUrl && ctx.finalUrl.startsWith('https://')) {
    addSeo('HTTPS', 'pass', 'Served securely over HTTPS.');
  } else {
    addSeo('HTTPS', 'fail', 'Not served over HTTPS.', 'Add an SSL certificate — HTTPS is a confirmed ranking signal and a trust marker.');
  }

  // Title
  const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  if (!title) {
    addSeo('Page title', 'fail', 'No <title> tag found.', 'Add a unique, descriptive title tag to every page.');
  } else if (title.length < 15 || title.length > 65) {
    addSeo('Page title', 'warn', `Title is ${title.length} characters: "${title}".`, 'Aim for roughly 30–60 characters so it isn’t truncated in search results.');
  } else {
    addSeo('Page title', 'pass', `"${title}" (${title.length} chars).`);
  }

  // Meta description
  const desc = getMetaContent(html, 'description');
  if (!desc) {
    addSeo('Meta description', 'fail', 'No meta description found.', 'Add a 70–160 character summary — it’s often your search-result snippet.');
  } else if (desc.length < 50 || desc.length > 165) {
    addSeo('Meta description', 'warn', `Description is ${desc.length} characters.`, 'Aim for 70–160 characters for the cleanest search snippet.');
  } else {
    addSeo('Meta description', 'pass', `Present (${desc.length} chars).`);
  }

  // Single H1
  const h1Count = countMatches(/<h1[\s>]/gi, html);
  if (h1Count === 0) {
    addSeo('H1 heading', 'fail', 'No <h1> found.', 'Give every page one clear H1 describing its main topic.');
  } else if (h1Count > 1) {
    addSeo('H1 heading', 'warn', `${h1Count} H1 headings found.`, 'Use a single H1 per page so search engines know the primary topic.');
  } else {
    addSeo('H1 heading', 'pass', 'Exactly one H1 — clear primary topic.');
  }

  // Indexability
  const robots = getMetaContent(html, 'robots');
  if (robots && /noindex/i.test(robots)) {
    addSeo('Indexability', 'fail', 'Page is set to "noindex" — search engines are told not to list it.', 'Remove the noindex directive if you want this page to rank.');
  } else {
    addSeo('Indexability', 'pass', 'Page is open to being indexed by search engines.');
  }

  // Canonical
  if (has(/<link[^>]*rel\s*=\s*["']canonical["']/i, html)) {
    addSeo('Canonical URL', 'pass', 'Canonical link present.');
  } else {
    addSeo('Canonical URL', 'warn', 'No canonical link.', 'Add a canonical tag to prevent duplicate-content dilution.');
  }

  // Structured data
  if (has(/<script[^>]*type\s*=\s*["']application\/ld\+json["']/i, html)) {
    addSeo('Structured data', 'pass', 'JSON-LD structured data present.');
  } else {
    addSeo('Structured data', 'warn', 'No structured data (JSON-LD).', 'Add schema.org markup so search engines understand your business and can show rich results.');
  }

  // Social sharing
  const ogTitle = getMetaContent(html, 'og:title');
  const ogImage = getMetaContent(html, 'og:image');
  const twitter = getMetaContent(html, 'twitter:card');
  if (ogTitle && ogImage) {
    addSeo('Social sharing tags', 'pass', `Open Graph set${twitter ? ' (plus Twitter card)' : ''}.`);
  } else if (ogTitle || ogImage || twitter) {
    addSeo('Social sharing tags', 'warn', 'Some social tags missing.', 'Set og:title, og:description and og:image so shared links preview with a title and picture.');
  } else {
    addSeo('Social sharing tags', 'fail', 'No Open Graph or Twitter tags.', 'Add og: tags so links shared on social show a proper preview.');
  }

  // ======================= DESIGN / UX =====================================

  // Mobile viewport
  if (getMetaContent(html, 'viewport')) {
    addDes('Mobile responsive', 'pass', 'Responsive viewport tag present.');
  } else {
    addDes('Mobile responsive', 'fail', 'No viewport meta tag — the site likely won’t adapt to phones.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  }

  // Semantic structure
  const semTags = ['<header', '<nav', '<main', '<footer'];
  const semPresent = semTags.filter((t) => html.toLowerCase().includes(t));
  const hasMain = html.toLowerCase().includes('<main');
  if (semPresent.length >= 3 && hasMain) {
    addDes('Page structure', 'pass', `Uses semantic layout tags (${semPresent.map((t) => t.slice(1)).join(', ')}).`);
  } else if (semPresent.length >= 1) {
    addDes('Page structure', 'warn', `Only ${semPresent.length} of 4 landmark tags used.`, 'Use <header>, <nav>, <main> and <footer> so browsers, screen readers and search engines understand the layout.');
  } else {
    addDes('Page structure', 'fail', 'No semantic landmark tags — the page is built from generic <div>s.', 'Wrap regions in <header>, <nav>, <main> and <footer> for structure and accessibility.');
  }

  // Content headings / scannability
  const h2Count = countMatches(/<h2[\s>]/gi, html);
  if (h1Count >= 1 && h2Count >= 2) {
    addDes('Content headings', 'pass', `${h2Count} subheadings break up the content.`);
  } else if (h2Count === 1) {
    addDes('Content headings', 'warn', 'Only one subheading found.', 'Break longer pages into scannable sections with H2 subheadings.');
  } else {
    addDes('Content headings', 'warn', 'No H2 subheadings found.', 'Use H2 subheadings so visitors can scan the page quickly.');
  }

  // Image alt text (accessibility)
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const total = imgTags.length;
  const missingAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']*["']/i.test(t)).length;
  if (total === 0) {
    addDes('Image alt text', 'pass', 'No images to check.');
  } else if (missingAlt === 0) {
    addDes('Image alt text', 'pass', `All ${total} images have alt text.`);
  } else {
    const ratio = missingAlt / total;
    addDes('Image alt text', ratio > 0.5 ? 'fail' : 'warn', `${missingAlt} of ${total} images are missing alt text.`, 'Describe images with alt text for accessibility and image search.');
  }

  // Language attribute (accessibility)
  if (has(/<html[^>]*\blang\s*=\s*["'][^"']+["']/i, html)) {
    addDes('Language declared', 'pass', 'The <html> tag declares a language.');
  } else {
    addDes('Language declared', 'warn', 'No lang attribute on <html>.', 'Add e.g. <html lang="en-GB"> so screen readers pronounce content correctly.');
  }

  // Favicon
  if (has(/<link[^>]*rel\s*=\s*["'][^"']*icon[^"']*["']/i, html)) {
    addDes('Favicon', 'pass', 'Favicon declared.');
  } else {
    addDes('Favicon', 'warn', 'No favicon found.', 'Add a favicon so your brand shows in tabs and bookmarks.');
  }

  // Mobile / brand polish
  const touch = has(/<link[^>]*rel\s*=\s*["']apple-touch-icon["']/i, html);
  const themeColor = !!getMetaContent(html, 'theme-color');
  if (touch && themeColor) {
    addDes('Mobile polish', 'pass', 'Apple touch icon and theme colour both set.');
  } else if (touch || themeColor) {
    addDes('Mobile polish', 'warn', `Missing ${touch ? 'theme-color' : 'apple-touch-icon'}.`, 'Add an apple-touch-icon and a theme-color for a polished look when saved to a phone.');
  } else {
    addDes('Mobile polish', 'warn', 'No apple-touch-icon or theme-color.', 'Add these so the site looks intentional when bookmarked or added to a home screen.');
  }

  const seoReport = scoreGroup(seo);
  const designReport = scoreGroup(design);
  const overall = Math.round((seoReport.score + designReport.score) / 2);

  return {
    overall,
    seo: seoReport,
    design: designReport,
    meta: { title, description: desc },
  };
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const raw =
    (req.query && req.query.url) ||
    (() => {
      try {
        return new URL(req.url, 'http://localhost').searchParams.get('url');
      } catch {
        return null;
      }
    })();

  const url = normaliseUrl(raw);
  if (!url) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Please enter a valid public website URL (e.g. yourbusiness.com).' }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url.href, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'PromoStratsSiteCheck/1.0 (+https://promostrats.com/site-check)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    const finalUrl = resp.url || url.href;
    const contentType = resp.headers.get('content-type') || '';

    if (!resp.ok) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ error: `The site responded with HTTP ${resp.status}. Double-check the URL and that the site is live.`, url: url.href, status: resp.status }));
    }
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ error: 'That URL didn’t return an HTML page, so there’s nothing to audit.', url: finalUrl }));
    }

    const reader = resp.body.getReader();
    let received = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      chunks.push(value);
      if (received > MAX_BYTES) {
        controller.abort();
        break;
      }
    }
    const html = Buffer.concat(chunks).toString('utf8');

    const report = analyze(html, { finalUrl });
    res.statusCode = 200;
    return res.end(JSON.stringify({ url: url.href, finalUrl, fetchedAt: new Date().toISOString(), ...report }));
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
    res.statusCode = 200;
    return res.end(JSON.stringify({ error: aborted ? 'The site took too long to respond. Try again, or check it’s reachable.' : 'Couldn’t reach that site. Check the URL is correct and the site is online.', url: url.href }));
  }
}
