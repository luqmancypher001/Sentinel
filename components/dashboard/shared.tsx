import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'blue'
}) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'blue',
}: {
  label: string
  value: string | number
  delta: string
  icon: LucideIcon
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div
          className={`flex size-9 items-center justify-center rounded-lg ${
            tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-700'
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs">
        <span className={delta.startsWith('-') ? 'text-emerald-600' : 'text-slate-600'}>
          {delta.startsWith('-') ? <ArrowDownRight size={13} className="inline" /> : <ArrowUpRight size={13} className="inline" />} {delta}
        </span>
        <span className="text-slate-400">vs. last 7 days</span>
      </div>
    </div>
  )
}

export function StatusDot({ tone = 'green' }: { tone?: 'green' | 'amber' | 'red' }) {
  return <span className={`size-2 rounded-full ${tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
}
