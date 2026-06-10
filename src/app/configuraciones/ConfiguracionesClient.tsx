'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Database, Monitor, RefreshCw,
  Trash2, AlertTriangle, CheckCircle2, Loader2, Shield,
  Activity, Server,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface UserInfo {
  id:             string
  email:          string
  role:           string | null
  lastSignIn:     string | null
  createdAt:      string
  emailConfirmed: boolean
}

interface Stats {
  tables:    Record<string, number>
  userCount: number
  env:       string
  url:       string
}

type Tab = 'usuarios' | 'datos' | 'sistema'

// ── Constants ──────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string }> = {
  developer: { label: 'Developer', color: 'bg-violet-100 text-violet-700' },
  admin:     { label: 'Admin',     color: 'bg-blue-100 text-blue-700'     },
  encargado: { label: 'Encargado', color: 'bg-amber-100 text-amber-700'   },
  cajero:    { label: 'Cajero',    color: 'bg-slate-100 text-slate-600'   },
}

const RESET_MODULES = [
  { key: 'ventas',      label: 'Ventas',           desc: 'Elimina todas las ventas y sus items.',               danger: false, icon: '🛒' },
  { key: 'cortes',      label: 'Cortes de caja',   desc: 'Elimina todos los cortes registrados.',               danger: false, icon: '✂️' },
  { key: 'adeudos',     label: 'Adeudos',          desc: 'Elimina adeudos y todos los pagos a proveedores.',    danger: false, icon: '💳' },
  { key: 'costos',      label: 'Costos fijos',     desc: 'Elimina todos los costos fijos configurados.',        danger: false, icon: '📊' },
  { key: 'ledger',      label: 'Historial stock',  desc: 'Elimina el historial de movimientos de inventario.',  danger: true,  icon: '📋' },
  { key: 'productos',   label: 'Productos',        desc: 'Elimina productos, colores y todo el historial.',     danger: true,  icon: '📦' },
  { key: 'proveedores', label: 'Proveedores',      desc: 'Elimina proveedores, adeudos y pagos.',               danger: true,  icon: '🏭' },
  { key: 'todo',        label: 'Reset total',      desc: 'Borra TODOS los datos de la app. Sin vuelta atrás.',  danger: true,  icon: '💣' },
]

const TABLE_LABELS: Record<string, string> = {
  productos:       'Productos',
  producto_colores:'Colores',
  stock_ledger:    'Movimientos',
  ventas:          'Ventas',
  venta_items:     'Items vendidos',
  cortes_caja:     'Cortes',
  proveedores:     'Proveedores',
  adeudos:         'Adeudos',
  pagos_proveedor: 'Pagos prov.',
  costos_fijos:    'Costos fijos',
}

// ── Main component ──────────────────────────────────────────────
export default function ConfiguracionesClient() {
  const [tab,           setTab]           = useState<Tab>('usuarios')
  const [users,         setUsers]         = useState<UserInfo[]>([])
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [loadingUsers,  setLoadingUsers]  = useState(true)
  const [loadingStats,  setLoadingStats]  = useState(false)
  const [roleLoading,   setRoleLoading]   = useState<string | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const [simRole,       setSimRole]       = useState('')

  const [resetModal,    setResetModal]    = useState<{ key: string; label: string } | null>(null)
  const [resetInput,    setResetInput]    = useState('')
  const [resetLoading,  setResetLoading]  = useState(false)
  const [resetResult,   setResetResult]   = useState<Record<string, string> | null>(null)

  // ── Bootstrap ──────────────────────────────────────────────────
  useEffect(() => {
    setSimRole(localStorage.getItem('devSimRole') ?? '')
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Fetch users ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    const res = await fetch('/api/dev/users')
    if (res.ok) setUsers((await res.json()).users)
    setLoadingUsers(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Fetch stats ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    const res = await fetch('/api/dev/stats')
    if (res.ok) setStats(await res.json())
    setLoadingStats(false)
  }, [])

  useEffect(() => { if (tab === 'sistema') fetchStats() }, [tab, fetchStats])

  // ── Change role ───────────────────────────────────────────────
  async function changeRole(userId: string, role: string | null) {
    setRoleLoading(userId)
    const res = await fetch('/api/dev/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, role: role || null }),
    })
    if (res.ok) {
      showToast('Rol actualizado', true)
      await fetchUsers()
    } else {
      showToast((await res.json()).error ?? 'Error al actualizar', false)
    }
    setRoleLoading(null)
  }

  // ── Reset module ──────────────────────────────────────────────
  async function confirmReset() {
    if (!resetModal) return
    setResetLoading(true)
    setResetResult(null)
    const res = await fetch('/api/dev/reset', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ module: resetModal.key }),
    })
    const data = await res.json()
    if (res.ok) {
      setResetResult(data.results)
      showToast(`${resetModal.label} eliminado`, true)
    } else {
      showToast(data.error ?? 'Error al resetear', false)
    }
    setResetLoading(false)
    setResetInput('')
    if (res.ok) setTimeout(() => setResetModal(null), 2000)
  }

  // ── Simulate role ─────────────────────────────────────────────
  function applySimRole(r: string) {
    setSimRole(r)
    if (r) localStorage.setItem('devSimRole', r)
    else   localStorage.removeItem('devSimRole')
    showToast(
      r ? `Simulando como ${r} — recarga para ver efecto` : 'Simulación desactivada — recarga',
      true,
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Configuraciones</h1>
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
            Developer only
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Panel exclusivo del desarrollador. Los cambios son inmediatos y permanentes.
        </p>
      </div>

      {/* Sim-role banner */}
      {simRole && (
        <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Simulando rol <strong>{simRole}</strong> — recarga la app para ver el efecto completo.
          </span>
          <button
            onClick={() => applySimRole('')}
            className="ml-auto text-amber-700 hover:text-amber-900 font-semibold"
          >
            Desactivar
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        {([
          { id: 'usuarios', label: 'Usuarios',  Icon: Users    },
          { id: 'datos',    label: 'Datos',     Icon: Database },
          { id: 'sistema',  label: 'Sistema',   Icon: Monitor  },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB USUARIOS ─────────────────────────────────────────── */}
      {tab === 'usuarios' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{users.length} usuarios registrados</p>
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 h-8 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
                const meta = ROLE_META[u.role ?? '']
                const initial = (u.email ?? '?')[0].toUpperCase()
                const lastSeen = u.lastSignIn
                  ? new Date(u.lastSignIn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
                  : 'Nunca'

                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 shrink-0">
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.email}</p>
                      <p className="text-xs text-slate-400">Último acceso: {lastSeen}</p>
                    </div>

                    {/* Role badge */}
                    {meta && (
                      <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}

                    {/* Role selector */}
                    <div className="shrink-0">
                      {roleLoading === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                      ) : (
                        <select
                          value={u.role ?? ''}
                          onChange={e => changeRole(u.id, e.target.value)}
                          className="h-8 pl-2 pr-7 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white cursor-pointer"
                        >
                          <option value="">Sin rol</option>
                          <option value="cajero">Cajero</option>
                          <option value="encargado">Encargado</option>
                          <option value="admin">Admin</option>
                          <option value="developer">Developer</option>
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB DATOS ────────────────────────────────────────────── */}
      {tab === 'datos' && (
        <div>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Zona de peligro</p>
              <p className="text-sm text-red-700 mt-0.5">
                Estas acciones son irreversibles. El sistema está en <strong>producción</strong> con datos reales.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {RESET_MODULES.map(mod => (
              <div
                key={mod.key}
                className={`bg-white border rounded-xl p-4 ${
                  mod.key === 'todo'
                    ? 'border-red-400 bg-red-50 sm:col-span-2'
                    : mod.danger ? 'border-red-200' : 'border-orange-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base leading-none">{mod.icon}</span>
                  <p className="text-sm font-semibold text-slate-900">{mod.label}</p>
                </div>
                <p className="text-xs text-slate-500 mb-3">{mod.desc}</p>
                <button
                  onClick={() => {
                    setResetModal({ key: mod.key, label: mod.label })
                    setResetInput('')
                    setResetResult(null)
                  }}
                  className={`w-full h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    mod.key === 'todo'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'border border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar {mod.label}
                </button>
              </div>
            ))}
          </div>

          {/* Confirm dialog */}
          {resetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <h3 className="font-semibold text-slate-900">Borrar: {resetModal.label}</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Esta acción es <strong>irreversible</strong>. Escribe{' '}
                  <code className="bg-slate-100 px-1 rounded text-red-600 font-mono">CONFIRMAR</code>{' '}
                  para continuar.
                </p>
                <input
                  autoFocus
                  type="text"
                  value={resetInput}
                  onChange={e => setResetInput(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />

                {resetResult && (
                  <div className="mb-4 bg-slate-50 rounded-lg p-3 space-y-1">
                    {Object.entries(resetResult).map(([table, status]) => (
                      <div key={table} className="flex justify-between text-xs">
                        <span className="text-slate-500 font-mono">{table}</span>
                        <span className={status === 'OK' ? 'text-green-600 font-semibold' : 'text-red-600'}>
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setResetModal(null)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmReset}
                    disabled={resetInput !== 'CONFIRMAR' || resetLoading}
                    className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {resetLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB SISTEMA ──────────────────────────────────────────── */}
      {tab === 'sistema' && (
        <div className="space-y-6">

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-500" />
                Registros por tabla
              </p>
              <button
                onClick={fetchStats}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 h-7 px-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Actualizar
              </button>
            </div>
            {loadingStats ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(stats.tables).map(([table, count]) => (
                  <div key={table} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{TABLE_LABELS[table] ?? table}</p>
                    <p className="text-xl font-bold text-slate-900">{count.toLocaleString('es-MX')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">No se pudieron cargar las estadísticas</p>
            )}
          </div>

          {/* Entorno */}
          {stats && (
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                <Server className="w-4 h-4 text-violet-500" />
                Entorno
              </p>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {[
                  { label: 'Supabase project', value: stats.url },
                  { label: 'Vercel env',        value: stats.env },
                  { label: 'Usuarios totales',  value: String(stats.userCount) },
                  { label: 'Producción',        value: 'baratera-os.vercel.app' },
                  { label: 'Repo',              value: 'mgvelezb-hub/baratera' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-sm font-mono font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simular rol */}
          <div>
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <Shield className="w-4 h-4 text-violet-500" />
              Simular rol
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Guarda un flag en localStorage. Al recargar, el sidebar y los permisos se comportarán
              como si fueras ese rol, sin cambiar de cuenta.
            </p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: '',          label: 'Sin simulación' },
                { value: 'cajero',    label: 'Cajero'         },
                { value: 'encargado', label: 'Encargado'      },
                { value: 'admin',     label: 'Admin'          },
              ].map(({ value, label }) => (
                <button
                  key={value || 'none'}
                  onClick={() => applySimRole(value)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    simRole === value
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {simRole && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Simulación activa: <strong>{simRole}</strong>. Recarga para que tome efecto completo.
              </p>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
