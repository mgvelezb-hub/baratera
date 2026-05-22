'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, TrendingDown, TrendingUp, Settings2, Trash2 } from 'lucide-react'
import type { Producto, MovimientoTipo } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import MovimientoModal from '@/components/MovimientoModal'

interface Props {
  producto: Producto
}

export default function ProductoDetailClient({ producto }: Props) {
  const router = useRouter()
  const { isAdmin } = useIsAdmin()
  const [modalTipo, setModalTipo] = useState<MovimientoTipo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleSuccess() {
    setModalTipo(null)
    router.refresh()
  }

  async function handleDesactivar() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('productos').update({ activo: false }).eq('id', producto.id)
    router.push('/inventario')
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setModalTipo('levantamiento_inventario')}
          className="h-12 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          Levantar
        </button>
        <button
          onClick={() => setModalTipo('entrada_compra')}
          className="h-12 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Entrada
        </button>
        <button
          onClick={() => setModalTipo('salida_venta_manual')}
          className="h-12 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <TrendingDown className="w-4 h-4" />
          Venta manual
        </button>
        <button
          onClick={() => setModalTipo('ajuste_positivo')}
          className="h-12 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Ajuste
        </button>
      </div>

      {isAdmin && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          {confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">¿Desactivar este producto?</p>
              <p className="text-xs text-red-600 mb-4">
                El producto dejará de aparecer en el inventario. El historial de movimientos se conserva.
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
      )}

      {modalTipo && (
        <MovimientoModal
          producto={producto}
          defaultTipo={modalTipo}
          onClose={() => setModalTipo(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
