export function buildQueries(input: {topics: string[], prioritizeHealthcare: boolean}) {
  const base = [
    'call for speakers', 'keynote speakers', 'speaker proposals', 'submit a proposal',
    'leadership conference', 'sales enablement conference', 'sales training conference',
    'corporate social responsibility conference', 'management training conference',
    'business relationship management conference'
  ];

  const healthcare = [
    'medical conference', 'healthcare leadership conference', 'surgical society annual meeting',
    'MGMA conference', 'HIMSS call for speakers', 'ACHE congress call for proposals'
  ];

  const topics = input.topics.length ? input.topics : [
    'nonprofit leadership', 'humanitarian service', 'global health', 'mission medicine',
    'Peru healthcare', 'volunteer medical missions', 'servant leadership'
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
