// lib/llm.ts
import OpenAI from 'openai';
import { z } from 'zod';

const client = (() => {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (provider === 'heuristic') return null;

  const useOpenRouter = provider === 'openrouter';
  if (useOpenRouter) {
    return new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1'
    });
  }

  // default: OpenAI
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
})();

const MODEL =
  (process.env.LLM_PROVIDER || '').toLowerCase() === 'openrouter'
    ? (process.env.LLM_MODEL || 'deepseek/deepseek-r1:free')
    : 'gpt-4o-mini';

const EventSchema = z.object({
  event_name: z.string().optional(),
  organizer: z.string().optional(),
  start_date: z.string().optional(), // YYYY-MM-DD
  end_date: z.string().optional(),   // YYYY-MM-DD
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  cfp_deadline: z.string().optional(),
  contact_url: z.string().optional(),
  pays_speakers: z.enum(['yes','no','unknown']).optional(),
  verticals: z.array(z.string()).default([]),
  score: z.number().min(0).max(100),
  is_future: z.boolean().optional() // new: LLM marks upcoming vs past
});

type Item = { title: string; snippet: string; link: string };

export async function scoreAndExtract(
  item: Item,
  opts: { prioritizeHealthcare: boolean; prioritizeTexas: boolean }
) {
  // Heuristic fallback (no API or rate-limited)
  if (!client) {
    return {
      event_name: item.title,
      organizer: undefined,
      start_date: undefined,
      end_date: undefined,
      city: undefined,
      state: undefined,
      country: undefined,
      cfp_deadline: undefined,
      contact_url: undefined,
      pays_speakers: 'unknown',
      verticals: [],
      score: guessScore(item, opts),
      is_future: true
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  const sys = [
    'You are a precise event extractor for a nonprofit speaker about medical missions in Peru, leadership, CSR, and healthcare.',
    'Return STRICT JSON with fields:',
    'event_name, organizer, start_date, end_date, city, state, country, cfp_deadline, contact_url, pays_speakers (yes/no/unknown), verticals (array), score (0-100), is_future (boolean).',
    `If dates are present, output them as YYYY-MM-DD. Compute is_future by comparing to TODAY=${today}.`,
    'If the page is a recap/past edition, set is_future=false unless it clearly points to the upcoming edition with dates.',
    'Boost score for Healthcare, medical associations, leadership/CSR; extra boost for Texas (Dallas, DFW, Houston, Austin, San Antonio, Fort Worth).'
  ].join(' ');

  const user = {
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    prioritizeHealthcare: opts.prioritizeHealthcare,
    prioritizeTexas: opts.prioritizeTexas
  };

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(user) }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { score: 0, verticals: [], pays_speakers: 'unknown', is_future: true };
    }
    const safe = EventSchema.safeParse(parsed);
    if (!safe.success) return { ...parsed, score: 0, is_future: true } as any;
    return safe.data as any;
  } catch (e: any) {
    console.error('[llm] error; using heuristic fallback:', e?.message || e);
    return {
      event_name: item.title,
      organizer: undefined,
      start_date: undefined,
      end_date: undefined,
      city: undefined,
      state: undefined,
      country: undefined,
      cfp_deadline: undefined,
      contact_url: undefined,
      pays_speakers: 'unknown',
      verticals: [],
      score: guessScore(item, opts),
      is_future: true
    };
  }
}

// very small heuristic: title/snippet hints → score bumps
function guessScore(item: Item, opts: { prioritizeHealthcare: boolean; prioritizeTexas: boolean }) {
  let s = 40;
  const t = (item.title + ' ' + item.snippet).toLowerCase();
  if (opts.prioritizeHealthcare && /(health|medical|surg|clinic|hospital|mgma|asca|aorn|ache)/.test(t)) s += 20;
  if (/texas|dallas|dfw|houston|austin|san antonio|fort worth|tx\b/.test(t)) s += 15;
  if (/call for speakers|submit a proposal|keynote/.test(t)) s += 10;
  return Math.max(0, Math.min(100, s));
}

