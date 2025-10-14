/**
 * Chart utilities for report visualizations
 * Provides reusable charting components for PDF, PowerPoint, and HTML reports
 */

import type { ChartConfiguration } from 'chart.js'

export interface ChartColors {
  primary: string
  secondary: string
  success: string
  warning: string
  danger: string
  info: string
  neutral: string[]
}

export const defaultColors: ChartColors = {
  primary: '#1e3a8a', // blue-900
  secondary: '#7c3aed', // violet-600
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
  neutral: [
    '#94a3b8', // slate-400
    '#64748b', // slate-500
    '#475569', // slate-600
    '#334155', // slate-700
  ],
}

/**
 * Creates a 2x2 matrix configuration for frameworks like SWOT
 */
export function create2x2Matrix(
  quadrants: {
    topLeft: { label: string; items: string[]; color: string }
    topRight: { label: string; items: string[]; color: string }
    bottomLeft: { label: string; items: string[]; color: string }
    bottomRight: { label: string; items: string[]; color: string }
  },
  title?: string
): ChartConfiguration {
  // This returns a scatter plot configuration that creates a 2x2 matrix visual
  const datasets = [
    {
      label: quadrants.topLeft.label,
      data: quadrants.topLeft.items.map((_, i) => ({
        x: -0.5,
        y: 0.5 + i * 0.1,
      })),
      backgroundColor: quadrants.topLeft.color,
      pointRadius: 8,
    },
    {
      label: quadrants.topRight.label,
      data: quadrants.topRight.items.map((_, i) => ({
        x: 0.5,
        y: 0.5 + i * 0.1,
      })),
      backgroundColor: quadrants.topRight.color,
      pointRadius: 8,
    },
    {
      label: quadrants.bottomLeft.label,
      data: quadrants.bottomLeft.items.map((_, i) => ({
        x: -0.5,
        y: -0.5 - i * 0.1,
      })),
      backgroundColor: quadrants.bottomLeft.color,
      pointRadius: 8,
    },
    {
      label: quadrants.bottomRight.label,
      data: quadrants.bottomRight.items.map((_, i) => ({
        x: 0.5,
        y: -0.5 - i * 0.1,
      })),
      backgroundColor: quadrants.bottomRight.color,
      pointRadius: 8,
    },
  ]

  return {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: !!title,
          text: title,
          font: { size: 16, weight: 'bold' },
        },
        legend: {
          display: true,
          position: 'bottom',
        },
      },
      scales: {
        x: {
          min: -1,
          max: 1,
          grid: {
            lineWidth: 2,
          },
          border: {
            display: true,
            width: 2,
          },
          ticks: { display: false },
        },
        y: {
          min: -1,
          max: 1,
          grid: {
            lineWidth: 2,
          },
          border: {
            display: true,
            width: 2,
          },
          ticks: { display: false },
        },
      },
    },
  }
}

/**
 * Creates a radar chart configuration for multi-dimensional analysis
 */
export function createRadarChart(
  labels: string[],
  datasets: Array<{
    label: string
    data: number[]
    color: string
  }>,
  title?: string
): ChartConfiguration {
  return {
    type: 'radar',
    data: {
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.color + '40', // Add transparency
        borderColor: ds.color,
        borderWidth: 2,
        pointBackgroundColor: ds.color,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: ds.color,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: !!title,
          text: title,
          font: { size: 16, weight: 'bold' },
        },
        legend: {
          display: true,
          position: 'bottom',
        },
      },
      scales: {
        r: {
          angleLines: { display: true },
          suggestedMin: 0,
          suggestedMax: 10,
        },
      },
    },
  }
}

/**
 * Creates a bar chart configuration for comparative analysis
 */
export function createBarChart(
  labels: string[],
  datasets: Array<{
    label: string
    data: number[]
    color: string
  }>,
  options?: {
    title?: string
    horizontal?: boolean
    stacked?: boolean
  }
): ChartConfiguration {
  return {
    type: options?.horizontal ? 'bar' : 'bar',
    data: {
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.color,
        borderColor: ds.color,
        borderWidth: 1,
      })),
    },
    options: {
      indexAxis: options?.horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: !!options?.title,
          text: options?.title,
          font: { size: 16, weight: 'bold' },
        },
        legend: {
          display: true,
          position: 'bottom',
        },
      },
      scales: {
        x: {
          stacked: options?.stacked,
          grid: { display: true },
        },
        y: {
          stacked: options?.stacked,
          grid: { display: true },
        },
      },
    },
  }
}

/**
 * Creates a connection/network diagram data structure for COG analysis
 */
export interface NetworkNode {
  id: string
  label: string
  type: 'cog' | 'cc' | 'cr' | 'cv'
  x: number
  y: number
}

export interface NetworkEdge {
  from: string
  to: string
  label?: string
  strength?: number
}

export interface NetworkDiagram {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

/**
 * Generates SVG for a network diagram
 */
export function createNetworkDiagramSVG(
  diagram: NetworkDiagram,
  width: number = 600,
  height: number = 400
): string {
  const nodeColors = {
    cog: '#ef4444', // red-500
    cc: '#f59e0b', // amber-500
    cr: '#3b82f6', // blue-500
    cv: '#22c55e', // green-500
  }

  const nodes = diagram.nodes
    .map((node) => {
      const color = nodeColors[node.type]
      const x = node.x * width
      const y = node.y * height
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="30" fill="${color}" stroke="#1e293b" stroke-width="2"/>
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
            ${node.label}
          </text>
        </g>
      `
    })
    .join('')

  const edges = diagram.edges
    .map((edge) => {
      const from = diagram.nodes.find((n) => n.id === edge.from)
      const to = diagram.nodes.find((n) => n.id === edge.to)
      if (!from || !to) return ''

      const x1 = from.x * width
      const y1 = from.y * height
      const x2 = to.x * width
      const y2 = to.y * height

      const strokeWidth = edge.strength ? edge.strength * 3 : 2

      return `
        <line
          x1="${x1}"
          y1="${y1}"
          x2="${x2}"
          y2="${y2}"
          stroke="#64748b"
          stroke-width="${strokeWidth}"
          marker-end="url(#arrowhead)"
        />
        ${
          edge.label
            ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" fill="#334155" font-size="10">${edge.label}</text>`
            : ''
        }
      `
    })
    .join('')

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
        </marker>
      </defs>
      ${edges}
      ${nodes}
    </svg>
  `
}
