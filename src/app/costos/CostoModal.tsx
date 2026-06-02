'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CostoFijo, CostoCategoria, CostoPeriodo } from '@/lib/types'
import { CATEGORIA_META, costoMensual } from '@/lib/types'

const PERIODOS: { id: CostoPeriodo; label: string }[] = [
  { id: 'mensual',   label: 'Mensual'   },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'semanal',   label: 'Semanal'   },
  { id: 'anual',     label: 'Anual'     },
  { id: 'unico',     label: 'Único'     },
]

interface Props {
  costo:     CostoFijo | null
  onClose:   () => void
  onSuccess: () => void
}

export default function CostoModal({ costo, onClose, onSuccess }: Props) {
  const [categoria, setCategoria] = useState<CostoCategoria>(costo?.categoria ?? 'otros')
  const [nombre,    setNombre]    = useState(costo?.nombre ?? '')
  const [monto,     setMonto]     = useState(costo ? String(costo.monto) : '')
  const [periodo,   setPeriodo]   = useState<CostoPeriodo>(costo?.periodo ?? 'mensual')
  const [notas,     setNotas]     = useState(costo?.notas ?? '')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const montoNum    = parseFloat(monto) || 0
  const mensualEst  = montoNum > 0
    ? costoMensual({ monto: montoNum, periodo } as CostoFijo)
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim())             { setError('El nombre es requerido'); return }
    if (!montoNum || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return }

    setLoading(true)
    const payload = {
      categoria,
      nombre:  nombre.trim(),
      monto:   montoNum,
      periodo,
      notas:   notas.trim() || null,
    }

    const { error: err } = costo
      ? await createClient().from('costos_fijos').update(payload).eq('id', costo.id)
      : await createClient().from('costos_fijos').insert(payload)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">

        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {costo ? 'Editar costo' : 'Nuevo costo fijo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CATEGORIA_META) as [CostoCategoria, typeof CATEGORIA_META[CostoCategoria]][]).map(([cat, meta]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(cat)}
                  className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                    categoria === cat
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
            <input
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError('') }}
              placeholder="Ej: Sueldo cajera, Renta local, Luz..."
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Monto + Período */}
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Período</label>
              <select
                value={periodo}
                onChange={e => setPeriodo(e.target.value as CostoPeriodo)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Preview equivalente mensual */}
          {mensualEst > 0 && periodo !== 'mensual' && (
            <div className="bg-violet-50 rounded-xl px-4 py-2.5 text-xs text-violet-700">
              Equivale a{' '}
              <span className="font-bold">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(mensualEst)}
              </span>
              {' '}/ mes
            </div>
          )}

          {/* Notas */}
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
