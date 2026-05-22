'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Package, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/inventario', label: 'Inventario' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/inventario" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 hidden sm:block">Baratera OS</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'h-8 px-3 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(link.href)
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
