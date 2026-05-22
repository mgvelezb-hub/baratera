import { Clock } from 'lucide-react'

interface Props {
  modulo: string
  descripcion: string
  emoji: string
  features?: string[]
}

export default function ProximamenteCard({ modulo, descripcion, emoji, features }: Props) {
  return (
    <div className="flex-1 min-h-[calc(100vh-56px)] lg:min-h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-5xl mx-auto mb-6">
          {emoji}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">{modulo}</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{descripcion}</p>

        {features && features.length > 0 && (
          <ul className="text-left bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 mb-6 overflow-hidden">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span className="text-sm text-slate-600">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-5 py-2.5 rounded-full">
          <Clock className="w-4 h-4" />
          Estamos trabajando en ello
        </div>
      </div>
    </div>
  )
}
