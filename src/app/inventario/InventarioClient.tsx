'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, AlertTriangle, Package, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, ProductoColor } from '@/lib/types'
import { calcularSemaforoEfectivo } from '@/lib/types'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import ProductoCard from '@/components/ProductoCard'
import NuevoProductoModal from './NuevoProductoModal'

type FiltroSemaforo = 'todos' | 'rojo' | 'amarillo' | 'verde'

export default function InventarioClient() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [coloresMap, setColoresMap] = useState<Map<string, ProductoColor[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroSemaforo>('todos')
  const [showNuevo, setShowNuevo] = useState(false)
  const { can, canEntrada, showCostos } = useIsAdmin()
  const canAgregar = can('inventario.agregar')
  const canEditar  = can('inventario.editar')

  const fetchProductos = useCallback(async () => {
    const supabase = createClient()
    const [{ data: prods }, { data: cols }] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('producto_colores').select('*').order('nombre'),
    ])
    setProductos(prods ?? [])
    const map = new Map<string, ProductoColor[]>()
    for (const c of (cols ?? [])) {
      const arr = map.get(c.producto_id) ?? []
      arr.push(c)
      map.set(c.producto_id, arr)
    }
    setColoresMap(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProductos() }, [fetchProductos])

  const productosFiltrados = productos.filter(p => {
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(search.toLowerCase())

    const sem = calcularSemaforoEfectivo(p, coloresMap.get(p.id) ?? [])
    const matchFiltro = filtro === 'todos' || sem === filtro

    return matchSearch && matchFiltro
  })

  const counts = {
    rojo:     productos.filter(p => calcularSemaforoEfectivo(p, coloresMap.get(p.id) ?? []) === 'rojo').length,
    amarillo: productos.filter(p => calcularSemaforoEfectivo(p, coloresMap.get(p.id) ?? []) === 'amarillo').length,
    verde:    productos.filter(p => calcularSemaforoEfectivo(p, coloresMap.get(p.id) ?? []) === 'verde').length,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventario</h1>
          <p className="text-sm text-slate-500 mt-0.5">{productos.length} productos</p>
        </div>
        {canAgregar && (
          <button
            onClick={() => setShowNuevo(true)}
            className="h-10 px-4 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        )}
      </div>

      {/* Resumen semáforo */}
      {productos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <button
            onClick={() => setFiltro(filtro === 'rojo' ? 'todos' : 'rojo')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filtro === 'rojo' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-red-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-700">Crítico</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{counts.rojo}</p>
          </button>
          <button
            onClick={() => setFiltro(filtro === 'amarillo' ? 'todos' : 'amarillo')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filtro === 'amarillo' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">Stock bajo</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{counts.amarillo}</p>
          </button>
          <button
            onClick={() => setFiltro(filtro === 'verde' ? 'todos' : 'verde')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filtro === 'verde' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white hover:border-green-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium text-green-700">OK</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{counts.verde}</p>
          </button>
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, SKU o categoría..."
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Filtro activo */}
      {filtro !== 'todos' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500">Filtrando: <strong className="text-slate-700">{filtro}</strong></span>
          <button onClick={() => setFiltro('todos')} className="text-xs text-violet-600 hover:underline">
            Ver todos
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          {productos.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-600">Sin productos aún</p>
              <p className="text-xs text-slate-400 mt-1">Agrega el primer producto con el botón de arriba</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Sin resultados</p>
              <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {productosFiltrados.map(producto => (
            <ProductoCard
              key={producto.id}
              producto={producto}
              colores={coloresMap.get(producto.id) ?? []}
              isAdmin={canEditar}
              canEntrada={canEntrada}
              showCostos={showCostos}
              onRefresh={fetchProductos}
            />
          ))}
        </div>
      )}

      {showNuevo && (
        <NuevoProductoModal
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); fetchProductos() }}
          showCostos={showCostos}
        />
      )}
    </div>
  )
}
