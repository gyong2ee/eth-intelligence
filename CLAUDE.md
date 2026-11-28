# ETH Intelligence

Static site on Vercel (`index.html`, `derivatives.html`, `liquidity.html`) with serverless
routes in `api/`. Functions run in Seoul (`vercel.json` → `icn1`); Binance and Bybit block US
regions, so keep that setting.

## Rules for every chart

- **Every chart gets a mouse tracker.** Hovering shows a crosshair and a tooltip with the date
  and the value(s) under the pointer. Use the shared `window.ETHTrack.attach(svg, {...})` from
  `nav.js` (styles in `nav.css`) instead of writing a new tooltip.
- When a chart shows more than one series, the tooltip lists every series on its own row with a
  color dot matching its line, so the values are easy to tell apart.
- Do not overlay unrelated series on one chart. Put them in separate charts on the same time
  window, side by side in a row. Exception the user asked for: open interest and the coin's
  price share one chart (OI area on the right axis, price line on the left axis).
- Default range is **1Y** unless the chart is monthly macro data that needs a longer view.
- Charts with a full-period navigator: drag inside to move, drag an edge to resize, click
  outside to jump there, wheel to zoom. Redraw in place on wheel/drag (no rebuild, no animation).

## Look and feel

- Sharplink-style black theme, styled in `sharp.css` (linked last on every page, so it overrides
  page styles): a blue glow behind the top of the page fading into near-black `#05070c`, big light
  white headlines, uppercase kicker with a small blue square, dark glass square cards
  (`rgba(14,19,29,.78)`, hairline `rgba(255,255,255,.08)` borders), white chip labels on key
  figures, black sidebar. Accent `#0e76ff`. Square corners, no shadows. Selected buttons are white
  with black text. The whole site stays dark; no light sections.
- Fonts: Noto Sans KR for Korean text, Archivo for headings and numbers (including canvas/SVG
  chart labels).
- Base palette: bg `#05070c`, card `#0b0f17`, raised `#111723`, rules `#1c2330`/`#2a3344`,
  text `#eef1f6`, soft `#8d96a6`, dim `#687183`, accent `#3d8bff`.
- Colors per rate maturity: 3M violet `#9b8cff`, 2Y blue `#3d8bff`, 10Y green `#6fbfa8`,
  30Y blue `#5b8def`, EFFR white `#eef1f6`. Up/ease green `#6fbfa8`, down/tight `#e2735c`.
- TradingView widgets use `"theme":"dark"` with background `#0b0f17`.
- Write UI copy in Korean, plain and short. Mark modeled numbers as "추정".

## Mobile

- Mobile fixes must never change the desktop layout. Put them only inside
  `@media (max-width:760px)` blocks (end of `theme.css` / `nav.css`), and compare desktop
  before/after when changing them.
- On phones every TradingView chart is the ETH chart's height (520px); summary tiles are 2×2;
  fear & greed and MVRV share a row; the four staking APR cards share a row; 2Y and 10Y share a
  row with the overlay chart full width below; the back-to-top button is smaller and shows after
  scrolling; the top tabs use position:fixed (sticky fails in iOS Safari / in-app browsers).
- On phones the liquidity page's eight indicator cards are 2 across × 4 rows (rule in
  `liquidity.html`, which does not load `theme.css`).

## Navigation

- Fixed top bar on every page (`nav.js`, styled in `sharp.css`): ETH mark + "ETH Intelligence" on
  the left, square menu 시장 개요 · 파생상품 · 글로벌 유동성 on the right (current page has a blue square).
  Left list shows the current page's sections (desktop), below the bar; add sections to `SECTIONS`.
- Start page hero (`index.html` top, `hero.js` module): big title, a three.js ETH solid
  (satin-silver octahedron with a dashed inner frame + gunmetal chrome lower pyramid, no glass
  transmission) spinning on an axis tilted 20° (~5 s per turn, angle taken from the wall clock),
  over static upright (no tilt or diagonal warp) "+" contour tubes — each one the same rounded
  "+" scaled up (not distance offsets, which round out into circles), fading radially into the page shaded per pixel once into a 2D canvas (`.hero-waves`).
- Performance: no `backdrop-filter` anywhere (sharp.css disables it globally) and no animated
  background; both made the spinning logo stutter. (three.js from jsDelivr via an import map; SVG fallback without WebGL),
  and an Events carousel read from `data/events.json` (KST times; past events hide themselves).
- Fixed back-to-top button bottom right (also from `nav.js`).

## Data

- Prefer primary sources: FRED for US macro series, Treasury for TGA, DefiLlama for stablecoins/TVL/yields,
  Bybit/Binance public endpoints for derivatives. Show real values only, no estimates of
  delayed data (e.g. MVRV from Coin Metrics lags 1–2 days; that is expected).
- `CMC_API_KEY` is set for Production and Preview in Vercel.
