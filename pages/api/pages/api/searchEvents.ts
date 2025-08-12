import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type SerpResult = { title?: string; link?: string; snippet?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = (req.query.q as string) || 'healthcare leadership conference Texas 2026';
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'Missing SERPAPI_API_KEY' });

    const r = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google', q, num: 20, api_key: apiKey }
    });

    const raw: SerpResult[] = r.data?.organic_results || [];
    const events = raw.filter(
      (it) =>
        it.title && it.link &&
        !it.link.includes('vercel.com') &&
        !it.link.includes('github.com') &&
        !it.title.toLowerCase().includes('documentation')
    );

    res.status(200).json({ ok: true, count: events.length, events });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
