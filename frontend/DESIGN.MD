# ANVAYA — Style Reference
> a survey office rebuilt for AI — deep cartographic navy, hairline grid-lines, and a single cadastral-rust accent that marks exactly where a human needs to look

**Theme:** mixed

ANVAYA reads as an official cadastral instrument, not a consumer app: a cool paper-white canvas ruled with faint 1px grid-lines (a nod to the survey sheet), a dense monochrome navy scale carrying almost all UI weight, and one deliberate accent — Cadastral Rust — reserved entirely for AI-flagged uncertainty and parcel-boundary emphasis. IBM Plex Sans handles every UI surface with restrained, bureaucratic confidence, while IBM Plex Mono renders every coordinate, area figure, confidence score, and survey ID — the monospace grid is what makes the system feel like it's reporting real measurements rather than decorating a webpage. Components are close to rectangular (4px radius, never more) with hairline borders standing in for shadow; elevation is used sparingly and only to lift the map viewport itself above the page. Dashboard sections alternate between a light operations canvas and a near-black Survey Navy band reserved for map-heavy, data-dense views — the same light/dark rhythm a GIS desktop tool would use between its browser panel and its map canvas. Confidence is the organizing idea of the whole interface: three status colors (Verified Green, Review Amber, Conflict Rust) recur identically across map overlays, table rows, and badges so a surveyor can read the state of a parcel without reading a label.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Survey Navy | `#0f2438` | `--color-survey-navy` | Primary text, dark band backgrounds, filled buttons, nav bar, wordmark — the institutional anchor color |
| Deep Chart | `#16324a` | `--color-deep-chart` | Secondary dark surface, card fills on dark band, hover state for navy buttons |
| Slate Blue | `#3d5a70` | `--color-slate-blue` | Secondary headings, muted icon strokes, inactive nav items |
| Instrument Gray | `#5c6b74` | `--color-instrument-gray` | Body copy on light surfaces, table cell text, form labels |
| Fog | `#8fa0aa` | `--color-fog` | Placeholder text, disabled controls, helper captions |
| Hairline | `#d7dde0` | `--color-hairline` | All structural borders, table rules, card edges, map panel dividers |
| Grid Wash | `#eef1f3` | `--color-grid-wash` | Faint page grid lines, zebra-striped table rows, inactive tab background |
| Paper | `#f6f7f8` | `--color-paper` | Secondary surface, sidebar background, input fill |
| White | `#ffffff` | `--color-white` | Page canvas, card surfaces, map viewport chrome, text on dark |
| Cadastral Rust | `#c1531f` | `--color-cadastral-rust` | The single warm accent — AI-uncertain flags, parcel boundary emphasis, primary alert state, "review needed" badges |
| Rust Wash | `#fbe7dc` | `--color-rust-wash` | Light background fill behind rust badges and uncertain-detection map highlights |
| Verified Green | `#1f7a4d` | `--color-verified-green` | Confirmed/validated parcel status, success badges, "surveyor-approved" map fill |
| Review Amber | `#b9820a` | `--color-review-amber` | Medium-confidence AI detection, pending-review status, in-progress badges |
| Conflict Rust | `#a83c1c` | `--color-conflict-rust` | Boundary conflict or low-confidence detection, error state, critical alert text |
| Geo Blue | `#2f6fb0` | `--color-geo-blue` | Map basemap accents, drone-flight-path overlay, AI-detected-footprint stroke before validation |

## Tokens — Typography

### IBM Plex Sans — The sole UI and editorial typeface — navigation, headings, body copy, form labels, buttons, badges. Weight 400 for body, 500 for UI controls and labels, 600 reserved for headings and metric values. Deliberately unglamorous: a typeface built for government and infrastructure reporting, not marketing. · `--font-plex-sans`
- **Substitute:** Public Sans or Source Sans 3 as free alternatives — both share the same civic, document-native character
- **Weights:** 400, 500, 600
- **Sizes:** 12, 13, 14, 16, 18, 24, 32, 40, 56
- **Line height:** 1.15 / 1.25 / 1.35 / 1.45 / 1.5 / 1.6
- **OpenType features:** `"tnum"` for tabular figures in metric displays
- **Role:** The sole UI and editorial typeface — navigation, headings, body copy, form labels, buttons, badges. Weight 400 for body, 500 for UI controls and labels, 600 reserved for headings and metric values.

### IBM Plex Mono — Data and coordinate typeface — parcel IDs, lat/long pairs, area measurements, confidence scores, timestamps, survey reference codes. Its presence anywhere in the UI signals "this is a measured value," distinguishing hard data from editorial text. · `--font-plex-mono`
- **Substitute:** JetBrains Mono or Space Mono
- **Weights:** 400, 500
- **Sizes:** 12, 13, 14, 16
- **Line height:** 1.4
- **OpenType features:** `"tnum", "zero"` (slashed zero for unambiguous coordinate reading)
- **Role:** Data and coordinate typeface — parcel IDs, lat/long pairs, area measurements, confidence scores, timestamps, survey reference codes.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.4 | 0.02em | `--text-caption` |
| data-mono | 13px | 1.4 | — | `--text-data-mono` |
| body-sm | 13px | 1.5 | — | `--text-body-sm` |
| body | 14px | 1.5 | — | `--text-body` |
| subheading | 16px | 1.45 | — | `--text-subheading` |
| heading-sm | 18px | 1.35 | — | `--text-heading-sm` |
| heading | 24px | 1.3 | — | `--text-heading` |
| heading-lg | 32px | 1.25 | -0.2px | `--text-heading-lg` |
| display-sm | 40px | 1.2 | -0.4px | `--text-display-sm` |
| display | 56px | 1.15 | -0.6px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |

### Border Radius

| Element | Value |
|---------|-------|
| buttons | 4px |
| inputs | 4px |
| cards | 6px |
| badges | 3px |
| map-viewport | 8px |
| avatar/icon-circle | 9999px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| xs | `rgba(15, 36, 56, 0.06) 0px 1px 2px 0px` | `--shadow-xs` |
| sm | `rgba(15, 36, 56, 0.08) 0px 2px 6px 0px` | `--shadow-sm` |
| map-panel | `rgba(15, 36, 56, 0.10) 0px 4px 16px 0px, rgba(15, 36, 56, 0.06) 0px 1px 3px 0px` | `--shadow-map-panel` |

### Layout

- **Page max-width:** 1440px (dashboard), 1200px (marketing/reporting pages)
- **Section gap:** 64px
- **Card padding:** 16-20px
- **Element gap:** 8-12px
- **Sidebar width:** 264px

## Components

### Top Navigation
**Role:** Primary application/site navigation

White (#ffffff) background, 1px #d7dde0 bottom border, no shadow. Wordmark "ANVAYA" in Plex Sans 18px weight 600 #0f2438, with a small monospace tag ("cadastral intelligence") in Fog beside it. Center nav links Plex Sans 14px weight 500 #3d5a70, active item underlined in Cadastral Rust. Right side: a status pill showing current survey district and a filled Survey Navy button ("New Survey" / "Sign in").

### Filled Primary Button
**Role:** Main action trigger (Request access, Start validation, Export shapefile)

#0f2438 background, white text, Plex Sans 14px weight 500, 4px border-radius, 10px vertical / 20px horizontal padding, shadow-xs. Hover darkens to Deep Chart (#16324a). The only large solid-fill control in the light UI.

### Rust Alert Button
**Role:** Action tied to an uncertain or conflicting detection (Flag for review, Resolve conflict)

#c1531f background, white text, Plex Sans 14px weight 500, 4px radius, same padding as primary. Used exclusively where the action relates to AI uncertainty — never used as a generic secondary color.

### Ghost Outline Button
**Role:** Secondary or tertiary action (Cancel, View raw imagery)

Transparent background, 1px #d7dde0 border, #0f2438 text, Plex Sans 14px weight 500, 4px radius. On dark bands, border becomes 1px rgba(255,255,255,0.24) with white text.

### Confidence Badge
**Role:** Inline status marker on tables, map popups, and cards

3px radius pill-ish tag, 12px Plex Mono weight 500 uppercase, 2px/8px padding. Three fixed states: Verified (text #1f7a4d on #e7f4ec), Review (text #b9820a on #fbf0d9), Conflict (text #a83c1c on #fbe7dc). Color is never used for anything except these three states, keeping status legible at a glance.

### Coordinate / Metric Chip
**Role:** Displaying a measured value (area, lat/long, confidence %)

Plex Mono 13px weight 500 #0f2438 on a #f6f7f8 fill, 4px radius, 4px/8px padding, 1px #d7dde0 border. Tabular figures aligned; always paired with a small Plex Sans 12px #8fa0aa unit label.

### Map Viewport Panel
**Role:** The primary GIS/drone-imagery canvas

White surface, 8px radius, 1px #d7dde0 border, shadow-map-panel — the single most elevated object in the system, matching the "product preview" role in the visual hierarchy. Floating overlay controls (layer toggle, zoom, legend) sit inside as small white 4px-radius chips with 1px borders. AI-detected footprints render as Geo Blue strokes; validated parcels as Verified Green fills at 12% opacity; flagged parcels as Cadastral Rust dashed strokes.

### Detection Review Card
**Role:** Side-panel card for a single AI-flagged building/parcel awaiting human review

White background, 1px #d7dde0 border, 6px radius, 16px padding. Thumbnail crop of the drone tile at top (4px radius), then parcel ID in Plex Mono 13px, confidence badge top-right, a short AI-rationale line in Plex Sans 13px #5c6b74, and two actions (Approve / Reject) as small ghost buttons.

### Data Table Row
**Role:** Cadastral record listing (parcel registry, survey queue)

13px Plex Sans body with Plex Mono for ID/area/coordinate columns, 1px #d7dde0 row divider, zebra striping in #eef1f3 on alternate rows, 12px vertical padding. Status column always rendered as a Confidence Badge, never plain text.

### Dark Ops Band
**Role:** Full-bleed section for map-heavy or statistic-heavy content (district overview, processing pipeline stats)

#0f2438 or #16324a background, white text, headings in Plex Sans 32-40px weight 600. Large tabular-figure metrics (Plex Mono, 40-56px) with a Plex Sans 12px uppercase #8fa0aa label above. Faint 1px rgba(255,255,255,0.06) grid-line texture across the band, echoing a survey sheet.

### Pipeline Stepper
**Role:** Shows drone-to-validated-map processing stages (Ingest → Detect → Reconcile → Review → Publish)

Horizontal row of circular 32px nodes (9999px radius) connected by 1px hairline rules, Plex Sans 12px weight 500 label below each. Completed nodes fill Survey Navy, active node fills Cadastral Rust, upcoming nodes stay outlined in Hairline gray.

### Announcement / Advisory Bar
**Role:** System-wide notice (maintenance window, new imagery batch ingested)

Full-bleed Grid Wash (#eef1f3) background, 1px #d7dde0 bottom border, centered Plex Sans 13px #3d5a70 text with a monospace timestamp, no button — informational only, sits flush above the top navigation.

### Section Divider
**Role:** Transition between report sections

1px #d7dde0 line with a centered 13px Plex Sans uppercase #8fa0aa label ("Validation Queue", "District Summary") breaking the stroke, letter-spacing 0.04em.

## Do's and Don'ts

### Do
- Reserve Cadastral Rust (#c1531f) strictly for AI-uncertainty, conflicts, and boundary emphasis — never use it decoratively
- Set every coordinate, area, ID, and confidence score in IBM Plex Mono with tabular figures — mixed-width numerals are not permitted in data columns
- Keep radii at or below 8px everywhere except icon/avatar circles — the system reads as an instrument panel, not a consumer app
- Use the three-color confidence system (Green/Amber/Rust) identically across map, table, and badge contexts so state is recognizable without reading text
- Alternate light operations canvas and dark Survey Navy bands at the section level to separate "browsing" content from "map/data" content
- Border every white card with 1px #d7dde0 rather than relying on shadow — hairlines carry the structure
- Keep the Map Viewport Panel as the only strongly elevated object on any given screen

### Don't
- Never introduce a second accent color beyond Cadastral Rust and the three status colors — the palette must stay legible under color-blindness and grayscale printing
- Never use border-radius above 8px on cards or panels, or pill shapes on anything except badges and avatar circles
- Never set body or data text below 12px — cadastral figures must remain legible at a glance
- Never mix Plex Sans and Plex Mono within the same value (e.g. don't set a unit label in mono) — mono is reserved for the measured figure itself
- Never apply Verified Green, Review Amber, or Conflict Rust to anything that isn't a genuine validation status
- Never stack more than one elevated shadow per screen — competing elevation breaks the "instrument panel" hierarchy
- Never use photography or illustration in the product UI — imagery is limited to drone orthomosaic tiles and vector map overlays

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page Canvas | `#ffffff` | Default light-mode page background |
| 1 | Paper | `#f6f7f8` | Sidebar, input fill, secondary panel background |
| 2 | Grid Wash | `#eef1f3` | Zebra table rows, advisory bar, inactive tab fill |
| 3 | Hairline Edge | `#d7dde0` | Borders and dividers — the structural line between every surface |
| 4 | Rust Wash | `#fbe7dc` | Background behind uncertainty badges and flagged-parcel map highlights |
| 5 | Deep Chart | `#16324a` | Secondary dark surface within Survey Navy bands |
| 6 | Survey Navy | `#0f2438` | Primary dark band background, filled buttons, nav emphasis |

## Elevation

- **Map Viewport Panel:** `rgba(15, 36, 56, 0.10) 0px 4px 16px 0px, rgba(15, 36, 56, 0.06) 0px 1px 3px 0px`
- **Primary/Rust Buttons:** `rgba(15, 36, 56, 0.06) 0px 1px 2px 0px`
- **Floating Map Controls:** `rgba(15, 36, 56, 0.08) 0px 2px 6px 0px`

ANVAYA otherwise avoids shadow. Hierarchy comes from the light/dark band alternation, hairline borders, and the deliberate reservation of elevation for the map viewport — the one surface that functions as the literal "instrument" of the product.

## Imagery

Imagery is entirely functional and geospatial: high-resolution drone orthomosaic tiles, vector building-footprint overlays in Geo Blue, and validated-parcel fills in Verified Green at low opacity. Uncertain detections render as Cadastral Rust dashed outlines directly on the map, making the accent color double as a literal map annotation rather than pure UI decoration. Dark Ops bands carry a faint rgba(255,255,255,0.06) grid-line texture evoking a survey sheet or topographic graph. There is no photography of people, no stock imagery, and no decorative illustration — every visual element traces back to a real spatial dataset (imagery tile, boundary line, or chart).

## Layout

The page follows a 1440px max-width application shell: a fixed 264px left sidebar (Paper background, sections for Ingest / Detect / Review / Registry) beside a fluid main canvas. Dashboard views open with a light operations header (district name, pipeline stepper, key metrics as Coordinate Chips) followed by a two-column split — Map Viewport Panel on the left (roughly 60% width) and a stacked list of Detection Review Cards on the right. Marketing/reporting pages instead use a centered 1200px container alternating light content bands and full-bleed dark Ops Bands for statistics, separated by 64px vertical gaps. Tables (parcel registry, validation queue) run full-width within the main canvas with sticky headers. Navigation is a single top bar; the advisory bar, when present, sits flush above it.

## Agent Prompt Guide

**Quick Color Reference**
- text: #0f2438
- background: #ffffff (canvas) / #f6f7f8 (panels)
- border: #d7dde0
- accent: #c1531f (uncertainty/review only)
- status: #1f7a4d (verified) / #b9820a (review) / #a83c1c (conflict)
- primary action: #0f2438 (filled navy)

**Example Component Prompts**

1. **Map Viewport Panel**: White (#ffffff) surface, 8px radius, 1px #d7dde0 border, layered shadow (rgba(15,36,56,0.10) 0 4px 16px, rgba(15,36,56,0.06) 0 1px 3px). Drone orthomosaic base layer with Geo Blue (#2f6fb0) AI-detected footprint outlines, Verified Green (#1f7a4d) 12%-opacity fills for approved parcels, and Cadastral Rust (#c1531f) dashed outlines for flagged detections. Small white floating control chips (zoom, layers, legend) with 1px borders in the corners.

2. **Detection Review Card**: White background, 1px #d7dde0 border, 6px radius, 16px padding. 4px-radius thumbnail crop at top. Plex Mono 13px parcel ID and a Confidence Badge (Review Amber: #b9820a text on #fbf0d9) top-right. Plex Sans 13px #5c6b74 rationale line. Two ghost-outline buttons ("Approve", "Reject") at the bottom, 4px radius, 1px #d7dde0 border.

3. **Dark Ops Band with Metrics**: Full-bleed #0f2438 background. Centered Plex Sans 40px weight 600 white heading. Row of three metrics: Plex Sans 12px uppercase #8fa0aa label above a Plex Mono 56px tabular-figure white value (e.g. "142,318 ha mapped"). Faint 1px rgba(255,255,255,0.06) grid-line texture across the full band.

4. **Pipeline Stepper**: Horizontal row of five 32px circular nodes connected by 1px #d7dde0 rules. Completed nodes filled #0f2438 white icon; active node filled #c1531f; upcoming nodes outlined #d7dde0 on white. Plex Sans 12px weight 500 label centered below each node.

5. **Confidence Badge Set**: Three 3px-radius pill tags, Plex Mono 12px weight 500 uppercase: "VERIFIED" (#1f7a4d on #e7f4ec), "REVIEW" (#b9820a on #fbf0d9), "CONFLICT" (#a83c1c on #fbe7dc). 2px/8px padding, no border.

## Similar Products

- **Esri ArcGIS Online** — Same institutional-GIS posture: hairline-bordered panels, muted neutral chrome, and color reserved almost entirely for map data rather than UI
- **Bloomberg Terminal / Glassnode-style dashboards** — Shared near-rectangular component language, monospace data typography, and light/dark band alternation between browsing and data-dense views
- **Palantir Foundry** — Comparable "instrument panel" confidence, dense information hierarchy, and a single accent color reserved for flagged/exception states
- **US Digital Service / 18F design system** — Same civic-typeface restraint (Plex/Public Sans family), accessible contrast-first palette, and distrust of decorative color in official tooling
- **Mapbox Studio** — Similar map-viewport-as-hero layout, floating chip controls over the canvas, and a monochrome UI shell built to not compete with map color

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-survey-navy: #0f2438;
  --color-deep-chart: #16324a;
  --color-slate-blue: #3d5a70;
  --color-instrument-gray: #5c6b74;
  --color-fog: #8fa0aa;
  --color-hairline: #d7dde0;
  --color-grid-wash: #eef1f3;
  --color-paper: #f6f7f8;
  --color-white: #ffffff;
  --color-cadastral-rust: #c1531f;
  --color-rust-wash: #fbe7dc;
  --color-verified-green: #1f7a4d;
  --color-review-amber: #b9820a;
  --color-conflict-rust: #a83c1c;
  --color-geo-blue: #2f6fb0;

  /* Typography — Font Families */
  --font-plex-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-plex-mono: 'IBM Plex Mono', ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --tracking-caption: 0.02em;
  --text-data-mono: 13px;
  --leading-data-mono: 1.4;
  --text-body-sm: 13px;
  --leading-body-sm: 1.5;
  --text-body: 14px;
  --leading-body: 1.5;
  --text-subheading: 16px;
  --leading-subheading: 1.45;
  --text-heading-sm: 18px;
  --leading-heading-sm: 1.35;
  --text-heading: 24px;
  --leading-heading: 1.3;
  --text-heading-lg: 32px;
  --leading-heading-lg: 1.25;
  --tracking-heading-lg: -0.2px;
  --text-display-sm: 40px;
  --leading-display-sm: 1.2;
  --tracking-display-sm: -0.4px;
  --text-display: 56px;
  --leading-display: 1.15;
  --tracking-display: -0.6px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;

  /* Layout */
  --page-max-width: 1440px;
  --page-max-width-marketing: 1200px;
  --sidebar-width: 264px;
  --section-gap: 64px;
  --card-padding: 16px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-buttons: 4px;
  --radius-inputs: 4px;
  --radius-cards: 6px;
  --radius-badges: 3px;
  --radius-map-viewport: 8px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-xs: rgba(15, 36, 56, 0.06) 0px 1px 2px 0px;
  --shadow-sm: rgba(15, 36, 56, 0.08) 0px 2px 6px 0px;
  --shadow-map-panel: rgba(15, 36, 56, 0.10) 0px 4px 16px 0px, rgba(15, 36, 56, 0.06) 0px 1px 3px 0px;

  /* Surfaces */
  --surface-page-canvas: #ffffff;
  --surface-paper: #f6f7f8;
  --surface-grid-wash: #eef1f3;
  --surface-hairline-edge: #d7dde0;
  --surface-rust-wash: #fbe7dc;
  --surface-deep-chart: #16324a;
  --surface-survey-navy: #0f2438;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-survey-navy: #0f2438;
  --color-deep-chart: #16324a;
  --color-slate-blue: #3d5a70;
  --color-instrument-gray: #5c6b74;
  --color-fog: #8fa0aa;
  --color-hairline: #d7dde0;
  --color-grid-wash: #eef1f3;
  --color-paper: #f6f7f8;
  --color-white: #ffffff;
  --color-cadastral-rust: #c1531f;
  --color-rust-wash: #fbe7dc;
  --color-verified-green: #1f7a4d;
  --color-review-amber: #b9820a;
  --color-conflict-rust: #a83c1c;
  --color-geo-blue: #2f6fb0;

  /* Typography */
  --font-plex-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-plex-mono: 'IBM Plex Mono', ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --text-data-mono: 13px;
  --leading-data-mono: 1.4;
  --text-body-sm: 13px;
  --leading-body-sm: 1.5;
  --text-body: 14px;
  --leading-body: 1.5;
  --text-subheading: 16px;
  --leading-subheading: 1.45;
  --text-heading-sm: 18px;
  --leading-heading-sm: 1.35;
  --text-heading: 24px;
  --leading-heading: 1.3;
  --text-heading-lg: 32px;
  --leading-heading-lg: 1.25;
  --text-display-sm: 40px;
  --leading-display-sm: 1.2;
  --text-display: 56px;
  --leading-display: 1.15;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;

  /* Border Radius */
  --radius-buttons: 4px;
  --radius-inputs: 4px;
  --radius-cards: 6px;
  --radius-badges: 3px;
  --radius-map-viewport: 8px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-xs: rgba(15, 36, 56, 0.06) 0px 1px 2px 0px;
  --shadow-sm: rgba(15, 36, 56, 0.08) 0px 2px 6px 0px;
  --shadow-map-panel: rgba(15, 36, 56, 0.10) 0px 4px 16px 0px, rgba(15, 36, 56, 0.06) 0px 1px 3px 0px;
}
