import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, CheckCircle2, ChevronRight, LockKeyhole, LogIn, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import { Badge, MetricCard, StatusDot } from './shared'
import { LoginTable } from './LoginTable'

export function Overview({ setView, stats, user, onRefresh }: { setView: (v: string) => void; stats: any; user: any; onRefresh: () => void }) {
  const chartData = stats?.chart || []

  const metrics = stats?.metrics || {
    totalAttempts: 0,
    successfulLogins: 0,
    failedAttempts: 0,
    suspiciousActivity: 0,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}.
          </h2>
        </div>
        <button
          onClick={() => setView('MFA & Security')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#102b4e] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#173b65]"
        >
          <ShieldCheck size={15} /> Review security settings
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total login attempts" value={metrics.totalAttempts} delta="+12.4%" icon={LogIn} />
        <MetricCard label="Successful logins" value={metrics.successfulLogins} delta="+8.2%" icon={CheckCircle2} tone="green" />
        <MetricCard label="Failed attempts" value={metrics.failedAttempts} delta="-18.6%" icon={LockKeyhole} />
        <MetricCard label="Suspicious activity" value={metrics.suspiciousActivity} delta="+2 this week" icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Login activity</h3>
              <p className="mt-1 text-xs text-slate-500">Live authentication attempts tracked by Sentinel Anomaly Engine</p>
            </div>
            <select className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 24 hours</option>
            </select>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="successFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf1f5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="successful" stroke="#3478d2" strokeWidth={2} fill="url(#successFill)" />
                <Area type="monotone" dataKey="failed" stroke="#e59a20" strokeWidth={2} fill="url(#failedFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-blue-500" />
              Successful logins
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-amber-500" />
              Failed / Blocked attempts
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Security status</h3>
              <p className="mt-1 text-xs text-slate-500">Heuristic Anomaly Model evaluation</p>
            </div>
            <Badge tone="success">
              <StatusDot /> Secure
            </Badge>
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex size-11 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Protected with TOTP & Anomaly Shield</p>
              <p className="mt-1 text-xs text-emerald-700">Haversine impossible travel detection active</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {[
              ['MFA protection (TOTP)', user?.totpEnabled !== false ? 'Enabled' : 'Disabled', '100%'],
              ['GeoIP Impossible Travel', 'Active (850 km/h limit)', '100%'],
              ['Rate Limiter Protection', 'Active (15/min IP limit)', '90%'],
              ['Password encryption', 'bcrypt (12-round)', '100%'],
            ].map(([a, b, c]) => (
              <div key={a}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{a}</span>
                  <span className="font-semibold text-slate-800">{b}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: c }} />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setView('MFA & Security')}
            className="mt-6 flex w-full items-center justify-center gap-1 border-t border-slate-100 pt-4 text-xs font-semibold text-[#1c5b9e] hover:text-[#102b4e]"
          >
            Manage security settings <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <LoginTable rows={stats?.logins?.slice(0, 4) || []} />
        <AlertsPreview alerts={stats?.alerts?.slice(0, 3) || []} setView={setView} />
      </div>
    </div>
  )
}

function AlertsPreview({ alerts, setView }: { alerts: any[]; setView: (v: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Security alerts</h3>
          <p className="mt-1 text-xs text-slate-500">Events prioritized by Anomaly Engine</p>
        </div>
        <button onClick={() => setView('Security Alerts')} className="text-xs font-semibold text-[#1c5b9e]">
          View all
        </button>
      </div>
      <div className="flex flex-col divide-y divide-slate-100">
        {alerts.length === 0 ? (
          <p className="p-5 text-center text-xs text-slate-400">No active alerts</p>
        ) : (
          alerts.map((a: any) => (
            <div key={a.id || a.title} className="flex gap-3 p-4">
              <div
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${
                  a.level === 'High' ? 'bg-red-50 text-red-600' : a.level === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <ShieldAlert size={15} />
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">{a.title}</p>
                  <span className="whitespace-nowrap text-[10px] text-slate-400">{a.time}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{a.detail}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
