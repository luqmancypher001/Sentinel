import { useState } from 'react'
import { Laptop2, ShieldCheck } from 'lucide-react'
import { Badge, StatusDot } from './shared'

export function DevicesPage({ devices, onRefresh }: { devices: any[]; onRefresh: () => void }) {
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this trusted device?')) return
    setRemovingId(deviceId)
    await fetch('/api/dashboard/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    })
    setRemovingId(null)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">Manage hardware fingerprints permitted to authenticate</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Trusted devices</h2>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
        <div className="flex gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Hardware Fingerprint Verification Active</p>
            <p className="mt-1 text-xs text-blue-800">
              Logins from unrecognized fingerprints automatically accrue +25 risk points.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {devices.map((dev: any) => (
          <div
            key={dev.id}
            className={`rounded-xl border bg-white p-5 ${dev.isCurrent ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Laptop2 size={21} />
              </div>
              {dev.isCurrent && (
                <Badge tone="success">
                  <StatusDot /> Current
                </Badge>
              )}
            </div>
            <h3 className="mt-5 text-sm font-bold">{dev.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{dev.detail}</p>
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Location</span>
                <span className="text-slate-700">{dev.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last active</span>
                <span className="text-slate-700">{dev.last}</span>
              </div>
            </div>
            {!dev.isCurrent && (
              <button
                disabled={removingId === dev.id}
                onClick={() => handleRemove(dev.id)}
                className="mt-5 w-full rounded-md border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 transition"
              >
                {removingId === dev.id ? 'Removing...' : 'Remove device'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
