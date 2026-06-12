'use client'
import { useState }     from 'react'
import { X, UserPlus }  from 'lucide-react'
import type { Cliente } from '@/lib/types'

interface Props {
  onCreado: (c: Cliente) => void
  onCerrar: () => void
}

const EMPTY = { nombre: '', telefono: '', correo: '', tipo: 'normal', recibe_promo: false, notas: '' }

export default function NuevoClienteModal({ onCreado, onCerrar }: Props) {
  const [form, setForm]     = useState(EMPTY)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res  = await fetch('/api/clientes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear cliente'); return }
      onCreado(data as Cliente)
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus size={17} className="text-violet-600" />
            <h2 className="font-semibold text-slate-800">Nuevo cliente</h2>
          </div>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600">
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={set('nombre')} required
              placeholder="María García"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono * <span className="text-slate-400 font-normal">(clave única)</span></label>
            <input value={form.telefono} onChange={set('telefono')} required type="tel"
              placeholder="5551234567"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Correo</label>
            <input value={form.correo} onChange={set('correo')} type="email"
              placeholder="maria@ejemplo.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="normal">Normal</option>
                <option value="mayorista">Mayorista</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-2">
              <input type="checkbox" checked={form.recibe_promo}
                onChange={e => setForm(p => ({ ...p, recibe_promo: e.target.checked }))}
                className="accent-violet-600 w-4 h-4" />
              Recibe promos
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea value={form.notas} onChange={set('notas')} rows={2}
              placeholder="Pedidos frecuentes, preferencias, etc."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
