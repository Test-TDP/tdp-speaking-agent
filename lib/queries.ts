// lib/queries.ts

// Build search phrases for the speaking agent.
// We combine generic event phrases with user topics, and optionally add healthcare/Texas.
export function buildQueries(input: {
  topics: string[];
  prioritizeHealthcare: boolean;
  prioritizeTexas?: boolean;
}) {
  // generic event phrases
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

  // healthcare / medical associations
  const healthcare = [
    'medical conference',
    'healthcare leadership conference',
    'surgical society annual meeting',
    'MGMA conference',
    'HIMSS call for speakers',
    'ACHE congress call for proposals',
    'ambulatory surgery association meeting',
    'AORN chapter meeting'
  ];

  // if user didn't give topics, fall back to Kevin-style topics
  const topics = input.topics.length
    ? [...input.topics]
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

  // if Texas boost is on, mix in Texas/local variants
  if (input.prioritizeTexas) {
    const texasTopics = [
      'Texas',
      'Dallas',
      'DFW',
      'Houston',
      'Austin',
      'San Antonio',
      'Fort Worth',
      'Texas medical association'
    ];
    for (const t of texasTopics) {
      if (!topics.includes(t)) {
        topics.push(t);
      }
    }
  }

  // decide which seed phrases to use
  const seeds = input.prioritizeHealthcare ? base.concat(healthcare) : base;

  const combos: string[] = [];

  for (const s of seeds) {
    for (const t of topics) {
      combos.push(`${s} ${t}`);
    }
  }

  return combos;
}
