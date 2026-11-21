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

- Minimal, dark navy (`#0a1220`), rounded cards, faint ETH logo in the background.
- Fonts: Noto Sans KR for text, Inter for numbers (including canvas/SVG chart labels).
- Colors per rate maturity: 3M violet `#9b8cff`, 2Y gold `#c9a45c`, 10Y green `#6fbfa8`,
  30Y blue `#5b8def`, EFFR off-white `#ece6d6`. Up/ease green `#6fbfa8`, down/tight `#e2735c`.
- Write UI copy in Korean, plain and short. Mark modeled numbers as "추정".

## Mobile

- Mobile fixes must never change the desktop layout. Put them only inside
  `@media (max-width:760px)` blocks (end of `theme.css` / `nav.css`), and compare desktop
  before/after when changing them.
- On phones every TradingView chart is the ETH chart's height (520px); summary tiles are 2×2;
  fear & greed and MVRV share a row; the four staking APR cards share a row; 2Y and 10Y share a
  row with the overlay chart full width below; the back-to-top button is smaller and shows after
  scrolling; the top tabs use position:fixed (sticky fails in iOS Safari / in-app browsers).
- On phones the derivatives page's option and long/short cards are 2 across.
- On phones the liquidity page's eight indicator cards are 2 across × 4 rows (rule in
  `liquidity.html`, which does not load `theme.css`).

## Navigation

- Top tabs (sticky): 시장 개요 · 파생상품 · 글로벌 유동성. Left list shows the current page's
  sections (desktop). Both come from `nav.js`; add new sections to `SECTIONS` there.
- Fixed back-to-top button bottom right (also from `nav.js`).

## Data

- Prefer primary sources: FRED for US macro series, Treasury for TGA, DefiLlama for stablecoins/TVL/yields,
  Bybit/Binance public endpoints for derivatives. Show real values only, no estimates of
  delayed data (e.g. MVRV from Coin Metrics lags 1–2 days; that is expected).
- `CMC_API_KEY` is set for Production and Preview in Vercel.
