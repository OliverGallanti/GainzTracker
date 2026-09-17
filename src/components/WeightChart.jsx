import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'

// Chart chrome mapped to the app's existing Tailwind neutral scale rather than
// Recharts' bright defaults — a single series needs no legend (the card title
// already says what's plotted), so the only color decision is the line itself
// (white, matching the app's primary-ink accent) against recessive gridlines.
const GRID_COLOR = '#262626' // neutral-800
const AXIS_COLOR = '#737373' // neutral-500
const LINE_COLOR = '#ffffff'
const TOOLTIP_BG = '#171717' // neutral-900, solid (not the card's translucent bg)
const TOOLTIP_BORDER = '#404040' // neutral-700

function formatDateTick(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="text-neutral-400">{formatDateTick(label)}</p>
      <p className="font-semibold text-white">{payload[0].value.toFixed(1)} kg</p>
    </div>
  )
}

function WeightChart() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    api('/api/weights').then((data) => {
      setEntries([...data].sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt)))
    })
  }, [])

  const isLoading = entries === null
  const isEmpty = entries?.length === 0

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <h2 className="mb-4 text-sm font-semibold text-white">Weight</h2>

      {isLoading && <p className="text-xs text-neutral-500">Loading…</p>}
      {isEmpty && <p className="text-xs text-neutral-500">No weight entries logged yet.</p>}

      {!isLoading && !isEmpty && (
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={entries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="loggedAt"
                tickFormatter={formatDateTick}
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                minTickGap={32}
              />
              <YAxis
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip content={<TooltipContent />} cursor={{ stroke: GRID_COLOR }} />
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 4, fill: LINE_COLOR, stroke: '#171717', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: LINE_COLOR, stroke: '#171717', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default WeightChart
