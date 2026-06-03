'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor } from '@/lib/types'

interface Props {
  proveedor?: Proveedor
  onClose:    () => void
  onSuccess:  () => void
}

export default function NuevoProveedorModal({ proveedor, onClose, onSuccess }: Props) {
  const editando = !!proveedor

  const [nombre,   setNombre]   = useState(proveedor?.nombre          ?? '')
  const [contacto, setContacto] = useState(proveedor?.contacto_nombre ?? '')
  const [tel,      setTel]      = useState(proveedor?.contacto_tel    ?? '')
  const [notas,    setNotas]    = useState(proveedor?.notas           ?? '')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)

    const payload = {
      nombre:          nombre.trim(),
      contacto_nombre: contacto.trim() || null,
      contacto_tel:    tel.trim()      || null,
      notas:           notas.trim()    || null,
    }

    const supabase = createClient()
    const { error: err } = editando
      ? await supabase.from('proveedores').update(payload).eq('id', proveedor.id)
      : await supabase.from('proveedores').insert(payload)

    if (err) { setError('Error al guardar. Intenta de nuevo.'); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">

        <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Nombre del proveedor *" value={nombre}   onChange={setNombre}   placeholder="Ej: Distribuidora Norte" />
          <Field label="Contacto"               value={contacto} onChange={setContacto} placeholder="Nombre del contacto"      />
          <Field label="Teléfono"               value={tel}      onChange={setTel}      placeholder="+52 55 1234 5678" type="tel" />
          <Field label="Notas"                  value={notas}    onChange={setNotas}    placeholder="Observaciones opcionales..." />

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  type?:       string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  )
}
