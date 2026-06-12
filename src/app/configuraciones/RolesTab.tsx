'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, Lock, Save, KeyRound,
} from 'lucide-react'
import { PERMISOS_CATALOGO, GRUPOS_LISTA, type Permisos } from '@/lib/permisos'

export interface RoleRow {
  id:          string
  nombre:      string
  etiqueta:    string
  descripcion: string | null
  permisos:    Permisos
  es_sistema:  boolean
}

interface Props {
  roles:            RoleRow[]
  userCounts:       Record<string, number>
  migrationPending: boolean
  onChanged:        () => void
  showToast:        (msg: string, ok: boolean) => void
}

// ── Editor de permisos (checkboxes agrupados por módulo) ────────────────────
function PermisosEditor({
  permisos, onChange, disabled = false,
}: {
  permisos: Permisos
  onChange: (p: Permisos) => void
  disabled?: boolean
}) {
  function toggle(key: string) {
    if (disabled) return
    const next = { ...permisos }
    if (next[key]) delete next[key]
    else next[key] = true
    onChange(next)
  }

  function toggleGrupo(grupo: string, keys: string[]) {
    if (disabled) return
    const allOn = keys.every(k => permisos[k] === true)
    const next = { ...permisos }
    if (allOn) keys.forEach(k => delete next[k])
    else keys.forEach(k => { next[k] = true })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {GRUPOS_LISTA.map(grupo => {
        const items = PERMISOS_CATALOGO.filter(p => p.grupo === grupo)
        if (!items.length) return null
        const allOn = items.every(p => permisos[p.key] === true)
        const someOn = !allOn && items.some(p => permisos[p.key] === true)
        return (
          <div key={grupo} className="border border-slate-100 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGrupo(grupo, items.map(p => p.key))}
              disabled={disabled}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
              } ${allOn ? 'bg-violet-50 text-violet-700' : someOn ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                allOn ? 'bg-violet-600 border-violet-600' : someOn ? 'bg-amber-400 border-amber-400' : 'border-slate-300 bg-white'
              }`}>
                {(allOn || someOn) && (
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-current">
                    {allOn
                      ? <path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      : <rect x="2" y="4" width="6" height="2" rx="1"/>
                    }
                  </svg>
                )}
              </span>
              {grupo}
              <span className="ml-auto font-normal normal-case text-[10px] opacity-60">
                {items.filter(p => permisos[p.key]).length}/{items.length}
              </span>
            </button>
            <div className="grid sm:grid-cols-2 gap-0 px-1 py-1">
              {items.map(p => (
                <label
                  key={p.key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    disabled
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={permisos[p.key] === true}
                    onChange={() => toggle(p.key)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                  />
                  <span className="leading-tight">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Card de un perfil existente ──────────────────────────────────
function RoleCard({
  role, userCount, readOnly, onChanged, showToast,
}: {
  role:      RoleRow
  userCount: number
  readOnly:  boolean
  onChanged: () => void
  showToast: (msg: string, ok: boolean) => void
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [permisos,  setPermisos]  = useState<Permisos>(role.permisos ?? {})
  const [etiqueta,  setEtiqueta]  = useState(role.etiqueta)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const isDeveloper = role.nombre === 'developer'
  const editable    = !readOnly && !isDeveloper
  const numPermisos = Object.values(role.permisos ?? {}).filter(Boolean).length
  const dirty = etiqueta !== role.etiqueta
    || JSON.stringify(permisos) !== JSON.stringify(role.permisos ?? {})

  async function save() {
    setSaving(true)
    const res = await fetch('/api/dev/roles', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: role.id, etiqueta, permisos }),
    })
    if (res.ok) {
      showToast(`Perfil "${etiqueta}" guardado`, true)
      onChanged()
    } else {
      showToast((await res.json()).error ?? 'Error al guardar', false)
    }
    setSaving(false)
  }

  async function remove() {
    setDeleting(true)
    const res = await fetch('/api/dev/roles', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: role.id }),
    })
    if (res.ok) {
      showToast(`Perfil "${role.etiqueta}" eliminado`, true)
      onChanged()
    } else {
      showToast((await res.json()).error ?? 'Error al eliminar', false)
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900">{role.etiqueta}</p>
            <code className="text-xs text-slate-400 font-mono">{role.nombre}</code>
            {role.es_sistema && (
              <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                <Lock className="w-2.5 h-2.5" />
                Sistema
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {numPermisos} permiso{numPermisos === 1 ? '' : 's'} · {userCount} usuario{userCount === 1 ? '' : 's'}
            {role.descripcion ? ` · ${role.descripcion}` : ''}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {isDeveloper && (
            <p className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
              <Lock className="w-3 h-3 shrink-0" />
              El perfil developer siempre tiene todos los permisos y no es editable.
            </p>
          )}

          {editable && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Etiqueta</label>
              <input
                type="text"
                value={etiqueta}
                onChange={e => setEtiqueta(e.target.value)}
                className="w-full sm:w-64 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}

          <PermisosEditor
            permisos={permisos}
            onChange={setPermisos}
            disabled={!editable}
          />

          {editable && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar cambios
              </button>

              {!role.es_sistema && (
                confirmDel ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-red-600">¿Eliminar definitivamente?</span>
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Sí, eliminar
                    </button>
                    <button
                      onClick={() => setConfirmDel(false)}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDel(true)}
                    className="ml-auto h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar perfil
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab completo ─────────────────────────────────────────────────
export default function RolesTab({ roles, userCounts, migrationPending, onChanged, showToast }: Props) {
  const [showNew,     setShowNew]     = useState(false)
  const [newNombre,   setNewNombre]   = useState('')
  const [newEtiqueta, setNewEtiqueta] = useState('')
  const [newDesc,     setNewDesc]     = useState('')
  const [newPermisos, setNewPermisos] = useState<Permisos>({})
  const [creating,    setCreating]    = useState(false)

  async function create() {
    setCreating(true)
    const res = await fetch('/api/dev/roles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nombre:      newNombre,
        etiqueta:    newEtiqueta,
        descripcion: newDesc,
        permisos:    newPermisos,
      }),
    })
    if (res.ok) {
      showToast(`Perfil "${newEtiqueta}" creado`, true)
      setShowNew(false)
      setNewNombre(''); setNewEtiqueta(''); setNewDesc(''); setNewPermisos({})
      onChanged()
    } else {
      showToast((await res.json()).error ?? 'Error al crear', false)
    }
    setCreating(false)
  }

  return (
    <div>
      {migrationPending && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Migración pendiente</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Corre <code className="bg-amber-100 px-1 rounded font-mono text-xs">migration-roles.sql</code> en
              el SQL editor de Supabase para activar la edición de perfiles. Mientras tanto se muestran
              los perfiles fijos del sistema en modo lectura.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {roles.length} perfiles · los permisos controlan módulos y acciones visibles
        </p>
        {!migrationPending && (
          <button
            onClick={() => setShowNew(!showNew)}
            className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo perfil
          </button>
        )}
      </div>

      {/* Form: nuevo perfil */}
      {showNew && (
        <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-4 mb-4 space-y-4">
          <p className="text-sm font-semibold text-slate-900">Crear perfil</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Clave interna <span className="text-slate-400">(minúsculas, sin espacios)</span>
              </label>
              <input
                type="text"
                value={newNombre}
                onChange={e => setNewNombre(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="ej: auditor"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Etiqueta visible</label>
              <input
                type="text"
                value={newEtiqueta}
                onChange={e => setNewEtiqueta(e.target.value)}
                placeholder="ej: Auditor"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="ej: Solo lectura de dashboard y corte"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            />
          </div>

          <PermisosEditor permisos={newPermisos} onChange={setNewPermisos} />

          <div className="flex gap-2">
            <button
              onClick={() => setShowNew(false)}
              className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={create}
              disabled={!newNombre || !newEtiqueta || creating}
              className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crear perfil
            </button>
          </div>
        </div>
      )}

      {/* Lista de perfiles */}
      <div className="space-y-2">
        {roles.map(role => (
          <RoleCard
            key={role.id}
            role={role}
            userCount={userCounts[role.nombre] ?? 0}
            readOnly={migrationPending}
            onChanged={onChanged}
            showToast={showToast}
          />
        ))}
      </div>
    </div>
  )
}
