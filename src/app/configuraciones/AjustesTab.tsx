'use client'

import { useState, useEffect } from 'react'
import {
  Save, Loader2, AlertTriangle, Receipt, Bell, Package,
  Wrench, Plus, X,
} from 'lucide-react'
import type { AppConfig, ColorPaleta } from '@/lib/config'
import { invalidateConfigCache } from '@/lib/hooks/useConfig'

interface Props {
  config:           AppConfig
  migrationPending: boolean
  onSaved:          () => void
  showToast:        (msg: string, ok: boolean) => void
}

function Section({ icon: Icon, title, desc, children }: {
  icon:     React.ComponentType<{ className?: string }>
  title:    string
  desc:     string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-violet-500" />
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <p className="text-xs text-slate-400 mb-4">{desc}</p>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  )
}

function SaveButton({ onClick, saving, dirty }: { onClick: () => void; saving: boolean; dirty: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!dirty || saving}
      className="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      Guardar
    </button>
  )
}

export default function AjustesTab({ config, migrationPending, onSaved, showToast }: Props) {
  const [negocio,  setNegocio]  = useState(config.negocio)
  const [alertas,  setAlertas]  = useState(config.alertas)
  const [inv,      setInv]      = useState(config.inventario)
  const [mant,     setMant]     = useState(config.mantenimiento)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [nuevaCat, setNuevaCat] = useState('')

  // Re-sincronizar cuando el padre recarga la config
  useEffect(() => { setNegocio(config.negocio) },       [config.negocio])
  useEffect(() => { setAlertas(config.alertas) },       [config.alertas])
  useEffect(() => { setInv(config.inventario) },        [config.inventario])
  useEffect(() => { setMant(config.mantenimiento) },    [config.mantenimiento])

  async function save(clave: string, valor: object) {
    setSaving(clave)
    const res = await fetch('/api/dev/config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clave, valor }),
    })
    if (res.ok) {
      invalidateConfigCache()
      showToast('Configuración guardada', true)
      onSaved()
    } else {
      showToast((await res.json()).error ?? 'Error al guardar', false)
    }
    setSaving(null)
  }

  const dirtyNegocio = JSON.stringify(negocio) !== JSON.stringify(config.negocio)
  const dirtyAlertas = JSON.stringify(alertas) !== JSON.stringify(config.alertas)
  const dirtyInv     = JSON.stringify(inv)     !== JSON.stringify(config.inventario)
  const dirtyMant    = JSON.stringify(mant)    !== JSON.stringify(config.mantenimiento)

  function setColor(i: number, field: keyof ColorPaleta, v: string) {
    setInv(prev => ({
      ...prev,
      colores: prev.colores.map((c, idx) => idx === i ? { ...c, [field]: v } : c),
    }))
  }

  return (
    <div className="space-y-4">

      {migrationPending && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Corre <code className="bg-amber-100 px-1 rounded font-mono text-xs">migration-configuracion.sql</code> en
            el SQL editor de Supabase para poder guardar. Se muestran los valores actuales (hardcodeados).
          </p>
        </div>
      )}

      {/* ── Negocio / Ticket ─────────────────────────────────────── */}
      <Section icon={Receipt} title="Negocio y ticket" desc="Datos que aparecen impresos en el ticket de venta.">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Field label="Dirección — línea 1" value={negocio.direccion1} onChange={v => setNegocio({ ...negocio, direccion1: v })} />
          <Field label="Dirección — línea 2" value={negocio.direccion2} onChange={v => setNegocio({ ...negocio, direccion2: v })} />
          <Field label="Sitio web"  value={negocio.web}      onChange={v => setNegocio({ ...negocio, web: v })} />
          <Field label="Teléfono"   value={negocio.telefono} onChange={v => setNegocio({ ...negocio, telefono: v })} />
          <Field label="Footer — línea 1" value={negocio.footer1} onChange={v => setNegocio({ ...negocio, footer1: v })} placeholder="¡Gracias por su compra!" />
          <Field label="Footer — línea 2" value={negocio.footer2} onChange={v => setNegocio({ ...negocio, footer2: v })} placeholder="Vuelva pronto" />
        </div>
        <SaveButton onClick={() => save('negocio', negocio)} saving={saving === 'negocio'} dirty={dirtyNegocio} />
      </Section>

      {/* ── Alertas ──────────────────────────────────────────────── */}
      <Section icon={Bell} title="Alertas por correo" desc="Destinatario del email diario de adeudos por vencer (8am MX).">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Field label="Email destinatario" value={alertas.email} onChange={v => setAlertas({ email: v })} />
          </div>
          <SaveButton onClick={() => save('alertas', alertas)} saving={saving === 'alertas'} dirty={dirtyAlertas} />
        </div>
      </Section>

      {/* ── Inventario ───────────────────────────────────────────── */}
      <Section icon={Package} title="Parámetros de inventario" desc="Categorías de producto, umbral del semáforo y paleta de colores.">

        {/* Categorías */}
        <p className="text-xs font-medium text-slate-500 mb-1.5">Categorías</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {inv.categorias.map(cat => (
            <span key={cat} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">
              {cat}
              <button
                onClick={() => setInv({ ...inv, categorias: inv.categorias.filter(c => c !== cat) })}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nuevaCat}
            onChange={e => setNuevaCat(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && nuevaCat.trim()) {
                e.preventDefault()
                if (!inv.categorias.includes(nuevaCat.trim())) {
                  setInv({ ...inv, categorias: [...inv.categorias, nuevaCat.trim()] })
                }
                setNuevaCat('')
              }
            }}
            placeholder="Nueva categoría + Enter"
            className="h-8 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 w-48"
          />
          <button
            onClick={() => {
              if (nuevaCat.trim() && !inv.categorias.includes(nuevaCat.trim())) {
                setInv({ ...inv, categorias: [...inv.categorias, nuevaCat.trim()] })
                setNuevaCat('')
              }
            }}
            className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Semáforo */}
        <p className="text-xs font-medium text-slate-500 mb-1">Factor del semáforo amarillo</p>
        <p className="text-xs text-slate-400 mb-2">
          Amarillo cuando stock &lt; mínimo × factor. Rojo cuando stock &lt; mínimo. Actual: <strong>{inv.semaforo_factor}</strong>
          {' '}(ej: mínimo 20 → amarillo bajo {Math.round(20 * inv.semaforo_factor)} pzas)
        </p>
        <input
          type="number" min="1" step="0.1"
          value={inv.semaforo_factor}
          onChange={e => setInv({ ...inv, semaforo_factor: parseFloat(e.target.value) || 1.5 })}
          className="h-9 w-24 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
        />

        {/* Paleta de colores */}
        <p className="text-xs font-medium text-slate-500 mb-1.5">Paleta de colores (variantes de producto)</p>
        <div className="grid sm:grid-cols-2 gap-1.5 mb-2">
          {inv.colores.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c.hex}
                onChange={e => setColor(i, 'hex', e.target.value)}
                className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={c.nombre}
                onChange={e => setColor(i, 'nombre', e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={() => setInv({ ...inv, colores: inv.colores.filter((_, idx) => idx !== i) })}
                className="text-slate-300 hover:text-red-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setInv({ ...inv, colores: [...inv.colores, { nombre: 'Nuevo', hex: '#94a3b8' }] })}
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 flex items-center gap-1 mb-4"
        >
          <Plus className="w-3 h-3" />
          Agregar color
        </button>

        <SaveButton onClick={() => save('inventario', inv)} saving={saving === 'inventario'} dirty={dirtyInv} />
      </Section>

      {/* ── Mantenimiento ────────────────────────────────────────── */}
      <Section icon={Wrench} title="Modo mantenimiento" desc="Muestra un banner global y bloquea la confirmación de ventas en el POS.">
        <label className="flex items-center gap-3 mb-3 cursor-pointer">
          <button
            onClick={() => setMant({ ...mant, activo: !mant.activo })}
            className={`relative w-11 h-6 rounded-full transition-colors ${mant.activo ? 'bg-amber-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mant.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-medium ${mant.activo ? 'text-amber-600' : 'text-slate-500'}`}>
            {mant.activo ? 'ACTIVO — las ventas están bloqueadas' : 'Inactivo'}
          </span>
        </label>
        <div className="mb-3">
          <Field label="Mensaje del banner" value={mant.mensaje} onChange={v => setMant({ ...mant, mensaje: v })} />
        </div>
        <SaveButton onClick={() => save('mantenimiento', mant)} saving={saving === 'mantenimiento'} dirty={dirtyMant} />
      </Section>

    </div>
  )
}
