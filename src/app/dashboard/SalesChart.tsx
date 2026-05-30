'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface ChartDay {
  fecha: string
  transacciones: number
  piezas: number
}

export default function SalesChart({ data }: { data: ChartDay[] }) {
  const hayData = data.some(d => d.transacciones > 0)

  if (!hayData) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-slate-400">
        Sin ventas en los últimos 7 días
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: 12,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [value, 'Ventas']}
          labelStyle={{ fontWeight: 600, color: '#1e293b' }}
        />
        <Bar dataKey="transacciones" fill="#7c3aed" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
