"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { SeriesPoint } from "@/lib/types"

// Small, dependency-free SVG charts. They scale uniformly to their container
// via a fixed viewBox, so strokes never distort.

function buildPath(
  values: number[],
  w: number,
  h: number,
  pad: number,
): { line: string; area: string; points: { x: number; y: number }[] } {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(values.length - 1, 1)
  const points = values.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + (h - pad * 2) * (1 - (v - min) / range),
  }))
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")
  const area =
    `${line} L${points[points.length - 1].x.toFixed(1)},${h - pad} ` +
    `L${points[0].x.toFixed(1)},${h - pad} Z`
  return { line, area, points }
}

export function AreaChart({
  data,
  color = "var(--primary)",
  className,
  showDots = false,
}: {
  data: SeriesPoint[]
  color?: string
  className?: string
  showDots?: boolean
}) {
  const id = React.useId().replace(/:/g, "")
  const w = 600
  const h = 200
  const pad = 6
  const { line, area, points } = buildPath(
    data.map((d) => d.value),
    w,
    h,
    pad,
  )
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#area-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDots &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  )
}

export function Sparkline({
  data,
  color = "var(--primary)",
  className,
}: {
  data: number[]
  color?: string
  className?: string
}) {
  const w = 120
  const h = 32
  const { line } = buildPath(data, w, h, 2)
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-8 w-full", className)}
      preserveAspectRatio="none"
    >
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function BarChart({
  data,
  className,
}: {
  data: { label: string; value: number; color?: string }[]
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className={cn("flex h-full items-end gap-2", className)}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, 2)}%`,
                backgroundColor: d.color ?? "var(--primary)",
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-muted-foreground truncate text-[11px]">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({
  segments,
  size = 160,
  thickness = 22,
  className,
  centerLabel,
  centerSub,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  className?: string
  centerLabel?: string
  centerSub?: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={thickness}
        />
        {segments.map((seg) => {
          const fraction = seg.value / total
          const dash = fraction * circumference
          const el = (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </circle>
          )
          offset += dash
          return el
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="text-2xl font-semibold tracking-tight">
              {centerLabel}
            </span>
          )}
          {centerSub && (
            <span className="text-muted-foreground text-xs">{centerSub}</span>
          )}
        </div>
      )}
    </div>
  )
}
