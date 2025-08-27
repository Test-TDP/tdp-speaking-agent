// pages/api/search-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildQueries } from '../../lib/queries';
import { serpSearch } from '../../lib/serp';
import { scoreAndExtract } from '../../lib/llm';
import type { EventRecord } from '../../types';

// Optional tuning via env (keeps prod responsive)
const MAX_QUERIES = Number(process.env.MAX_QUERIES || 2);
const DEFAULT_MAX_RESULTS = Number(process.env.MAX_CANDIDATES || 8);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    topics = [],
    prioritizeHealthcare = true,
    prioritizeTexas = true,
    maxResults = DEFAULT_MAX_RESULTS,
  } = (req.body || {}) as {
    topics?: string[];
    prioritizeHealthcare?: boolean;
    prioritizeTexas?: boolean;
    maxResults?: number;
  };

  // ===== DIAGNOSTIC LOGS (visible in Vercel deployment logs) =====
  // NOTE: This is the line you asked to "modify" — I’m keeping it readable and adding more context.
  console.log(
    '[api/search-events] provider=%s model=%s serpKey=%s topics=%d maxResults=%d',
    (process.env.LLM_PROVIDER || 'heuristic'),
    (process.env.LLM_MODEL || ''),
    process.env.SERPAPI_API_KEY ? 'SET' : 'MISSING',
    Array.isArray(topics) ? topics.length : 0,
    maxResults
  );

  if (!process.env.SERPAPI_API_KEY) {
    // Fail fast if SerpAPI key missing in this environment
    return res.status(500).json({
      error: 'SERPAPI_API_KEY is missing in this environment (check Vercel → Settings → Environment Variables).',
    });
  }

  try {
    const queries = buildQueries({ topics, prioritizeHealthcare });

    const seen = new Set<string>();
    const candidates: { title: string; snippet: string; link: string }[] = [];

    // Cap how many different search queries we execute to keep it fast
    for (const q of queries.slice(0, Math.max(1, MAX_QUERIES))) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await serpSearch(q, maxResults);
      for (const r of rows) {
        if (seen.has(r.link)) continue;
        seen.add(r.link);
        candidates.push(r);
      }
    }

    const scored: EventRecord[] = [];
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ext: any = await scoreAndExtract(c, { prioritizeHealthcare, prioritizeTexas });
      const record: EventRecord = {
        event_name: ext.event_name || c.title,
        organizer: ext.organizer,
        start_date: ext.start_date,
        end_date: ext.end_date,
        city: ext.city,
        state: ext.state,
        country: ext.country,
        cfp_deadline: ext.cfp_deadline,
        url: c.link,
        contact_url: ext.contact_url,
        pays_speakers: ext.pays_speakers || 'unknown',
        verticals: ext.verticals || [],
        source: 'serp',
        score: typeof ext.score === 'number' ? ext.score : 0,
      };
      scored.push(record);
    }

    // sort by score desc
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Extra diagnostic to see what we actually found
    console.log('[api/search-events] candidates=%d results=%d', candidates.length, scored.length);

    return res.status(200).json({ count: scored.length, results: scored.slice(0, 50) });
  } catch (e: any) {
    console.error('search-events error:', e);
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
