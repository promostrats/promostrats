# PromoStrats site changes — brief for Claude Code

This is a summary of decisions made in planning, not yet built. Read this
and `portfolio-mockup.html` (in this same folder) before making changes.
Propose a plan and file list first — don't rewrite the whole site in one pass.

## 1. Positioning shift

Narrow the site's targeting from a broad "UK independent ecommerce" framing
to a specific niche: **independent gift shops, florists, and small UK
brands.** This should show up in:

- Homepage hero copy
- Portfolio page hero copy
- Meta description / SEO title tags
- Anywhere the services page currently describes "who this is for"

Don't delete or hide past client work that falls outside this niche
(e.g. anything more food/drink-led) — just don't lead with it.

## 2. Homepage: replace the site-audit tool with a contact form

- **Remove** the Shop Audit / site-checker widget as the public homepage
  CTA.
- **Keep** the underlying audit tool/logic in the codebase — it's still
  used for the cold-outreach workflow (Tella video walkthroughs +
  scorecard). Only the public-facing homepage placement is going.
- **Add** a contact form directly in or near the hero — name, email,
  subject/message, submit. No extra click to a separate contact page.
  Reference: chikara.digital homepage (form sits right in the hero next
  to the pitch).

## 3. Portfolio page: rebuild as index + case-study reveal

Current page is one long scroll with before/after sliders and inline
paragraphs for every project. Replace with:

- **Index**: a grid of project cards — one strong visual per card, client
  name, one short tag line. No slider, no paragraph on the index itself.
- **Detail**: clicking a card reveals the full story — what was wrong,
  what changed, what happened after, plus a testimonial where available.

A working structural/interaction mockup of this is in
`portfolio-mockup.html` in this folder — treat it as the reference for
layout, grid behaviour, and the click-to-reveal interaction (currently a
modal; open to being real per-project pages/routes instead if that fits
the Astro routing better).

### Real project content to use

**The Artisan Merchants** — gift & homeware retailer, full redesign +
ongoing SEO retainer.
- Problem: stock theme didn't reflect the shop's actual curated identity.
- What changed: homepage + collection redesign in a navy/brass/cream
  "Curator's Cabinet" palette (Cormorant Garamond), custom Shopify Liquid
  collection filter (client-side JS).
- Result (real data, use as-is): average search position ~11.5 despite
  ~141,000 monthly impressions. A Kovap cable-car query ranks position 2
  with a 12.4% CTR, well above account average.
- Testimonial: not yet collected — ask James or Ben.

**Pretty Busy Blooms** — florist.
- What changed: custom delivery date picker built into ordering flow;
  proposed a dedicated weddings page.
- Result/testimonial: not yet collected — ask Nicki. Leave as a marked
  placeholder, don't invent a number.

**Flavour Like Fancy** — Leeds, homepage + information pages.
- What changed: pink/turquoise/yellow palette, Dawn-based theme, built to
  match the brand's colourful indie identity.
- Result/testimonial: not yet collected — ask Tasha. Leave as a marked
  placeholder.

**Andy's Airplants** — plants, homepage redesign.
- Status: in progress, not live. Show as "in progress" rather than a
  finished case study; short note only, no fabricated result.

## 4. Colour system: warm it up

The existing PromoStrats system (Bricolage Grotesque + IBM Plex Mono
typography) stays. Replace the cooler paper/near-black/cobalt tokens with:

```css
--paper: #EDE0C8;   /* warm kraft/oat, was a cooler cream */
--ink:   #2B1D12;   /* warm espresso, was near-black */
--accent:#A63D2F;   /* warm brick/rust, was cobalt blue */

/* dark mode */
--paper: #221509;
--ink:   #F0E4CC;
--accent:#D9805F;
```

Apply site-wide, not just on the portfolio page. Leave individual client
project colours alone where they represent that client's own real brand
(e.g. Artisan Merchants' navy/brass) — those aren't part of the site's
own chrome and shouldn't be re-themed.

## Suggested order of work

1. Colour tokens site-wide (mechanical, low-risk, do first)
2. Homepage: swap audit widget for contact form
3. Portfolio page rebuild
4. Positioning copy pass across homepage/portfolio/meta tags
