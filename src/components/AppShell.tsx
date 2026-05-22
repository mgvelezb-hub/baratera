import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 lg:overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
