// lib/serp.ts
const TBS_RECENCY = 'qdr:y'; // limit to results indexed in the last year

export async function serpSearch(q: string, num = 10) {
  const apiKey = process.env.SERPAPI_API_KEY || '';
  const params = new URLSearchParams({
    engine: 'google',
    q,
    num: String(num),
    api_key: apiKey,
    hl: 'en',
    gl: 'us',
    tbs: TBS_RECENCY
  });
  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('SerpAPI error: ' + res.status);
  const data = await res.json();
  const results = (data.organic_results || []).map((r: any) => ({
    title: r.title as string,
    snippet: r.snippet as string,
    link: r.link as string,
    source: 'serp'
  }));
  return results;
}
