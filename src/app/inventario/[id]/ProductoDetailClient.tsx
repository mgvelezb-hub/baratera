'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, TrendingDown, TrendingUp, Settings2 } from 'lucide-react'
import type { Producto } from '@/lib/types'
import MovimientoModal from '@/components/MovimientoModal'
import type { MovimientoTipo } from '@/lib/types'

interface Props {
  producto: Producto
}

export default function ProductoDetailClient({ producto }: Props) {
  const router = useRouter()
  const [modalTipo, setModalTipo] = useState<MovimientoTipo | null>(null)

  function handleSuccess() {
    setModalTipo(null)
    router.refresh()
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
