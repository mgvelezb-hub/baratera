'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor, Adeudo } from '@/lib/types'

interface Props {
  proveedor: Proveedor
  adeudo:    Adeudo | null   // null = crear, !null = editar
  onClose:   () => void
  onSuccess: () => void
}

export default function AdeudoModal({ proveedor, adeudo, onClose, onSuccess }: Props) {
  const [descripcion, setDescripcion] = useState(adeudo?.descripcion ?? '')
  const [monto,       setMonto]       = useState(adeudo ? String(adeudo.monto) : '')
  const [fecha,       setFecha]       = useState(adeudo?.fecha_vencimiento ?? '')
  const [notas,       setNotas]       = useState(adeudo?.notas ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoNum = parseFloat(monto)
    if (!descripcion.trim())         { setError('La descripción es requerida'); return }
    if (!montoNum || montoNum <= 0)  { setError('El monto debe ser mayor a 0'); return }
    if (!fecha)                      { setError('La fecha de vencimiento es requerida'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      proveedor_id:      proveedor.id,
      descripcion:       descripcion.trim(),
      monto:             montoNum,
      fecha_vencimiento: fecha,
      notas:             notas.trim() || null,
      created_by:        user?.id ?? null,
    }

    const { error: err } = adeudo
      ? await supabase.from('adeudos').update(payload).eq('id', adeudo.id)
      : await supabase.from('adeudos').insert(payload)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  const montoNum = parseFloat(monto) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">

        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {adeudo ? 'Editar adeudo' : 'Nuevo adeudo'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{proveedor.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción *</label>
            <input
              value={descripcion}
              onChange={e => { setDescripcion(e.target.value); setError('') }}
              placeholder="Ej: Factura #2041 · compra mensual papelería"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number" min="1" step="0.01"
                  value={monto}
                  onChange={e => { setMonto(e.target.value); setError('') }}
                  placeholder="0.00"
                  className="w-full h-11 pl-6 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha vencimiento *</label>
              <input
                type="date"
                value={fecha}
                onChange={e => { setFecha(e.target.value); setError('') }}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {montoNum > 0 && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
              Adeudo:{' '}
              <span className="font-bold text-slate-900">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(montoNum)}
              </span>
              {fecha && (
                <span className="text-slate-400">
                  {' '}· vence {new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                </span>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
