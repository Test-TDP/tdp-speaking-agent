// pages/api/search-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildQueries } from '../../lib/queries';
import { serpSearch } from '../../lib/serp';
import { scoreAndExtract } from '../../lib/llm';
import type { EventRecord } from '../../types';

const TEXAS_STRINGS = [
  'texas','tx','dallas','fort worth','dfw','austin','houston','san antonio','plano','arlington','irving','round rock'
];

function isFutureByISO(iso?: string) {
  if (!iso) return true;
  const today = new Date().toISOString().slice(0, 10);
  return iso >= today;
}

// very rough detector for obviously past pages (recaps, /2023/, “2024 Conference Recap” etc.)
function obviousPastFromText(title: string, snippet: string, url: string) {
  const t = (title + ' ' + snippet + ' ' + url).toLowerCase();
  if (/recap|highlights|past event|previous event|what happened/.test(t)) return true;
  if (/(?:\/|-)2020[0-9](?:\/|-)/.test(t)) {
    const yearMatch = t.match(/(?:\/|-)(20[0-9]{2})(?:\/|-)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    const thisYear = new Date().getFullYear();
    if (year && year < thisYear) return true;
  }
  // explicit old years in title body
  if (/\b2020|2021|2022|2023|2024\b/.test(t)) {
    const yearMatch = t.match(/20[0-9]{2}/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;
    const thisYear = new Date().getFullYear();
    if (year && year < thisYear) return true;
  }
  return false;
}

function applyTexasBoost(list: EventRecord[]) {
  for (const ev of list) {
    const loc = `${ev.city || ''} ${ev.state || ''} ${ev.country || ''}`.toLowerCase();
    const hit = TEXAS_STRINGS.some(t => loc.includes(t));
    if (hit) ev.score = (ev.score || 0) + 15;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    topics = [],
    prioritizeHealthcare = true,
    prioritizeTexas = true,
    maxResults = 8
  } = req.body || {};

  try {
    const queries = buildQueries({ topics, prioritizeHealthcare, prioritizeTexas });
    const seen = new Set<string>();
    const candidates: any[] = [];

    for (const q of queries.slice(0, 8)) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await serpSearch(q, maxResults);
      for (const r of rows) {
        if (seen.has(r.link)) continue;
        seen.add(r.link);
        // pre-drop obvious past/recap pages quickly to save LLM calls
        if (obviousPastFromText(r.title, r.snippet, r.link)) continue;
        candidates.push(r);
      }
    }

    const enriched: EventRecord[] = [];

    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ext: any = await scoreAndExtract(c, { prioritizeHealthcare, prioritizeTexas });
      // hard gate with dates / is_future when present
      const hasDates = Boolean(ext.start_date || ext.end_date || ext.cfp_deadline);
      if (hasDates) {
        const future =
          (ext.is_future === true)
          || isFutureByISO(ext.start_date)
          || isFutureByISO(ext.end_date)
          || isFutureByISO(ext.cfp_deadline);
        if (!future) continue; // drop past
      }

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
        score: ext.score ?? 0
      };
      enriched.push(record);
    }

    if (prioritizeTexas) applyTexasBoost(enriched);
    enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    res.status(200).json({ count: enriched.length, results: enriched.slice(0, 50) });
  } catch (e: any) {
    console.error('search-events error:', e);
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
