import type { NextApiRequest, NextApiResponse } from 'next';
import { buildQueries } from '../../lib/queries';
import { serpSearch } from '../../lib/serp';
import { scoreAndExtract } from '../../lib/llm';
import type { EventRecord } from '../../types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // NOTE: your earlier file was corrupted at "req.bo>".
  // This must be req.body, with sensible defaults:
  const {
    topics = [],
    prioritizeHealthcare = true,
    prioritizeTexas = true,
    maxResults = 8,
  } = (req.body || {}) as {
    topics?: string[];
    prioritizeHealthcare?: boolean;
    prioritizeTexas?: boolean;
    maxResults?: number;
  };

  try {
    const queries = buildQueries({ topics, prioritizeHealthcare });

    const seen = new Set<string>();
    const candidates: Array<{ title: string; snippet: string; link: string }> = [];

    // Cap initial queries for speed
    for (const q of queries.slice(0, 8)) {
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

    // Sort by score desc and return up to 50
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return res.status(200).json({ count: scored.length, results: scored.slice(0, 50) });
  } catch (e: any) {
    // Add server-side logging so we can see the real error in the terminal
    console.error('search-events error:', e);
    const message = e?.message || (typeof e === 'string' ? e : 'Unknown error');
    return res.status(500).json({ error: message });
  }
}
