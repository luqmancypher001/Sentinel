'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, PlaneTakeoff, Shield, ShieldCheck } from 'lucide-react'

type Mode = 'signin' | 'register' | 'mfa' | 'forgot' | 'reset' | 'register-success'

const SIMULATED_LOCATIONS = [
  { id: 'london', label: '🇬🇧 London (Baseline)' },
  { id: 'lagos', label: '🇳🇬 Lagos (Impossible Travel)' },
  { id: 'manchester', label: '🇬🇧 Manchester' },
  { id: 'newyork', label: '🇺🇸 New York' },
  { id: 'tokyo', label: '🇯🇵 Tokyo' },
]

export function AuthScreen({
  simulatedLocation,
  setSimulatedLocation,
  onAuthenticated,
}: {
  simulatedLocation: string
  setSimulatedLocation: (loc: string) => void
  onAuthenticated: (user: any) => void
}) {
  const [mode, setMode] = useState<Mode>('signin')
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('jordan@acme.co')
  const [password, setPassword] = useState('Password123!')
  const [name, setName] = useState('Jordan Davis')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
  const [recoveryCode, setRecoveryCode] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [riskBanner, setRiskBanner] = useState<{ score: number; level: string; summary: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredTotp, setRegisteredTotp] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [registeredRecovery, setRegisteredRecovery] = useState<string[]>([])
  const [pendingUser, setPendingUser] = useState<any>(null)
  const [resetToken, setResetToken] = useState('')

  // A password-reset email link lands here as `/?resetToken=...` — drop into
  // the "set a new password" form instead of the normal sign-in screen.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('resetToken')
    if (token) {
      setResetToken(token)
      setPassword('')
      setConfirmPassword('')
      setMode('reset')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const handleSignIn = async () => {
    setError('')
    setRiskBanner(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          simulateLocation: simulatedLocation,
        }),
      })

      const data = await res.json()

      if (res.status === 403 && data.status === 'blocked') {
        // High Risk / Impossible Travel Blocked!
        setError(data.error)
        setRiskBanner({
          score: data.riskScore,
          level: data.riskLevel,
          summary: data.factors?.map((f: any) => f.label).join(' & ') || 'Impossible travel velocity detected',
        })
        return
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      if (data.status === 'mfa_required') {
        setTempToken(data.tempToken)
        setMode('mfa')
        if (data.riskScore > 0) {
          setRiskBanner({
            score: data.riskScore,
            level: data.riskLevel,
            summary: data.factors?.map((f: any) => f.label).join(', ') || 'Risk challenge',
          })
        }
        return
      }

      if (data.status === 'success') {
        onAuthenticated(data.user)
      }
    } catch (err: any) {
      setError('Network error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          simulateLocation: simulatedLocation,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }
      setRegisteredTotp(data.totp)
      setRegisteredRecovery(data.recoveryCodes || [])
      setPendingUser(data.user)
      setMode('register-success')
    } catch {
      setError('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyMfa = async () => {
    setError('')
    const code = mfaCode.join('')
    if (code.length < 6) {
      setError('Please enter the full 6-digit verification code')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code, isRecoveryCode: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid code')
        return
      }
      onAuthenticated(data.user)
    } catch {
      setError('Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyRecoveryCode = async () => {
    setError('')
    const cleaned = recoveryCode.trim().toUpperCase()
    if (cleaned.length < 9) {
      setError('Please enter your 8-character recovery code (e.g. A1B2-C3D4)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: cleaned, isRecoveryCode: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid recovery code')
        return
      }
      onAuthenticated(data.user)
    } catch {
      setError('Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send reset link')
        return
      }
      setNotice(data.message)
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError('')
    setNotice('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }
      setPassword('')
      setConfirmPassword('')
      setMode('signin')
      setNotice('Password updated. Please sign in with your new password.')
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Trigger rapid brute-force test for FYP demo
  const handleSimulateBruteForce = async () => {
    setError('Simulating 5 rapid brute-force attempts on ' + email + '...')
    for (let i = 1; i <= 5; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword' + i, simulateLocation: 'london' }),
      })
    }
    setError('5 failed attempts completed! Next login will test account lockout.')
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f9fc]">
      {/* Simulation Defense Bar */}
      <div className="z-50 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200 bg-indigo-50 px-5 py-2.5 text-xs text-indigo-950 shadow-sm">
        <div className="flex items-center gap-2">
          <PlaneTakeoff size={16} className="text-indigo-600" />
          <span className="font-bold">Final Year Project Demo Simulator:</span>
          <span className="text-indigo-700">Simulate login origin:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SIMULATED_LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              onClick={() => {
                setSimulatedLocation(loc.id)
                setError('')
                setRiskBanner(null)
              }}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                simulatedLocation === loc.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              {loc.label}
            </button>
          ))}
          <button
            onClick={handleSimulateBruteForce}
            className="rounded-md border border-red-200 bg-red-100 px-3 py-1 font-semibold text-red-700 hover:bg-red-200 transition"
          >
            ⚡ Simulate Brute-Force
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        <section className="hidden w-[44%] flex-col justify-between bg-[#102b4e] p-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
              <Shield size={19} />
            </div>
            <span className="font-bold">Sentinel</span>
          </div>
          <div className="max-w-md">
            <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck size={29} />
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Security you can see.
              <br />
              Intelligence you can prove.
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-blue-100">
              Combines bcrypt hashed passwords, RFC 6238 TOTP two-factor, rate limiting, and real-time Anomaly Detection with Haversine impossible travel calculation.
            </p>
            <div className="mt-8 flex flex-col gap-3 text-xs text-blue-100">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} /> bcrypt Password Hashing
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} /> Real TOTP RFC 6238 (Google Authenticator)
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} /> Haversine Impossible Travel Velocity Guard
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} /> Persistent Rate Limiting & Lockout
              </span>
            </div>
          </div>
          <p className="text-xs text-blue-200">Final Year Project Defense Edition</p>
        </section>

        <section className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#102b4e] text-white">
                  <Shield size={19} />
                </div>
                <span className="font-bold">Sentinel</span>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                {mode === 'register'
                  ? 'Create your account'
                  : mode === 'register-success'
                  ? 'Set up your authenticator'
                  : mode === 'mfa'
                  ? 'Two-Factor Verification'
                  : mode === 'forgot'
                  ? 'Reset password'
                  : mode === 'reset'
                  ? 'Choose a new password'
                  : 'Sign in to Sentinel'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {mode === 'register'
                  ? 'Start protecting your account with multi-factor authentication.'
                  : mode === 'register-success'
                  ? 'MFA is already protecting your account — scan this now or you may not be able to sign back in.'
                  : mode === 'mfa'
                  ? 'Enter the 6-digit code from Google Authenticator or your recovery code.'
                  : mode === 'forgot'
                  ? "Enter your account email and we'll send a reset link."
                  : mode === 'reset'
                  ? 'Set a new password for your account.'
                  : 'Demo account credentials are pre-filled below.'}
              </p>
            </div>

            {/* Live Anomaly Detection Banner */}
            {riskBanner && (
              <div
                className={`mb-5 rounded-lg border p-3.5 text-xs ${
                  riskBanner.level === 'High' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle size={16} className={riskBanner.level === 'High' ? 'text-red-600' : 'text-amber-600'} />
                  <span>
                    Anomaly Engine: {riskBanner.level} Risk ({riskBanner.score}/100)
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">{riskBanner.summary}</p>
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            {notice && !error && (
              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                {notice}
              </div>
            )}

            {mode === 'register-success' ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex size-28 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
                    {registeredTotp && (
                      <img src={registeredTotp.qrCodeDataUrl} alt="TOTP QR Code" className="size-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">1. Scan with Google Authenticator, Authy, etc.</p>
                    <p className="mt-1 break-all text-xs font-mono text-slate-500">
                      Secret key: {registeredTotp?.secret}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-900">2. Save your emergency recovery codes</p>
                  <p className="mt-1 text-[11px] text-amber-800">
                    Each code works once if you ever lose access to your authenticator app. They won't be shown again.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs font-bold text-slate-800">
                    {registeredRecovery.map((code) => (
                      <span key={code} className="rounded bg-white p-1.5 border border-amber-200 text-center">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onAuthenticated(pendingUser)}
                  className="mt-6 h-11 w-full rounded-lg bg-[#102b4e] text-sm font-semibold text-white hover:bg-[#173b65] transition"
                >
                  I've saved these — continue to dashboard
                </button>
              </>
            ) : mode === 'mfa' ? (
              <>
                <div className="flex justify-center gap-2">
                  {mfaCode.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value
                        const nextCode = [...mfaCode]
                        nextCode[i] = val
                        setMfaCode(nextCode)
                        if (val && i < 5) {
                          document.getElementById(`otp-${i + 1}`)?.focus()
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !mfaCode[i] && i > 0) {
                          document.getElementById(`otp-${i - 1}`)?.focus()
                        }
                      }}
                      className="size-11 rounded-md border border-slate-200 text-center text-lg font-bold outline-none focus:border-blue-500"
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerifyMfa}
                  disabled={loading}
                  className="mt-6 h-11 w-full rounded-lg bg-[#102b4e] text-sm font-semibold text-white hover:bg-[#173b65] transition"
                >
                  {loading ? 'Verifying...' : 'Verify and continue'}
                </button>

                <div className="mt-5 border-t border-slate-100 pt-5 flex flex-col gap-2">
                  <p className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    No authenticator app? Use a recovery code
                  </p>
                  <input
                    placeholder="e.g. A1B2-C3D4"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    maxLength={9}
                    className="h-10 rounded-md border border-slate-200 px-3 text-center text-sm font-mono uppercase outline-none focus:border-blue-500 tracking-widest"
                  />
                  <button
                    onClick={handleVerifyRecoveryCode}
                    disabled={loading || recoveryCode.trim().length < 9}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : 'Use recovery code'}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setMode('signin')
                    setRiskBanner(null)
                    setError('')
                  }}
                  className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  ← Back to sign in
                </button>
              </>
            ) : mode === 'forgot' ? (
              <>
                <label className="text-xs font-semibold">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@acme.co"
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                  />
                </label>
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="mt-6 h-11 w-full rounded-lg bg-[#102b4e] text-sm font-semibold text-white hover:bg-[#173b65] transition"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
                <button
                  onClick={() => {
                    setMode('signin')
                    setError('')
                    setNotice('')
                  }}
                  className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  ← Back to sign in
                </button>
              </>
            ) : mode === 'reset' ? (
              <>
                <div className="flex flex-col gap-4">
                  <label className="text-xs font-semibold">
                    New password
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Confirm new password
                    <input
                      type={show ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>
                </div>
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="mt-6 h-11 w-full rounded-lg bg-[#102b4e] text-sm font-semibold text-white hover:bg-[#173b65] transition"
                >
                  {loading ? 'Saving...' : 'Update password'}
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  {mode === 'register' && (
                    <label className="text-xs font-semibold">
                      Full name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Davis"
                        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                      />
                    </label>
                  )}

                  <label className="text-xs font-semibold">
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jordan@acme.co"
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="text-xs font-semibold">
                    Password
                    <div className="relative mt-2">
                      <input
                        type={show ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm font-normal outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3 top-3 text-slate-400"
                        aria-label="Toggle password visibility"
                      >
                        <Eye size={17} />
                      </button>
                    </div>
                  </label>

                  {mode === 'register' && (
                    <label className="text-xs font-semibold">
                      Confirm password
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500"
                      />
                    </label>
                  )}
                </div>

                {mode === 'signin' && (
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-500">
                      <input type="checkbox" defaultChecked className="accent-[#102b4e]" /> Remember me
                    </label>
                    <button
                      onClick={() => {
                        setMode('forgot')
                        setError('')
                        setNotice('')
                      }}
                      className="font-semibold text-[#1c5b9e]"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  onClick={mode === 'signin' ? handleSignIn : handleRegister}
                  disabled={loading}
                  className="mt-6 h-11 w-full rounded-lg bg-[#102b4e] text-sm font-semibold text-white hover:bg-[#173b65] transition"
                >
                  {loading ? 'Processing...' : mode === 'register' ? 'Create account' : 'Sign in'}
                </button>

                <p className="mt-6 text-center text-xs text-slate-500">
                  {mode === 'register' ? 'Already have an account?' : 'Don’t have an account?'}{' '}
                  <button
                    onClick={() => {
                      setMode(mode === 'register' ? 'signin' : 'register')
                      setError('')
                      setRiskBanner(null)
                    }}
                    className="font-semibold text-[#1c5b9e]"
                  >
                    {mode === 'register' ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
