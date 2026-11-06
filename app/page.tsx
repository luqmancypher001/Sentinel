'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Bell, ChevronRight, Fingerprint, LayoutDashboard, LogOut, Menu,
  Monitor, PlaneTakeoff, RefreshCw, Settings2, Shield, ShieldAlert, X,
} from 'lucide-react'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Overview } from '@/components/dashboard/Overview'
import { ActivityPage } from '@/components/dashboard/ActivityPage'
import { AlertsPage } from '@/components/dashboard/AlertsPage'
import { DevicesPage } from '@/components/dashboard/DevicesPage'
import { SecuritySettings } from '@/components/dashboard/SecuritySettings'
import { AccountSettings } from '@/components/dashboard/AccountSettings'

const NAV = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Login Activity', icon: Activity },
  { name: 'Security Alerts', icon: ShieldAlert },
  { name: 'Trusted Devices', icon: Monitor },
  { name: 'MFA & Security', icon: Fingerprint },
  { name: 'Account Settings', icon: Settings2 },
]

const SIMULATED_LOCATIONS = [
  { id: 'london', label: '🇬🇧 London (Baseline)' },
  { id: 'lagos', label: '🇳🇬 Lagos (Impossible Travel)' },
  { id: 'manchester', label: '🇬🇧 Manchester' },
  { id: 'newyork', label: '🇺🇸 New York' },
  { id: 'tokyo', label: '🇯🇵 Tokyo' },
]

export default function Page() {
  const [view, setView] = useState('Overview')
  const [auth, setAuth] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string; name?: string; totpEnabled?: boolean } | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [query, setQuery] = useState('')
  const [simulatedLocation, setSimulatedLocation] = useState('london')
  const [stats, setStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Check existing session on initial load
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user)
          setAuth(true)
        }
      })
      .catch(() => {})
  }, [])

  // Load dashboard telemetry stats
  const fetchDashboardStats = () => {
    if (!auth) return
    setLoadingStats(true)
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics) setStats(data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingStats(false))
  }

  useEffect(() => {
    fetchDashboardStats()
  }, [auth])

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuth(false)
    setUser(null)
  }

  const loginsList = stats?.logins || []
  const filteredLogins = useMemo(
    () => loginsList.filter((x: any) => Object.values(x).join(' ').toLowerCase().includes(query.toLowerCase())),
    [loginsList, query]
  )

  if (!auth) {
    return (
      <AuthScreen
        simulatedLocation={simulatedLocation}
        setSimulatedLocation={setSimulatedLocation}
        onAuthenticated={(userData: any) => {
          setUser(userData)
          setAuth(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {/* Simulation Defense Bar in Dashboard Header */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/95 px-5 py-2 text-xs backdrop-blur lg:px-9">
        <div className="flex items-center gap-2 text-indigo-950 font-semibold">
          <PlaneTakeoff size={15} className="text-indigo-600" />
          <span>FYP Demo Simulator:</span>
          <span className="font-normal text-indigo-700">Active Location for next login:</span>
        </div>
        <div className="flex items-center gap-2">
          {SIMULATED_LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSimulatedLocation(loc.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                simulatedLocation === loc.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-indigo-100/70 border border-indigo-200'
              }`}
            >
              {loc.label}
            </button>
          ))}
          <button
            onClick={fetchDashboardStats}
            title="Refresh Live Telemetry"
            className="flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={12} className={loadingStats ? 'animate-spin' : ''} />
            Sync
          </button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-[#fbfcfe] transition-transform lg:translate-x-0 ${
          mobileNav ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#102b4e] text-white">
            <Shield size={19} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-950">Sentinel</p>
            <p className="text-[10px] font-medium uppercase tracking-[.18em] text-slate-400">Account security</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 px-3 py-5">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  setView(name)
                  setMobileNav(false)
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${
                  view === name ? 'bg-[#eaf1fb] text-[#174a85]' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={17} />
                {name}
                {name === 'Security Alerts' && stats?.alerts?.filter((a: any) => !a.isResolved).length > 0 && (
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700">
                    {stats.alerts.filter((a: any) => !a.isResolved).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#d9e6f4] text-xs font-bold text-[#174a85]">
              {user?.name?.slice(0, 2).toUpperCase() || 'JD'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{user?.name || 'Jordan Davis'}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email || 'jordan@acme.co'}</p>
            </div>
            <button onClick={handleSignOut} title="Sign out" aria-label="Sign out">
              <LogOut size={15} className="text-slate-400 hover:text-red-600 transition" />
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="fixed inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation overlay" />}

      <main className="lg:pl-64">
        <header className="sticky top-10 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-[#f7f9fc]/95 px-5 backdrop-blur lg:px-9">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Workspace</span>
                <ChevronRight size={12} />
                <span className="text-slate-600">{view}</span>
              </div>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-slate-950">{view}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
              <Activity size={15} /> {loadingStats ? 'Refreshing...' : 'Synced just now'}
            </div>
            <button className="relative text-slate-500" aria-label="Notifications" onClick={() => setView('Security Alerts')}>
              <Bell size={19} />
              {stats?.alerts?.some((a: any) => !a.isResolved) && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500 ring-2 ring-[#f7f9fc]" />
              )}
            </button>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-[#d9e6f4] text-xs font-bold text-[#174a85]">
                {user?.name?.slice(0, 2).toUpperCase() || 'JD'}
              </div>
              <span className="hidden text-xs font-medium text-slate-700 md:inline">{user?.name || 'Jordan Davis'}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 lg:p-9">
          {view === 'Overview' && <Overview setView={setView} stats={stats} user={user} onRefresh={fetchDashboardStats} />}
          {view === 'Login Activity' && <ActivityPage query={query} setQuery={setQuery} rows={filteredLogins} onRefresh={fetchDashboardStats} />}
          {view === 'Security Alerts' && <AlertsPage alerts={stats?.alerts || []} onRefresh={fetchDashboardStats} />}
          {view === 'Trusted Devices' && <DevicesPage devices={stats?.devices || []} onRefresh={fetchDashboardStats} />}
          {view === 'MFA & Security' && <SecuritySettings user={user} onRefresh={fetchDashboardStats} />}
          {view === 'Account Settings' && <AccountSettings user={user} />}
        </div>
      </main>
    </div>
  )
}
