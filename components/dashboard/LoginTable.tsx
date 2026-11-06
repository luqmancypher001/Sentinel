import { Laptop2 } from 'lucide-react'
import { Badge, StatusDot } from './shared'

export function LoginTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Recent login activity</h3>
          <p className="mt-1 text-xs text-slate-500">Live telemetry recorded in SQLite via Prisma</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Device</th>
              <th className="px-5 py-3 font-semibold">Location</th>
              <th className="px-5 py-3 font-semibold">Date & time</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No login events recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id || row.time} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                        <Laptop2 size={15} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{row.device}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{row.browser}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {row.location}
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.ip}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">{row.time}</td>
                  <td className="px-5 py-4">
                    <Badge tone={row.status === 'Success' ? 'success' : row.status === 'Blocked' ? 'danger' : 'warning'}>
                      <StatusDot tone={row.status === 'Success' ? 'green' : 'red'} />
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`font-semibold ${
                        row.risk === 'High' ? 'text-red-600' : row.risk === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {row.riskScore ? `${row.riskScore}/100 (${row.risk})` : row.risk}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
