import { useState } from 'react'
import { Check, ShieldAlert } from 'lucide-react'
import { Badge } from './shared'

export function AlertsPage({ alerts, onRefresh }: { alerts: any[]; onRefresh: () => void }) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const toggleResolve = async (alertId: string, currentStatus: boolean) => {
    setResolvingId(alertId)
    await fetch('/api/dashboard/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, isResolved: !currentStatus }),
    })
    setResolvingId(null)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">Review and respond to account security events</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Security alerts</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-sm font-bold">Alert inbox</h3>
            <p className="mt-1 text-xs text-slate-500">Live alerts created by the Anomaly Detection Engine</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {alerts.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">No security alerts triggered.</p>
          ) : (
            alerts.map((a: any) => (
              <div key={a.id} className={`flex flex-col gap-4 p-5 md:flex-row md:items-center ${a.isResolved ? 'opacity-50' : ''}`}>
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    a.level === 'High' ? 'bg-red-50 text-red-600' : a.level === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <ShieldAlert size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{a.title}</h4>
                    <Badge tone={a.level === 'High' ? 'danger' : a.level === 'Medium' ? 'warning' : 'blue'}>{a.level}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.detail}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Detected {a.time} · Risk score {a.riskScore}/100
                  </p>
                </div>
                <button
                  disabled={resolvingId === a.id}
                  onClick={() => toggleResolve(a.id, a.isResolved)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                    a.isResolved ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {a.isResolved ? (
                    <>
                      <Check size={14} className="mr-1 inline" />
                      Resolved
                    </>
                  ) : (
                    'Mark resolved'
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
