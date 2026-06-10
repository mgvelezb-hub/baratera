'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Package, ShoppingCart, ClipboardList, Globe,
  MessageCircle, Users, BarChart3, LogOut, Menu, X, Clock,
  Building2, Receipt, Scissors, Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { cn } from '@/lib/utils'

// permiso: clave del catálogo (src/lib/permisos.ts) que habilita el módulo.
// devOnly: visible solo para el rol developer (no configurable por permisos).
const MODULES = [
  { id: 'inventario',      label: 'Inventario',      href: '/inventario',      icon: Package,      built: true,  permiso: 'inventario.ver',  devOnly: false },
  { id: 'venta',           label: 'Venta física',    href: '/venta',           icon: ShoppingCart, built: true,  permiso: 'venta.pos',       devOnly: false },
  { id: 'corte',           label: 'Corte de caja',   href: '/corte',           icon: Scissors,     built: true,  permiso: 'corte.ver',       devOnly: false },
  { id: 'proveedores',     label: 'Proveedores',     href: '/proveedores',     icon: Building2,    built: true,  permiso: 'proveedores.ver', devOnly: false },
  { id: 'costos',          label: 'Costos',          href: '/costos',          icon: Receipt,      built: true,  permiso: 'costos.ver',      devOnly: false },
  { id: 'dashboard',       label: 'Dashboard',       href: '/dashboard',       icon: BarChart3,    built: true,  permiso: 'dashboard.ver',   devOnly: false },
  { id: 'pedidos',         label: 'Pedidos',         href: '/pedidos',         icon: ClipboardList,built: false, permiso: 'dashboard.ver',   devOnly: false },
  { id: 'clientes',        label: 'Clientes',        href: '/clientes',        icon: Users,        built: false, permiso: 'dashboard.ver',   devOnly: false },
  { id: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: Settings,     built: true,  permiso: '',                devOnly: true  },
]

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname      = usePathname()
  const router        = useRouter()
  const { can, isDeveloper } = useIsAdmin()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {MODULES.filter(mod => {
          if (mod.devOnly) return isDeveloper
          return can(mod.permiso)
        }).map(mod => {
          const Icon     = mod.icon
          const isActive = pathname.startsWith(mod.href)

          if (!mod.built) {
            return (
              <div
                key={mod.id}
                className="flex items-center gap-3 h-10 px-3 rounded-xl text-slate-400 select-none"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm flex-1">{mod.label}</span>
                <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Pronto
                </span>
              </div>
            )
          }

          return (
            <Link
              key={mod.id}
              href={mod.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {mod.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  )
}

function LogoBlock() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
        <Package className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400 leading-none">Papelería</p>
        <p className="text-sm font-semibold text-slate-900 leading-tight">La Más Baratera</p>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [open,         setOpen]         = useState(false)
  const [desktopOpen,  setDesktopOpen]  = useState(true)

  useEffect(() => {
    if (localStorage.getItem('sidebar-desktop') === 'closed') setDesktopOpen(false)
  }, [])

  function toggleDesktop() {
    const next = !desktopOpen
    setDesktopOpen(next)
    localStorage.setItem('sidebar-desktop', next ? 'open' : 'closed')
  }

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      {desktopOpen ? (
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0">
          <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200">
            <LogoBlock />
            <button
              onClick={toggleDesktop}
              title="Ocultar menú"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
          <NavContent />
        </aside>
      ) : (
        <aside className="hidden lg:flex flex-col w-12 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0 items-center pt-3 gap-3">
          <button
            onClick={toggleDesktop}
            title="Mostrar menú"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-violet-50 text-slate-500 hover:text-violet-600 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </aside>
      )}

      {/* ── Mobile top bar ───────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 flex items-center justify-between h-14 px-4">
        <LogoBlock />
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile drawer ────────────────────────────────────── */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="lg:hidden fixed right-0 top-0 bottom-0 z-50 w-72 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200">
              <LogoBlock />
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <NavContent onClose={() => setOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}
