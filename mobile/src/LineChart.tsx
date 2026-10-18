import { useState } from 'react'
import { View } from 'react-native'
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { chartYDomain } from '@gainz/shared/chart'
import { colors } from './theme'

const HEIGHT = 180
const PAD = { left: 40, right: 12, top: 12, bottom: 22 }
const GOAL_COLOR = '#facc15' // same yellow as the web goal line
const GRID_COLOR = 'rgba(128, 143, 133, 0.25)'
const LABEL_COLOR = 'rgba(220, 224, 217, 0.6)'

type Point = { loggedAt: string; value: number }

const shortDate = (time: number) => new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// A small single-series progress chart: the web StatLineChart's rules (real time
// axis, y range that keeps the goal and reference lines on screen) without a
// chart library. `data` ascending by loggedAt. Screen readers get a one-line
// summary instead of the drawing.
export default function LineChart({
  data,
  unit,
  goal,
  referenceLines = [],
  label,
}: {
  data: Point[]
  unit: string
  goal?: number | null
  referenceLines?: { label: string; value: number }[]
  label: string
}) {
  const [width, setWidth] = useState(0)
  const domain = chartYDomain(
    data.map((d) => d.value),
    [...(goal != null ? [goal] : []), ...referenceLines.map((r) => r.value)],
  )
  if (data.length === 0 || !domain) return null

  const times = data.map((d) => new Date(d.loggedAt).getTime())
  const [t0, t1] = [Math.min(...times), Math.max(...times)]
  const [y0, y1] = domain
  const plotW = Math.max(width - PAD.left - PAD.right, 1)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  // A single point (or all on one day) sits in the middle instead of dividing by zero.
  const x = (t: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * plotH
  const ticks = [y0, Math.round((y0 + y1) / 2), y1]

  const first = data[0]
  const last = data[data.length - 1]
  const summary =
    `${label}: ${data.length} ${data.length === 1 ? 'entry' : 'entries'}, from ${first.value} ${unit} on ${shortDate(t0)} ` +
    `to ${last.value} ${unit} on ${shortDate(t1)}` +
    (goal != null ? `, goal ${goal} ${unit}` : '')

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={{ height: HEIGHT }}
    >
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID_COLOR} />
          ))}
          {ticks.map((tick) => (
            <SvgText key={`t${tick}`} x={PAD.left - 6} y={y(tick) + 4} fill={LABEL_COLOR} fontSize={10} textAnchor="end">
              {tick}
            </SvgText>
          ))}

          {referenceLines.map((ref) => (
            <Line key={ref.label} x1={PAD.left} x2={width - PAD.right} y1={y(ref.value)} y2={y(ref.value)} stroke={GRID_COLOR} strokeDasharray="2 4" />
          ))}
          {referenceLines.map((ref) => (
            <SvgText key={`l${ref.label}`} x={PAD.left + 4} y={y(ref.value) - 3} fill={LABEL_COLOR} fontSize={9}>
              {ref.label}
            </SvgText>
          ))}

          {goal != null && (
            <>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(goal)} y2={y(goal)} stroke={GOAL_COLOR} strokeDasharray="5 4" />
              <SvgText x={width - PAD.right} y={y(goal) - 4} fill={GOAL_COLOR} fontSize={10} textAnchor="end">
                Goal
              </SvgText>
            </>
          )}

          <Polyline
            points={data.map((d, i) => `${x(times[i])},${y(d.value)}`).join(' ')}
            fill="none"
            stroke={colors.text}
            strokeWidth={2}
          />
          {data.map((d, i) => (
            <Circle key={i} cx={x(times[i])} cy={y(d.value)} r={3} fill={colors.text} />
          ))}

          <SvgText x={PAD.left} y={HEIGHT - 6} fill={LABEL_COLOR} fontSize={10}>
            {shortDate(t0)}
          </SvgText>
          {t1 !== t0 && (
            <SvgText x={width - PAD.right} y={HEIGHT - 6} fill={LABEL_COLOR} fontSize={10} textAnchor="end">
              {shortDate(t1)}
            </SvgText>
          )}
        </Svg>
      )}
    </View>
  )
}
