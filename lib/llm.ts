// lib/llm.ts
import { z } from 'zod';
import OpenAI from 'openai';
import { healthcareTargets, texasCities } from './domains';

// Prefer OpenRouter if its key exists; otherwise OpenAI; else heuristics.
const HAS_OR = !!process.env.OPENROUTER_API_KEY;
const HAS_OAI = !!process.env.OPENAI_API_KEY;
const PROVIDER_ENV = (process.env.LLM_PROVIDER || '').toLowerCase();

const USE_OPENROUTER = HAS_OR || PROVIDER_ENV === 'openrouter';
const USE_OPENAI = !USE_OPENROUTER && (HAS_OAI || PROVIDER_ENV === 'openai');

// Choose model based on provider
const MODEL = USE_OPENROUTER
  ? (process.env.LLM_MODEL || 'deepseek/deepseek-r1:free')
  : 'gpt-4o-mini';

// Build client
const client = (() => {
 if ((process.env.LLM_PROVIDER || '').toLowerCase() === 'heuristic') return null;
  if (USE_OPENROUTER) {
    return new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'TDP Speaking Agent',
      },
    });
  }
  if (USE_OPENAI) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return null; // heuristic-only
})();

// One-time provider log for debugging
let logged = false;
function logOnce() {
  if (!logged) {
    console.log(`[llm] provider=${USE_OPENROUTER ? 'openrouter' : USE_OPENAI ? 'openai' : 'heuristic'} model=${MODEL}`);
    logged = true;
  }
}

const EventSchema = z.object({
  event_name: z.string().optional(),
  organizer: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  cfp_deadline: z.string().optional(),
  contact_url: z.string().optional(),
  pays_speakers: z.enum(['yes','no','unknown']).optional(),
  verticals: z.array(z.string()).default([]),
  score: z.number().min(0).max(100)
});

function domainOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./,'');
  } catch { return ''; }
}

function heuristicExtract(
  item: { title: string; snippet: string; link: string },
  opts: { prioritizeHealthcare: boolean; prioritizeTexas: boolean }
) {
  const title = (item.title || '').toLowerCase();
  const snip  = (item.snippet || '').toLowerCase();
  const text  = `${title} ${snip}`;
  const host  = domainOf(item.link);

  let score = 0;

  const positive = [
    'call for speakers','call for proposals','speaker proposals','submit a proposal',
    'keynote','keynote speakers','conference','annual meeting','summit','congress'
  ];
  for (const k of positive) if (text.includes(k)) score += 12;

  const themes = [
    'leadership','management','csr','social responsibility','sales','enablement',
    'healthcare','medical','surgery','surgical','nurses','anesthesiology','mgma','himss','ache','hfma'
  ];
  for (const k of themes) if (text.includes(k)) score += 6;

  if (opts.prioritizeHealthcare) {
    const isHealthcareDomain = healthcareTargets.some(d => host.endsWith(d));
    if (isHealthcareDomain) score += 25;
    if (text.includes('healthcare') || text.includes('medical') || text.includes('hospital')) score += 12;
  }

  if (opts.prioritizeTexas) {
    const hasTxCity = texasCities.some(c => text.includes(c.toLowerCase()));
    if (hasTxCity || text.includes(' texas ') || text.endsWith(' texas') || text.includes('(tx)')) score += 18;
  }

  score = Math.max(0, Math.min(100, score));

  const verticals: string[] = [];
  if (/health|medical|surg|nurs|anesth|mgma|himss|ache|hfma/.test(text)) verticals.push('Healthcare');
  if (/leader|management/.test(text)) verticals.push('Leadership');
  if (/csr|social responsibility/.test(text)) verticals.push('CSR');
  if (/sales|enablement/.test(text)) verticals.push('Sales');

  const organizer = host ? host.split('.').slice(-2, -1)[0]?.toUpperCase() : undefined;

  return {
    event_name: item.title,
    organizer,
    url: item.link,
    pays_speakers: 'unknown',
    verticals,
    score
  };
}

export async function scoreAndExtract(
  item: {title: string; snippet: string; link: string},
  opts: {prioritizeHealthcare: boolean; prioritizeTexas: boolean}
) {
  logOnce();

  // If no client, go heuristic-only
  if (!client) return heuristicExtract(item, opts);

  const sys = `You are a precise event extractor for a nonprofit speaker whose themes include: starting a nonprofit for surgical care overseas, leadership lessons from running an international medical nonprofit, humanitarian service, CSR, sales enablement through service, and adventure in Peruvian healthcare. Return STRICT JSON for each candidate: fields event_name, organizer, dates, city/state, cfp_deadline if present, contact_url if present, pays_speakers (yes/no/unknown), verticals (e.g., Healthcare, Leadership, CSR, Sales), and a 0-100 score reflecting fit. Strongly boost Healthcare, medical associations, and leadership/CSR. Extra boost if in Texas or major US cities.`;

  const user = {
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    prioritizeHealthcare: opts.prioritizeHealthcare,
    prioritizeTexas: opts.prioritizeTexas
  };

  // LLM call with timeout + rate-limit fallback to heuristics
  const llmTimeout = Number(process.env.LLM_TIMEOUT_MS || 15000);

  let completion: any;
  try {
    completion = await Promise.race([
      client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          { role: 'user',   content: JSON.stringify(user) }
        ]
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('LLM timeout')), llmTimeout))
    ]);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    const code = String((err && (err.code || err.status)) || '');
    if (msg.toLowerCase().includes('rate limit') || code.includes('429') || msg.includes('429')) {
      console.warn('[llm] rate-limited; using heuristic fallback');
    } else {
      console.error('[llm] error; using heuristic fallback:', msg);
    }
    return heuristicExtract(item, opts);
  }

  const raw = completion?.choices?.[0]?.message?.content?.trim() || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}$/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;

  let parsed: any;
  try { parsed = JSON.parse(jsonStr); } catch {
    return heuristicExtract(item, opts);
  }

  const safe = EventSchema.safeParse(parsed);
  if (!safe.success) return heuristicExtract(item, opts);
  return safe.data as any;
}
