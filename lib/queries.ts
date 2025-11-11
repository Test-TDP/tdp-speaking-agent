// lib/queries.ts

export function buildQueries(input: { topics: string[]; prioritizeHealthcare: boolean }) {
  const base = [
    'call for speakers',
    'keynote speakers',
    'speaker proposals',
    'submit a proposal',
    'leadership conference',
    'medical missions conference',
    'nonprofit leadership event',
    'corporate social responsibility conference',
    'global health summit',
    'faith based medical missions'
  ];

  const healthcare = [
    'medical conference',
    'healthcare leadership conference',
    'surgical society annual meeting',
    'MGMA conference',
    'HIMSS call for speakers',
    'ACHE congress call for proposals',
    'Texas healthcare association conference',
    'ambulatory surgery association meeting',
    'AORN chapter meeting'
  ];

  const topics = input.topics.length
    ? input.topics
    : [
        'volunteer medical missions',
        'surgical missions Peru',
        'global health',
        'nonprofit leadership',
        'mission medicine',
        'Texas healthcare',
        'medical student service',
        'servant leadership',
        'CSR healthcare'
      ];

  const seeds = input.prioritizeHealthcare ? base.concat(healthcare) : base;
  const combos: string[] = [];

  for (const s of seeds) {
    for (const t of topics) {
      combos.push(`${s} ${t}`);
    }
  }

  return combos;
}
