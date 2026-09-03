// Single source of truth for portfolio projects — consumed by both the
// /portfolio index grid and the /portfolio/[slug] detail pages.
//
// Adding a project: drop screenshots into src/assets/images/, import them
// below, and add an entry. A project with no screenshots yet gets `swatch`
// instead of `cardImage` and renders a CSS-only card visual (see
// components/ProjectSwatch.astro).
//
// Results and testimonials are deliberately typed so an uncollected one has
// to be an explicit `pending` note naming who to chase, rather than an empty
// string that silently renders as nothing — or worse, an invented number.

import type { ImageMetadata } from 'astro';

import tamHomeBefore from '../assets/images/tam-home-before.png';
import tamHomeAfter from '../assets/images/tam-home-after.png';
import tamCollectionBefore from '../assets/images/tam-collection-before.png';
import tamCollectionAfter from '../assets/images/tam-collection-after.png';
import flfBefore from '../assets/images/flf-before.png';
import flfAfter from '../assets/images/flf-after.png';

export type Compare = {
  label: string;
  before: ImageMetadata | null;
  after: ImageMetadata | null;
  alt: string;
};

export type Pending = { pending: string };
export type Quote = { text: string; name: string; role: string; source?: string };

export type Project = {
  slug: string;
  number: string;
  name: string;
  /** One short line for the index card — no paragraphs on the index. */
  tagline: string;
  scope: string;
  status: 'live' | 'in-progress';
  live: string | null;
  /** Index card visual: a real screenshot where one exists, else a swatch. */
  cardImage: ImageMetadata | null;
  swatch: 'blooms' | 'plants' | null;
  /** Detail page: what was wrong, what changed, what happened after. */
  problem: string;
  changed: string;
  result: string | Pending;
  testimonial: Quote | Pending;
  changelog: { type: 'add' | 'del'; text: string }[];
  compares: Compare[];
};

export const projects: Project[] = [
  {
    slug: 'the-artisan-merchants',
    number: '01',
    name: 'The Artisan Merchants',
    tagline: 'Gift & homeware — redesign + SEO',
    scope: 'redesign · seo · ongoing',
    status: 'live',
    live: 'https://theartisanmerchants.co.uk',
    cardImage: tamHomeAfter,
    swatch: null,
    problem:
      'The Artisan Merchants sell hand-crafted European toys, homeware and decorations — a genuinely curated collection, picked by James and Ben. Online it looked like every other stock Shopify shop: a generic slider, flat collection tiles, and no sense that anyone had chosen anything.',
    changed:
      'I rebuilt the homepage and collection pages around a <strong>“curator’s cabinet” look</strong> — deep navy, brass detailing and cream, set in Cormorant Garamond — so the products feel collected rather than listed. The collection pages got a <strong>custom Shopify Liquid filter</strong> with client-side JS, filtering by maker, type and price, so browsing feels like moving through a shop instead of a spreadsheet. Earlier on I also sorted their search-engine setup and product copy, and I look after the site on an ongoing basis.',
    result:
      'The SEO retainer that followed found where the site was actually losing clicks: an average search position of about <strong>11.5</strong> across roughly <strong>141,000 monthly impressions</strong> — just below where clicks concentrate. Where it does rank well, it converts: a Kovap cable-car search sitting at <strong>position 2 pulls a 12.4% click-through rate</strong>, well above the account average. Closing that gap is what the ongoing work is aimed at.',
    testimonial: {
      text: 'Connor took the time to understand our business and implemented improvements across our whole site — from homepage layout and navigation through to detailed SEO work on product copy, metadata and images. Clear plan, measurable progress, smooth and collaborative.',
      name: 'Ben Meekings',
      role: 'The Artisan Merchants',
      source: 'https://www.google.com/maps/place/PromoStrats',
    },
    changelog: [
      { type: 'del', text: 'generic stock theme, no identity' },
      { type: 'add', text: 'curator’s cabinet redesign' },
      { type: 'add', text: 'custom Liquid collection filter' },
      { type: 'add', text: 'editorial product cards' },
      { type: 'add', text: 'seo setup + product copy' },
      { type: 'add', text: 'ongoing support' },
    ],
    compares: [
      { label: 'Homepage', before: tamHomeBefore, after: tamHomeAfter, alt: 'The Artisan Merchants homepage' },
      {
        label: 'Collection page',
        before: tamCollectionBefore,
        after: tamCollectionAfter,
        alt: 'The Artisan Merchants collection page',
      },
    ],
  },
  {
    slug: 'pretty-busy-blooms',
    number: '02',
    name: 'Pretty Busy Blooms',
    tagline: 'Florist — delivery tooling',
    scope: 'ordering flow · delivery dates',
    status: 'live',
    live: null,
    cardImage: null,
    swatch: 'blooms',
    problem:
      'Flowers are almost always bought for a specific date — a birthday, an anniversary, a funeral — and the site had no clean way to ask for one. Delivery dates were arriving in order notes, or not at all.',
    changed:
      'I built a <strong>custom delivery date picker</strong> into the ordering flow, so the date is captured properly at checkout instead of being retyped out of a comment box. I also proposed a <strong>dedicated weddings page</strong>, to catch higher-value enquiries separately from same-day orders.',
    result: { pending: 'Results not collected yet — ask Nicki.' },
    testimonial: { pending: 'Testimonial not collected yet — ask Nicki.' },
    changelog: [
      { type: 'del', text: 'delivery dates in order notes' },
      { type: 'add', text: 'custom delivery date picker' },
      { type: 'add', text: 'weddings page proposed' },
    ],
    compares: [],
  },
  {
    slug: 'flavour-like-fancy',
    number: '03',
    name: 'Flavour Like Fancy',
    tagline: 'Leeds — homepage + brand system',
    scope: 'homepage · information pages',
    status: 'live',
    live: 'https://flavourlikefancy.co.uk',
    cardImage: flfAfter,
    swatch: null,
    problem:
      'Flavour Like Fancy is a bright, independent gift shop in Chapel Allerton, Leeds. The brand’s personality — playful, colourful, unmistakably indie — wasn’t coming through anywhere online: it was running a stock theme that gave none of it away.',
    changed:
      'I redesigned the homepage and information pages to match how the shop actually feels, on a <strong>Dawn-based theme</strong> in pink, turquoise and yellow: a <strong>bold hero with a hand-cut product collage</strong>, a colourful scrolling banner, a clear <strong>“shop by collection” grid</strong>, and dedicated sections for the craft workshops and the physical shop. It looks like Tasha’s brand now instead of a default install, and points visitors straight at what they came for.',
    result: { pending: 'Results not collected yet — ask Tasha.' },
    testimonial: { pending: 'Testimonial not collected yet — ask Tasha.' },
    changelog: [
      { type: 'del', text: 'stock theme, zero personality' },
      { type: 'add', text: 'hand-cut hero collage' },
      { type: 'add', text: 'shop-by-collection grid' },
      { type: 'add', text: 'workshops section' },
      { type: 'add', text: 'store + map section' },
    ],
    compares: [{ label: 'Homepage', before: flfBefore, after: flfAfter, alt: 'Flavour Like Fancy homepage' }],
  },
  {
    slug: 'andys-airplants',
    number: '04',
    name: 'Andy’s Airplants',
    tagline: 'Plants — homepage redesign',
    scope: 'homepage redesign',
    status: 'in-progress',
    live: null,
    cardImage: null,
    swatch: 'plants',
    problem: 'A homepage redesign for an air-plant grower.',
    changed: 'This one’s still in build. The full story goes up once it’s live.',
    result: { pending: 'In progress — no results to report yet.' },
    testimonial: { pending: 'Testimonial not collected yet — the build comes first.' },
    changelog: [],
    compares: [],
  },
];

/** Narrows an uncollected result/testimonial so pages can render the chase note. */
export function isPending(value: string | Pending | Quote): value is Pending {
  return typeof value === 'object' && value !== null && 'pending' in value;
}
