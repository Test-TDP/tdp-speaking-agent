// pages/index.tsx
import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import Papa from 'papaparse';

export default function Home() {
  const [topics, setTopics] = useState('leadership, medical missions, Peru healthcare');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [ph, setPh] = useState(true);
  const [ptx, setPtx] = useState(true);

  async function runSearch() {
    setLoading(true);
    setRows([]);
    const resp = await fetch('/api/search-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: topics.split(',').map(s => s.trim()).filter(Boolean),
        prioritizeHealthcare: ph,
        prioritizeTexas: ptx,
        maxResults: 10
      })
    });
    const data = await resp.json();
    setRows(data.results || []);
    setLoading(false);
  }

  function downloadCSV() {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tdp_events.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Texas de Peru Speaking Agent</h1>
          <p className="text-slate-600 max-w-2xl">
            Search for conferences, associations, and healthcare events where Texas de Peru’s mission would fit.
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-800">
              Topics & keywords (comma-separated)
            </label>
            <input
              className="w-full mt-2 rounded-xl border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 border px-3 py-2 bg-slate-50"
              value={topics}
              onChange={e => setTopics(e.target.value)}
              placeholder="leadership, surgical missions, nonprofit..."
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={ph} onChange={e => setPh(e.target.checked)} />
              Healthcare / medical boost
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={ptx} onChange={e => setPtx(e.target.checked)} />
              Texas / regional boost
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={runSearch}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              <Search size={18} />
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="p-3">Score</th>
                <th className="p-3">Event</th>
                <th className="p-3">Organizer</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Location</th>
                <th className="p-3">CFP Deadline</th>
                <th className="p-3">Pays</th>
                <th className="p-3">Verticals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="p-3 font-semibold text-slate-900">{r.score}</td>
                  <td className="p-3">
                    <a className="text-slate-900 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                      {r.event_name}
                    </a>
                  </td>
                  <td className="p-3 text-slate-700">{r.organizer || ''}</td>
                  <td className="p-3 text-slate-700">
                    {[r.start_date, r.end_date].filter(Boolean).join(' – ')}
                  </td>
                  <td className="p-3 text-slate-700">
                    {[r.city, r.state, r.country].filter(Boolean).join(', ')}
                  </td>
                  <td className="p-3 text-slate-700">{r.cfp_deadline || ''}</td>
                  <td className="p-3 text-slate-700">{r.pays_speakers || ''}</td>
                  <td className="p-3 text-slate-700">{(r.verticals || []).join(', ')}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="p-6 text-slate-400 text-center" colSpan={8}>
                    No results yet. Enter topics and click Search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
