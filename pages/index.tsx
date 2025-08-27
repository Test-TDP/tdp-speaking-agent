import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import Papa from 'papaparse';

export default function Home() {
  const [topics, setTopics] = useState('leadership, humanitarian service, Peru healthcare');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [ph, setPh] = useState(true);
  const [ptx, setPtx] = useState(true);

  async function runSearch() {
    try {
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
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">TDP Speaking Agent</h1>
        <p className="text-gray-600 mb-6">Find conferences, associations, and call-for-speakers opportunities aligned to Texas de Peru&apos;s mission.</p>

        <div className="bg-white rounded-2xl shadow p-4 mb-6 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Topics &amp; keywords (comma-separated)</label>
            <input className="w-full mt-1 rounded-xl border p-2" value={topics} onChange={e=>setTopics(e.target.value)} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2"><input type="checkbox" checked={ph} onChange={e=>setPh(e.target.checked)} /> Healthcare boost</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ptx} onChange={e=>setPtx(e.target.checked)} /> Texas boost</label>
          </div>
          <div className="md:col-span-3 flex gap-3">
            <button onClick={runSearch} className="inline-flex items-center gap-2 bg-black text-white rounded-xl px-4 py-2 disabled:opacity-60" disabled={loading}>
              <Search size={18} /> {loading ? 'Searching…' : 'Search'}
            </button>
            <button onClick={downloadCSV} className="inline-flex items-center gap-2 border rounded-xl px-4 py-2"><Download size={18}/> Export CSV</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
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
                <tr key={i} className="border-t">
                  <td className="p-3 font-semibold">{r.score}</td>
                  <td className="p-3"><a className="text-blue-600" href={r.url} target="_blank" rel="noreferrer">{r.event_name}</a></td>
                  <td className="p-3">{r.organizer || ''}</td>
                  <td className="p-3">{[r.start_date, r.end_date].filter(Boolean).join(' – ')}</td>
                  <td className="p-3">{[r.city, r.state, r.country].filter(Boolean).join(', ')}</td>
                  <td className="p-3">{r.cfp_deadline || ''}</td>
                  <td className="p-3">{r.pays_speakers || ''}</td>
                  <td className="p-3">{(r.verticals||[]).join(', ')}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td className="p-6 text-gray-500" colSpan={8}>No results yet. Enter topics and click Search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
