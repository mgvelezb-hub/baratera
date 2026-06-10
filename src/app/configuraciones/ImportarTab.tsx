'use client'

import { useState, useRef, useCallback } from 'react'
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2,
  AlertTriangle, X, RefreshCw, Package, Palette,
} from 'lucide-react'

interface FilaImportada {
  nombre:            string
  color?:            string
  subcategoria?:     string
  existencia_cajas:  number
  existencia_piezas: number
  piezas_por_caja?:  number
  precio_menudeo:    number
  precio_mayoreo?:   number
  precio_caja?:      number
}

interface Resultado {
  creados: number
  errores: Array<{ nombre: string; error: string }>
}

const HEADER_MAP: Record<string, keyof FilaImportada> = {
  'producto':              'nombre',
  'color':                 'color',
  'contenido por paquete': 'subcategoria',
  'subcategoria':          'subcategoria',
  'subcategoría':          'subcategoria',
  'existencia de cajas':   'existencia_cajas',
  'existencia de piezas':  'existencia_piezas',
  'cajas':                 'existencia_cajas',
  'piezas':                'existencia_piezas',
  'piezas por caja':       'piezas_por_caja',
  'precio menudeo':        'precio_menudeo',
  'precio mayoreo':        'precio_mayoreo',
  'precio caja':           'precio_caja',
}

function norm(s: string): string {
  return s.toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

function toNum(v: unknown): number {
  if (v === '' || v === null || v === undefined) return 0
  return Number(v) || 0
}

function formatMXN(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
}

async function parseExcel(file: File): Promise<FilaImportada[]> {
  const { read, utils } = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb     = read(buffer, { type: 'array' })
  const ws     = wb.Sheets[wb.SheetNames[0]]
  const raw    = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return raw
    .map(row => {
      const m: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(row)) {
        const field = HEADER_MAP[norm(key)]
        if (field) m[field] = val
      }
      if (!m.nombre || !String(m.nombre).trim()) return null
      return {
        nombre:            String(m.nombre).trim(),
        color:             m.color        ? String(m.color).trim()        || undefined : undefined,
        subcategoria:      m.subcategoria ? String(m.subcategoria).trim() || undefined : undefined,
        existencia_cajas:  toNum(m.existencia_cajas),
        existencia_piezas: toNum(m.existencia_piezas),
        piezas_por_caja:   toNum(m.piezas_por_caja)  || undefined,
        precio_menudeo:    toNum(m.precio_menudeo),
        precio_mayoreo:    toNum(m.precio_mayoreo)    || undefined,
        precio_caja:       toNum(m.precio_caja)       || undefined,
      } satisfies FilaImportada
    })
    .filter(Boolean) as FilaImportada[]
}

function getStats(filas: FilaImportada[]) {
  const nombres    = new Set(filas.map(f => f.nombre))
  const conColores = new Set(filas.filter(f => f.color).map(f => f.nombre))
  return { totalFilas: filas.length, productos: nombres.size, conColores: conColores.size }
}

interface Props {
  showToast: (msg: string, ok: boolean) => void
}

export default function ImportarTab({ showToast }: Props) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [filas,     setFilas]     = useState<FilaImportada[]>([])
  const [parseErr,  setParseErr]  = useState('')
  const [parsing,   setParsing]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [showAll,   setShowAll]   = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseErr('Solo se aceptan archivos .xlsx o .xls')
      return
    }
    setParsing(true)
    setParseErr('')
    setFilas([])
    setResultado(null)
    setFileName(file.name)
    try {
      const parsed = await parseExcel(file)
      if (parsed.length === 0) {
        setParseErr('No se encontraron filas con nombre de producto válido')
      } else {
        setFilas(parsed)
      }
    } catch {
      setParseErr('Error al leer el archivo. Verifica que sea un Excel válido.')
    }
    setParsing(false)
  }, [])

  async function handleImport() {
    if (!filas.length) return
    setImporting(true)
    try {
      const res = await fetch('/api/dev/import-excel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filas }),
      })
      const data: Resultado = await res.json()
      setResultado(data)
      if (res.ok) {
        showToast(`${data.creados} producto${data.creados !== 1 ? 's' : ''} importado${data.creados !== 1 ? 's' : ''}`, true)
      } else {
        showToast('Error al importar', false)
      }
    } catch {
      showToast('Error de red', false)
    }
    setImporting(false)
  }

  function reset() {
    setFilas([])
    setFileName('')
    setParseErr('')
    setResultado(null)
    setShowAll(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const stats   = filas.length ? getStats(filas) : null
  const preview = showAll ? filas : filas.slice(0, 10)

  return (
    <div className="space-y-5">

      {/* Header info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Columnas esperadas en el Excel</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-blue-700 font-mono">
          {Object.keys(HEADER_MAP).map(h => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Si un producto tiene varios colores: repite la fila con el mismo nombre y distinto color.
          El stock total = cajas × piezas/caja + piezas sueltas.
        </p>
      </div>

      {/* Drop zone — only shown if no file loaded */}
      {!filas.length && !parsing && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${
            dragging
              ? 'border-violet-400 bg-violet-50'
              : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
          }`}
        >
          <UploadCloud className={`w-10 h-10 ${dragging ? 'text-violet-500' : 'text-slate-300'}`} />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              Arrastra tu Excel aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-slate-400 mt-1">Archivos .xlsx o .xls</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* Parsing spinner */}
      {parsing && (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
          <span className="text-sm">Leyendo archivo…</span>
        </div>
      )}

      {/* Parse error */}
      {parseErr && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{parseErr}</p>
          </div>
          <button onClick={reset} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* File loaded: stats + preview + action */}
      {filas.length > 0 && !resultado && (
        <div className="space-y-4">

          {/* File bar */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{fileName}</span>
            <button onClick={reset} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats chips */}
          {stats && (
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 bg-violet-100 text-violet-700 text-xs px-3 py-1.5 rounded-full font-medium">
                <Package className="w-3.5 h-3.5" />
                {stats.productos} producto{stats.productos !== 1 ? 's' : ''} únicos
              </span>
              {stats.conColores > 0 && (
                <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-full font-medium">
                  <Palette className="w-3.5 h-3.5" />
                  {stats.conColores} con colores
                </span>
              )}
              <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full font-medium">
                {stats.totalFilas} filas totales
              </span>
            </div>
          )}

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Producto', 'Color', 'Subcategoría', 'Cajas', 'Piezas', 'Pzas/caja', 'Menudeo', 'Mayoreo', 'Caja'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[120px] truncate">{f.nombre}</td>
                    <td className="px-3 py-2 text-slate-500">{f.color ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[100px] truncate">{f.subcategoria ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-right">{f.existencia_cajas || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-right">{f.existencia_piezas || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-right">{f.piezas_por_caja ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{formatMXN(f.precio_menudeo)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{f.precio_mayoreo ? formatMXN(f.precio_mayoreo) : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{f.precio_caja ? formatMXN(f.precio_caja) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filas.length > 10 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              {showAll ? 'Mostrar menos' : `Ver las ${filas.length - 10} filas restantes`}
            </button>
          )}

          {/* Import button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleImport}
              disabled={importing}
              className="h-10 px-5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</>
                : <><UploadCloud className="w-4 h-4" /> Importar {stats?.productos} productos</>}
            </button>
            <button
              onClick={reset}
              className="h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Result screen */}
      {resultado && (
        <div className="space-y-4">
          {/* Success summary */}
          <div className={`flex items-start gap-3 rounded-xl p-4 ${resultado.creados > 0 ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${resultado.creados > 0 ? 'text-green-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-semibold ${resultado.creados > 0 ? 'text-green-800' : 'text-slate-600'}`}>
                {resultado.creados} producto{resultado.creados !== 1 ? 's' : ''} creado{resultado.creados !== 1 ? 's' : ''} correctamente
              </p>
              {resultado.errores.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {resultado.errores.length} omitido{resultado.errores.length !== 1 ? 's' : ''} (ver detalle abajo)
                </p>
              )}
            </div>
          </div>

          {/* Error/skipped list */}
          {resultado.errores.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-xs font-semibold text-slate-700">
                  Productos omitidos ({resultado.errores.length})
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                {resultado.errores.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-xs font-medium text-slate-700 truncate">{e.nombre}</span>
                    <span className="text-xs text-amber-600 shrink-0">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import again */}
          <button
            onClick={reset}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Importar otro archivo
          </button>
        </div>
      )}

    </div>
  )
}
