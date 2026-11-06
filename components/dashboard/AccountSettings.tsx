export function AccountSettings({ user }: { user: any }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">Manage your personal information and preferences</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Account settings</h2>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-xl">
        <h3 className="text-sm font-bold">Identity Profile</h3>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#d9e6f4] text-lg font-bold text-[#174a85]">
            {user?.name?.slice(0, 2).toUpperCase() || 'JD'}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{user?.name || 'Jordan Davis'}</p>
            <p className="text-xs text-slate-500">{user?.email || 'jordan@acme.co'}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
