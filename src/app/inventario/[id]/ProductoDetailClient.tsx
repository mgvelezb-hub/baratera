'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Settings2 } from 'lucide-react'
import type { Producto } from '@/lib/types'
import MovimientoModal from '@/components/MovimientoModal'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'


interface Props {
  producto: Producto
}

export default function ProductoDetailClient({ producto }: Props) {
  const router = useRouter()
  const { can, canEntrada, showCostos } = useIsAdmin()
  const canAjuste = can('inventario.ajuste')
  const [modalTipo, setModalTipo] = useState<'entrada_compra' | 'ajuste_positivo' | null>(null)

  function handleMovimientoSuccess() {
    setModalTipo(null)
    router.refresh()
  }

  return (
    <>
      {/* ── Movement actions ─────────────────────────────── */}
      {(canEntrada || canAjuste) && (
        <div className={`grid gap-2 ${canEntrada && canAjuste ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canEntrada && (
            <button
              onClick={() => setModalTipo('entrada_compra')}
              className="h-12 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Entrada
            </button>
          )}
          {canAjuste && (
            <button
              onClick={() => setModalTipo('ajuste_positivo')}
              className="h-12 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              Ajuste
            </button>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {modalTipo && (
        <MovimientoModal
          producto={producto}
          defaultTipo={modalTipo}
          showCostos={showCostos}
          onClose={() => setModalTipo(null)}
          onSuccess={handleMovimientoSuccess}
        />
      )}
    </>
  )
}
