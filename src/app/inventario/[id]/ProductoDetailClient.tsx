'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Settings2, Trash2, Pencil } from 'lucide-react'
import type { Producto } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import MovimientoModal from '@/components/MovimientoModal'
import EditarProductoModal from '../EditarProductoModal'

interface Props {
  producto: Producto
}

export default function ProductoDetailClient({ producto }: Props) {
  const router = useRouter()
  const { isAdmin } = useIsAdmin()
  const [modalTipo,    setModalTipo]    = useState<'entrada_compra' | 'ajuste_positivo' | null>(null)
  const [showEditar,   setShowEditar]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  function handleMovimientoSuccess() {
    setModalTipo(null)
    router.refresh()
  }

  function handleEditarSuccess() {
    setShowEditar(false)
    router.refresh()
  }

  async function handleDesactivar() {
    setDeleting(true)
    await createClient().from('productos').update({ activo: false }).eq('id', producto.id)
    router.push('/inventario')
  }

  return (
    <>
      {/* ── Movement actions ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setModalTipo('entrada_compra')}
          className="h-12 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Entrada
        </button>
        <button
          onClick={() => setModalTipo('ajuste_positivo')}
          className="h-12 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Ajuste
        </button>
      </div>

      {/* ── Admin section ─────────────────────────────────── */}
      {isAdmin && (
        <div className="mt-5 p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Administración</p>

          <button
            onClick={() => setShowEditar(true)}
            className="w-full flex items-center justify-between h-11 px-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-sm font-medium text-slate-700 transition-colors group"
          >
            <span>Editar producto</span>
            <Pencil className="w-4 h-4 text-slate-400 group-hover:text-violet-500" />
          </button>

          <div className="pt-1">
            {confirmDelete ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">¿Desactivar este producto?</p>
                <p className="text-xs text-red-600 mb-4">
                  Dejará de aparecer en el inventario. El historial de movimientos se conserva.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDesactivar}
                    disabled={deleting}
                    className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {deleting ? 'Desactivando...' : 'Sí, desactivar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Desactivar producto
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {modalTipo && (
        <MovimientoModal
          producto={producto}
          defaultTipo={modalTipo}
          onClose={() => setModalTipo(null)}
          onSuccess={handleMovimientoSuccess}
        />
      )}

      {showEditar && (
        <EditarProductoModal
          producto={producto}
          onClose={() => setShowEditar(false)}
          onSuccess={handleEditarSuccess}
        />
      )}
    </>
  )
}
