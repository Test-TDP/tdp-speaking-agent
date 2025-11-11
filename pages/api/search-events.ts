// pages/api/search-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildQueries } from '../../lib/queries';
import { serpSearch } from '../../lib/serp';
import { scoreAndExtract } from '../../lib/llm';
import type { EventRecord } from '../../types';

const TEXAS_STRINGS = [
  'texas',
  'tx',
  'dallas',
  'fort worth',
  'dfw',
  'austin',
  'houston',
  'san antonio',
  'plano',
  'arlington',
  'irving',
  'round rock'
];

// helper to decide if an event is in the future
function isFutureEvent(ev: EventRecord): boolean {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dateStr = ev.start_date || ev.end_date;
  if (!dateStr) {
    // if we don't know the date, keep it — organizer pages sometimes don't expose dates
    return true;
  }
  // simple string compare works for ISO date format
  return dateStr >= today;
}

// boost score if event looks Texas-based
function applyTexasBoost(list: EventRecord[]) {
  for (const ev of list) {
    const loc = `${ev.city || ''} ${ev.state || ''} ${ev.country || ''}`.toLowerCase();
    const hit = TEXAS_STRINGS.some(t => loc.includes(t));
    if (hit) {
      ev.score = (ev.score || 0) + 15;
    }
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
    // NOTE: we now pass prioritizeTexas into buildQueries so the toggle actually does something
    const queries = buildQueries({ topics, prioritizeHealthcare, prioritizeTexas });
    const seen = new Set<string>();
    const candidates: any[] = [];

    // call SerpAPI for a handful of queries
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

    // run LLM extraction / scoring
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
        score: ext.score ?? 0
      };
      scored.push(record);
    }

    // filter out past events (only when we got a date)
    const futureOnly = scored.filter(isFutureEvent);

    // apply Texas boost if user selected it
    if (prioritizeTexas) {
      applyTexasBoost(futureOnly);
    }

    // sort by score
    futureOnly.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    res.status(200).json({ count: futureOnly.length, results: futureOnly.slice(0, 50) });
  } catch (e: any) {
    console.error('search-events error:', e);
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
