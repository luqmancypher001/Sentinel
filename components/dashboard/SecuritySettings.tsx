import { useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Badge } from './shared'

export function SecuritySettings({ user, onRefresh }: { user: any; onRefresh: () => void }) {
  const [totpData, setTotpData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadTotpQr = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa-setup')
      const data = await res.json()
      if (data.secret) {
        setTotpData(data)
      }
    } catch {
      setError('Failed to load TOTP setup')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmTotp = async () => {
    if (!totpData || !verifyCode) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: totpData.secret, code: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to verify code')
      } else {
        setSuccess('MFA enabled successfully! Please save your recovery codes.')
        setRecoveryCodes(data.recoveryCodes || [])
        onRefresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">Configure how Sentinel protects your account</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">MFA & security settings</h2>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold">Multi-factor authentication (TOTP RFC 6238)</h3>
                <p className="mt-1 text-xs text-slate-500">Compatible with Google Authenticator, Authy, or Microsoft Authenticator.</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 size={16} />
              <span>
                <b>MFA is active.</b> Real-time TOTP verification protects every login attempt.
              </span>
            </div>

            {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
            {success && <p className="mt-3 text-xs font-semibold text-emerald-600">{success}</p>}

            {!totpData ? (
              <button
                onClick={loadTotpQr}
                disabled={loading}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#102b4e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#173b65]"
              >
                {loading ? 'Generating QR...' : 'Configure New Authenticator App'}
              </button>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-[140px_1fr] sm:items-center">
                <div className="flex size-32 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                  <img src={totpData.qrCodeDataUrl} alt="TOTP QR Code" className="size-full" />
                </div>
                <div>
                  <p className="text-xs font-semibold">1. Scan QR code in Authenticator App</p>
                  <p className="mt-1 text-xs font-mono text-slate-500">Secret key: {totpData.secret}</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="000000"
                      className="h-9 w-28 rounded-md border border-slate-200 px-3 text-center text-sm font-bold tracking-widest outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleConfirmTotp}
                      disabled={loading}
                      className="rounded-md bg-[#102b4e] px-3 py-2 text-xs font-semibold text-white"
                    >
                      {loading ? 'Verifying...' : 'Confirm Code'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {recoveryCodes.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-900">Emergency Backup Recovery Codes</p>
                <p className="mt-1 text-[11px] text-amber-800">
                  Save these one-time codes in a safe place. Each code can be used once if you lose your phone:
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs font-bold text-slate-800">
                  {recoveryCodes.map((code) => (
                    <span key={code} className="rounded bg-white p-1.5 border border-amber-200 text-center">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold">Password security</h3>
            <p className="mt-1 text-xs text-slate-500">Passwords hashed with bcrypt (cost factor 12) + per-user salt.</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
              <ShieldCheck size={16} /> OWASP compliant password storage active
            </div>
          </section>
        </div>

        <section className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold">Heuristic Anomaly Engine Policies</h3>
          <div className="mt-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Impossible Travel Rule</p>
                <p className="mt-1 text-[11px] text-slate-500">Block velocity &gt; 850 km/h</p>
              </div>
              <Badge tone="danger">Active (+60 pts)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Unfamiliar Device Rule</p>
                <p className="mt-1 text-[11px] text-slate-500">Challenge new hardware hash</p>
              </div>
              <Badge tone="warning">Active (+25 pts)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Brute-Force Rate Limiting</p>
                <p className="mt-1 text-[11px] text-slate-500">Lock out after 5 failures / 15m</p>
              </div>
              <Badge tone="success">Active</Badge>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
