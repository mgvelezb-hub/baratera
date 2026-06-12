'use client'
import { useState, useMemo } from 'react'
import { Users, Plus, Search, Phone, Mail } from 'lucide-react'
import Link                  from 'next/link'
import type { Cliente }      from '@/lib/types'
import NuevoClienteModal     from './NuevoClienteModal'

const TIPO_BADGE: Record<string, string> = {
  frecuente: 'bg-blue-50 text-blue-700',
  mayorista: 'bg-amber-50 text-amber-700',
}

interface Props { clientes: Cliente[] }

export default function ClientesClient({ clientes: inicial }: Props) {
  const [clientes, setClientes] = useState(inicial)
  const [q,        setQ]        = useState('')
  const [showNuevo, setShowNuevo] = useState(false)

  const filtrados = useMemo(() => {
    if (!q.trim()) return clientes
    const lq = q.toLowerCase()
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(lq) ||
      c.telefono.includes(lq) ||
      c.numero_cliente.toLowerCase().includes(lq)
    )
  }, [clientes, q])

  function onClienteCreado(c: Cliente) {
    setClientes(prev => [c, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setShowNuevo(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="text-violet-600" size={20} />
          <h1 className="text-lg font-bold text-slate-800">Clientes</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {clientes.length}
          </span>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono o N° cliente…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {q ? 'Sin resultados para esa búsqueda' : 'Aún no hay clientes registrados'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">N° Cliente</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Teléfono</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-center">Promo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-violet-700 font-semibold">{c.numero_cliente}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="flex items-center gap-1">
                      <Phone size={11} className="text-slate-400 shrink-0" />{c.telefono}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIPO_BADGE[c.tipo] ?? ''}`}>
                      {c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.recibe_promo
                      ? <Mail size={13} className="text-green-500 inline" />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/clientes/${c.id}`}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNuevo && (
        <NuevoClienteModal
          onCreado={onClienteCreado}
          onCerrar={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}
