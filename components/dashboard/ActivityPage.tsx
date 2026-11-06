import { Download, Search } from 'lucide-react'
import { LoginTable } from './LoginTable'

export function ActivityPage({ query, setQuery, rows, onRefresh }: { query: string; setQuery: (v: string) => void; rows: any[]; onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-500">A complete record of account access attempts</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Login activity</h2>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/dashboard/export"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download size={13} /> Export CSV
          </a>
          <button onClick={onRefresh} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Sync logs
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold">All login events</h3>
            <p className="mt-1 text-xs text-slate-500">Real-time risk scores & geolocation audit</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activity..."
                className="h-9 w-52 rounded-md border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>
        <LoginTable rows={rows} />
      </div>
    </div>
  )
}
