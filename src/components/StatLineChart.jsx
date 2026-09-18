import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Chart chrome mapped to the app's theme tokens (index.css) rather than
// Recharts' bright defaults — resolved to plain hex (not CSS var references)
// since Recharts renders these as SVG attributes, which don't resolve var().
const GRID_COLOR = '#244a55' // secondary blended ~25% into main — matches border-secondary/25
const AXIS_COLOR = '#869b9e' // third blended ~60% into main — matches text-third/60
const LINE_COLOR = '#dce0d9' // third
const TOOLTIP_BG = '#16495d' // card, solid (not the card's translucent bg)
const TOOLTIP_BORDER = '#40656d' // secondary blended ~40% into card — matches border-secondary/40

function formatDateTick(iso, showYear) {
  return new Date(iso).toLocaleDateString(
    undefined,
    showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' },
  )
}

function TooltipContent({ active, payload, label, unit, decimals }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: TOOLTIP_BG, borderColor: TOOLTIP_BORDER }}
    >
      <p className="text-third/60">{formatDateTick(label, true)}</p>
      <p className="font-semibold text-third">
        {payload[0].value.toFixed(decimals)} {unit}
      </p>
    </div>
  )
}

// A generic single-series time chart with an optional goal reference line —
// shared by the weight/body-fat charts and the Big 4 lift-progression chart
// so this logic (and the reasoning below) only lives in one place.
//
// Never a dual-axis chart: two series with different units/scales get two
// of these stacked, not one chart with two y-axes (see WeightChart). Always
// a real time-scaled x-axis (numeric domain in ms, not Recharts' default
// category axis, which spaces points evenly by array index and would
// silently misalign multiple panels sharing an `xDomain`).
//
// `data`: [{ loggedAt: ISOString, value: number }], ascending by loggedAt.
export function StatLineChart({ data, unit, goal, xDomain, decimals = 1 }) {
  // The default 'dataMin'/'dataMax' domain only looks at plotted points, so a
  // goal reference line outside that range would render off-screen. Compute
  // the domain from both the data AND the goal so it's always on-screen.
  const values = data.map((d) => d.value).filter((v) => v != null)
  const allValues = goal != null ? [...values, goal] : values
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const padding = Math.max((max - min) * 0.1, 1)
  const yDomain = [Math.floor(min - padding), Math.ceil(max + padding)]

  // Ambiguous "Sep 17" ticks read fine within one year but not across a
  // multi-year range, so only pay for the wider "Sep '26" label when needed.
  const showYear = new Set(data.map((d) => new Date(d.loggedAt).getFullYear())).size > 1

  return (
    <div className="h-40 sm:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey={(d) => new Date(d.loggedAt).getTime()}
            type="number"
            domain={xDomain ?? ['dataMin', 'dataMax']}
            tickFormatter={(v) => formatDateTick(v, showYear)}
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
            domain={yDomain}
          />
          <Tooltip content={<TooltipContent unit={unit} decimals={decimals} />} cursor={{ stroke: GRID_COLOR }} />
          {goal != null && (
            <ReferenceLine
              y={goal}
              stroke={AXIS_COLOR}
              strokeDasharray="4 4"
              label={{ value: 'Goal', position: 'insideTopRight', fill: AXIS_COLOR, fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: LINE_COLOR, stroke: TOOLTIP_BG, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: LINE_COLOR, stroke: TOOLTIP_BG, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
