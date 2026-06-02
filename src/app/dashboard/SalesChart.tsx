'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface ChartDay {
  fecha:         string
  ingresos:      number
  transacciones: number
}

function formatMXN(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

export default function SalesChart({ data }: { data: ChartDay[] }) {
  const hayData = data.some(d => d.ingresos > 0 || d.transacciones > 0)

  if (!hayData) {
    return (
      <div className="flex flex-col items-center justify-center h-44 text-sm text-slate-400 gap-2">
        <span className="text-2xl">📊</span>
        Sin ventas en los últimos 7 días
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="gradOnline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.08} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => v === 0 ? '0' : `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={36}
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
          formatter={(value: any, name: any) => [
            name === 'ingresos' ? formatMXN(Number(value)) : value,
            name === 'ingresos' ? 'POS' : 'Mov.',
          ]}
          labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}
        />

        {/* POS — filled area */}
        <Area
          type="monotone"
          dataKey="ingresos"
          stroke="#7c3aed"
          strokeWidth={2}
          fill="url(#gradIngresos)"
          dot={false}
          activeDot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
