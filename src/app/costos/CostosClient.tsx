'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CostoFijo, CostoCategoria } from '@/lib/types'
import { costoMensual, CATEGORIA_META } from '@/lib/types'
import CostoModal from './CostoModal'

const FMT     = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const CIRCUM  = 2 * Math.PI * 38  // radio 38

interface Props {
  costosIniciales:       CostoFijo[]
  costoMercanciaEstimado: number
}

export default function CostosClient({ costosIniciales, costoMercanciaEstimado }: Props) {
  const [costos,    setCostos]    = useState(costosIniciales)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState<CostoFijo | null>(null)

  async function refresh() {
    const { data } = await createClient()
      .from('costos_fijos').select('*').eq('activo', true).order('categoria').order('nombre')
    setCostos(data ?? [])
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await createClient().from('costos_fijos').delete().eq('id', id)
    await refresh()
  }

  // ── Totales por categoría ──────────────────────────────────
  const totalPorCat = useMemo(() => {
    const map: Partial<Record<CostoCategoria, number>> = {}
    for (const c of costos) {
      map[c.categoria] = (map[c.categoria] ?? 0) + costoMensual(c)
    }
    return map
  }, [costos])

  const totalFijos   = Object.values(totalPorCat).reduce((s, v) => s + v, 0)
  const totalGeneral = totalFijos + costoMercanciaEstimado

  // ── Donut segments ─────────────────────────────────────────
  const segments = useMemo(() => {
    const base = [
      { label: 'Mercancía', value: costoMercanciaEstimado, color: '#7c3aed' },
      ...Object.entries(totalPorCat)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([cat, val]) => ({
          label: CATEGORIA_META[cat as CostoCategoria].label,
          value: val ?? 0,
          color: CATEGORIA_META[cat as CostoCategoria].color,
        })),
    ].filter(s => s.value > 0)

    let offset = 0
    return base.map(s => {
      const pct  = totalGeneral > 0 ? s.value / totalGeneral : 0
      const dash = pct * CIRCUM
      const seg  = { ...s, pct: Math.round(pct * 100), dash, offset: -offset }
      offset += dash
      return seg
    })
  }, [totalPorCat, costoMercanciaEstimado, totalGeneral])

  return (
    <div className="px-4 py-5 max-w-4xl mx-auto space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Estructura de Costos</h1>
          <p className="text-sm text-slate-500">Costos fijos registrados + mercancía estimada este mes</p>
        </div>
        <button
          onClick={() => { setEditando(null); setShowModal(true) }}
          className="flex items-center gap-2 h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />Nuevo costo
        </button>
      </div>

      {/* ── Donut + legend ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {totalGeneral === 0 ? (
          <div className="flex flex-col items-center py-10 text-center gap-2">
            <Package className="w-10 h-10 text-slate-200" />
            <p className="text-sm text-slate-400">Agrega costos fijos para ver la distribución</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Donut SVG */}
            <div className="shrink-0">
              <svg viewBox="0 0 110 110" width="148" height="148">
                {/* Track */}
                <circle cx="55" cy="55" r="38" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                {/* Segments */}
                {segments.map((s, i) => (
                  <circle key={i} cx="55" cy="55" r="38" fill="none"
                    stroke={s.color} strokeWidth="18"
                    strokeDasharray={`${s.dash} ${CIRCUM - s.dash}`}
                    strokeDashoffset={s.offset}
                    strokeLinecap="butt"
                    transform="rotate(-90 55 55)"
                  />
                ))}
                {/* Center text */}
                <text x="55" y="49" textAnchor="middle" fill="#475569" fontSize="9" fontWeight="600">Total/mes</text>
                <text x="55" y="63" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="700">
                  {FMT.format(totalGeneral).replace('MX$', '$')}
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-3 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Distribución mensual</p>
              {segments.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{s.label}</span>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-8 text-right font-mono">{s.pct}%</span>
                  <span className="text-xs text-slate-500 w-20 text-right font-mono shrink-0">{FMT.format(s.value)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700">Total costos / mes</span>
                <span className="text-sm font-bold text-slate-900">{FMT.format(totalGeneral)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mercancía (auto-calculado) ───────────────────────── */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-violet-800">Mercancía (compras este mes)</p>
          <p className="text-xs text-violet-500 mt-0.5">Calculado de entradas de inventario × precio menudeo</p>
        </div>
        <p className="text-xl font-bold text-violet-700">{FMT.format(costoMercanciaEstimado)}</p>
      </div>

      {/* ── Costos por categoría ────────────────────────────── */}
      {costos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center py-14 text-center">
          <p className="text-sm font-medium text-slate-500">Sin costos fijos registrados</p>
          <p className="text-xs text-slate-400 mt-1">Agrega renta, sueldos, servicios…</p>
        </div>
      ) : (
        (Object.entries(CATEGORIA_META) as [CostoCategoria, typeof CATEGORIA_META[CostoCategoria]][]).map(([cat, meta]) => {
          const catCostos = costos.filter(c => c.categoria === cat)
          if (catCostos.length === 0) return null
          const totalCat  = totalPorCat[cat] ?? 0

          return (
            <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg}`}>
                  {meta.label}
                </span>
                <span className="text-xs font-bold text-slate-600 font-mono">
                  {FMT.format(totalCat)} / mes
                </span>
              </div>
              <ul className="divide-y divide-slate-50">
                {catCostos.map(c => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{c.nombre}</p>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">
                        {c.periodo} · equiv. {FMT.format(costoMensual(c))}/mes
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 font-mono shrink-0">
                      {FMT.format(Number(c.monto))}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditando(c); setShowModal(true) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => eliminar(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}

      {/* ── Modal ───────────────────────────────────────────── */}
      {showModal && (
        <CostoModal
          costo={editando}
          onClose={() => { setShowModal(false); setEditando(null) }}
          onSuccess={() => { setShowModal(false); setEditando(null); refresh() }}
        />
      )}
    </div>
  )
}
