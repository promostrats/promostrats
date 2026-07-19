// PromoStrats — live site audit endpoint (Vercel serverless function)
//
// Runs on Vercel automatically because it lives in the root /api directory.
// Fetches a visitor-supplied URL server-side (browsers can't fetch other
// origins), parses the HTML, runs a set of real SEO / usability checks and
// returns a scored JSON report.
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

  // IPv4 private / loopback / link-local ranges
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
function getMetaContent(html, nameOrProp) {
  // matches <meta name="x" content="y"> or property="x", either attr order
  const re = new RegExp(
    '<meta[^>]*(?:name|property)\\s*=\\s*["\']' +
      nameOrProp +
      '["\'][^>]*>',
    'i'
  );
  const tag = firstMatch(new RegExp('(' + re.source + ')', 'i'), html);
  if (!tag) return null;
  return firstMatch(/content\s*=\s*["']([^"']*)["']/i, tag);
}

// ---------------------------------------------------------------------------
// The analysis — exported separately so it can be unit-tested in Node.
// ---------------------------------------------------------------------------
export function analyze(rawHtml, ctx = {}) {
  const html = stripComments(rawHtml || '');
  const findings = [];
  const add = (label, status, detail, advice) =>
    findings.push({ label, status, detail, advice });

  // --- HTTPS ---------------------------------------------------------------
  if (ctx.finalUrl && ctx.finalUrl.startsWith('https://')) {
    add('HTTPS', 'pass', 'Served securely over HTTPS.');
  } else {
    add(
      'HTTPS',
      'fail',
      'Not served over HTTPS.',
      'Secure your site with an SSL certificate — it affects trust and rankings.'
    );
  }

  // --- Title ---------------------------------------------------------------
  const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  if (!title) {
    add('Page title', 'fail', 'No <title> tag found.', 'Add a unique, descriptive title tag.');
  } else if (title.length < 15 || title.length > 65) {
    add(
      'Page title',
      'warn',
      `Title is ${title.length} characters: "${title}".`,
      'Aim for roughly 30–60 characters so it isn’t cut off in search results.'
    );
  } else {
    add('Page title', 'pass', `"${title}" (${title.length} chars).`);
  }

  // --- Meta description ----------------------------------------------------
  const desc = getMetaContent(html, 'description');
  if (!desc) {
    add(
      'Meta description',
      'fail',
      'No meta description found.',
      'Add a 70–160 character summary — it’s often your search-result snippet.'
    );
  } else if (desc.length < 50 || desc.length > 165) {
    add(
      'Meta description',
      'warn',
      `Description is ${desc.length} characters.`,
      'Aim for 70–160 characters for the cleanest search snippet.'
    );
  } else {
    add('Meta description', 'pass', `Present (${desc.length} chars).`);
  }

  // --- H1 ------------------------------------------------------------------
  const h1Count = countMatches(/<h1[\s>]/gi, html);
  if (h1Count === 0) {
    add('H1 heading', 'fail', 'No <h1> found.', 'Every page should have one clear H1 describing its purpose.');
  } else if (h1Count > 1) {
    add('H1 heading', 'warn', `${h1Count} H1 headings found.`, 'Use a single H1 per page for a clear content hierarchy.');
  } else {
    add('H1 heading', 'pass', 'Exactly one H1 — good structure.');
  }

  // --- Mobile viewport -----------------------------------------------------
  if (getMetaContent(html, 'viewport')) {
    add('Mobile viewport', 'pass', 'Responsive viewport tag present.');
  } else {
    add(
      'Mobile viewport',
      'fail',
      'No viewport meta tag.',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile.'
    );
  }

  // --- Image alt text ------------------------------------------------------
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const total = imgTags.length;
  const missingAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']*["']/i.test(t)).length;
  if (total === 0) {
    add('Image alt text', 'warn', 'No images found on the page.', undefined);
  } else if (missingAlt === 0) {
    add('Image alt text', 'pass', `All ${total} images have alt text.`);
  } else {
    const ratio = missingAlt / total;
    add(
      'Image alt text',
      ratio > 0.5 ? 'fail' : 'warn',
      `${missingAlt} of ${total} images are missing alt text.`,
      'Describe images with alt text for accessibility and image SEO.'
    );
  }

  // --- <html lang> ---------------------------------------------------------
  if (/<html[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) {
    add('Language attribute', 'pass', 'The <html> tag declares a language.');
  } else {
    add('Language attribute', 'warn', 'No lang attribute on <html>.', 'Add e.g. <html lang="en-GB"> for accessibility.');
  }

  // --- Canonical -----------------------------------------------------------
  if (/<link[^>]*rel\s*=\s*["']canonical["']/i.test(html)) {
    add('Canonical URL', 'pass', 'Canonical link present.');
  } else {
    add('Canonical URL', 'warn', 'No canonical link.', 'Add a canonical tag to avoid duplicate-content issues.');
  }

  // --- Open Graph (social sharing) -----------------------------------------
  const ogTitle = getMetaContent(html, 'og:title');
  const ogImage = getMetaContent(html, 'og:image');
  if (ogTitle && ogImage) {
    add('Social sharing (Open Graph)', 'pass', 'og:title and og:image are set.');
  } else if (ogTitle || ogImage) {
    add('Social sharing (Open Graph)', 'warn', 'Some Open Graph tags missing.', 'Set og:title, og:description and og:image so links preview well.');
  } else {
    add('Social sharing (Open Graph)', 'fail', 'No Open Graph tags.', 'Add og: tags so shared links show a title and image.');
  }

  // --- Favicon -------------------------------------------------------------
  if (/<link[^>]*rel\s*=\s*["'][^"']*icon[^"']*["']/i.test(html)) {
    add('Favicon', 'pass', 'Favicon declared.');
  } else {
    add('Favicon', 'warn', 'No favicon link found.', 'Add a favicon for browser tabs and bookmarks.');
  }

  // --- Structured data -----------------------------------------------------
  if (/<script[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html)) {
    add('Structured data', 'pass', 'JSON-LD structured data present.');
  } else {
    add('Structured data', 'warn', 'No structured data (JSON-LD).', 'Add schema.org markup to help search engines understand your content.');
  }

  // --- Score ---------------------------------------------------------------
  const weight = { pass: 1, warn: 0.5, fail: 0 };
  const scored = findings.filter((f) => !(f.label === 'Image alt text' && f.detail.startsWith('No images')));
  const max = scored.length;
  const got = scored.reduce((s, f) => s + weight[f.status], 0);
  const score = max ? Math.round((got / max) * 100) : 0;
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  const counts = {
    pass: findings.filter((f) => f.status === 'pass').length,
    warn: findings.filter((f) => f.status === 'warn').length,
    fail: findings.filter((f) => f.status === 'fail').length,
  };

  return { score, grade, counts, findings, meta: { title, description: desc } };
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
    return res.end(
      JSON.stringify({ error: 'Please enter a valid public website URL (e.g. yourbusiness.com).' })
    );
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
      return res.end(
        JSON.stringify({
          error: `The site responded with HTTP ${resp.status}. Double-check the URL and that the site is live.`,
          url: url.href,
          status: resp.status,
        })
      );
    }

    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          error: 'That URL didn’t return an HTML page, so there’s nothing to audit.',
          url: finalUrl,
        })
      );
    }

    // Read with a byte cap
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
    return res.end(
      JSON.stringify({
        url: url.href,
        finalUrl,
        fetchedAt: new Date().toISOString(),
        ...report,
      })
    );
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        error: aborted
          ? 'The site took too long to respond. Try again, or check it’s reachable.'
          : 'Couldn’t reach that site. Check the URL is correct and the site is online.',
        url: url.href,
      })
    );
  }
}
