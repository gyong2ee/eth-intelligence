// FRED access through the official API when FRED_API_KEY is set (Vercel env var).
// fred.stlouisfed.org (the website, including fredgraph.csv) does not answer requests from the
// Seoul region these functions run in, but api.stlouisfed.org does. fredFetch() is a drop-in for
// fetch(): a fredgraph.csv URL is answered from the API and returned as the same CSV
// ("observation_date,<ID>" then "date,value" rows, "." for missing values), so callers that
// parse the CSV need no changes. Any other URL, or no key, goes to plain fetch().
// Files starting with "_" in api/ are not deployed as routes.
const API = 'https://api.stlouisfed.org/fred/series/observations';

function fredKey() { return (process.env.FRED_API_KEY || '').trim(); }

async function fredFetch(url, opts = {}) {
  const key = fredKey();
  let u;
  try { u = new URL(url); } catch (e) { return fetch(url, opts); }
  if (!key || u.hostname !== 'fred.stlouisfed.org' || !u.pathname.endsWith('/fredgraph.csv')) return fetch(url, opts);
  const id = u.searchParams.get('id'), start = u.searchParams.get('cosd');
  const q = new URLSearchParams({ series_id: id, api_key: key, file_type: 'json' });
  if (start) q.set('observation_start', start);
  try {
    const r = await fetch(API + '?' + q, { signal: opts.signal || AbortSignal.timeout(15000) });
    if (!r.ok) throw Error('FRED API HTTP ' + r.status);
    const j = await r.json();
    const csv = ['observation_date,' + id].concat((j.observations || []).map(o => o.date + ',' + o.value)).join('\n');
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } });
  } catch (e) {
    // the website almost always times out from Seoul, so report the API failure instead of waiting on it
    return new Response('FRED API error: ' + e.message, { status: 502 });
  }
}

module.exports = { fredFetch, fredKey };
