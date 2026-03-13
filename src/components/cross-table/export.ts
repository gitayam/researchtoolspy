/**
 * Client-side export functions for Cross Table.
 * PDF, Excel (XLSX), DOCX, PPTX — all generated in-browser.
 */

import type { CrossTable, Score, RowResult } from '@/lib/cross-table/types'
import { getWeights } from '@/lib/cross-table/engine/weighting'

// ── Helpers ─────────────────────────────────────────────────────

function rowLabel(table: CrossTable, rowId: string): string {
  return table.config.rows.find((r) => r.id === rowId)?.label ?? rowId
}

function colLabel(table: CrossTable, colId: string): string {
  return table.config.columns.find((c) => c.id === colId)?.label ?? colId
}

function getScoreValue(scores: Score[], rowId: string, colId: string): number | string | null {
  const s = scores.find((sc) => sc.row_id === rowId && sc.col_id === colId)
  return s?.score ?? null
}

// ── PDF Export ──────────────────────────────────────────────────

export async function exportPDF(
  table: CrossTable,
  scores: Score[],
  results: RowResult[]
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape' })

  const { rows, columns, weighting } = table.config
  const weights = getWeights(columns, weighting)
  const sortedRows = [...rows].sort((a, b) => a.order - b.order)
  const sortedCols = [...columns].sort((a, b) => a.order - b.order)

  // Title
  doc.setFontSize(16)
  doc.text(table.title, 14, 20)
  doc.setFontSize(10)
  doc.text(`Template: ${table.template_type} | Status: ${table.status}`, 14, 28)
  if (table.description) {
    doc.setFontSize(9)
    doc.text(table.description, 14, 34)
  }

  // Matrix table
  let y = 44
  const cellW = 22
  const headerH = 10
  const rowH = 8
  const labelW = 40

  doc.setFontSize(7)

  // Column headers
  doc.setFillColor(240, 240, 240)
  doc.rect(14, y, labelW, headerH, 'F')
  sortedCols.forEach((col, i) => {
    const x = 14 + labelW + i * cellW
    doc.rect(x, y, cellW, headerH, 'F')
    doc.text(col.label.slice(0, 12), x + 1, y + 6)
  })
  // Weight header
  doc.rect(14 + labelW + sortedCols.length * cellW, y, cellW, headerH, 'F')
  doc.text('Score', 14 + labelW + sortedCols.length * cellW + 1, y + 6)
  y += headerH

  // Data rows
  sortedRows.forEach((row) => {
    if (y > 180) {
      doc.addPage()
      y = 20
    }
    doc.text(row.label.slice(0, 20), 15, y + 5)
    sortedCols.forEach((col, i) => {
      const val = getScoreValue(scores, row.id, col.id)
      const x = 14 + labelW + i * cellW
      doc.rect(x, y, cellW, rowH)
      doc.text(val !== null ? String(val) : '--', x + 2, y + 5)
    })
    // Weighted total
    const result = results.find((r) => r.row_id === row.id)
    const totalX = 14 + labelW + sortedCols.length * cellW
    doc.rect(totalX, y, cellW, rowH)
    doc.text(result ? result.weighted_score.toFixed(3) : '--', totalX + 2, y + 5)
    y += rowH
  })

  // Rankings
  y += 10
  if (y > 170) {
    doc.addPage()
    y = 20
  }
  doc.setFontSize(12)
  doc.text('Rankings', 14, y)
  y += 8
  doc.setFontSize(9)
  results.forEach((r) => {
    doc.text(`#${r.rank}  ${rowLabel(table, r.row_id)}  —  ${r.weighted_score.toFixed(4)}`, 14, y)
    y += 6
  })

  doc.save(`${table.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}

// ── Excel Export ────────────────────────────────────────────────

export async function exportExcel(
  table: CrossTable,
  scores: Score[],
  results: RowResult[]
): Promise<void> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const { rows, columns, weighting } = table.config
  const weights = getWeights(columns, weighting)
  const sortedRows = [...rows].sort((a, b) => a.order - b.order)
  const sortedCols = [...columns].sort((a, b) => a.order - b.order)

  // Sheet 1: Matrix
  const ws1 = wb.addWorksheet('Matrix')
  ws1.addRow(['', ...sortedCols.map((c) => c.label), 'Weighted Score'])
  sortedRows.forEach((row) => {
    const result = results.find((r) => r.row_id === row.id)
    ws1.addRow([
      row.label,
      ...sortedCols.map((col) => {
        const val = getScoreValue(scores, row.id, col.id)
        return val !== null ? val : ''
      }),
      result?.weighted_score ?? '',
    ])
  })

  // Sheet 2: Weights
  const ws2 = wb.addWorksheet('Weights')
  ws2.addRow(['Criterion', 'Raw Weight', 'Normalized Weight'])
  sortedCols.forEach((col, i) => {
    ws2.addRow([col.label, col.weight, weights[i]])
  })
  ws2.addRow([])
  ws2.addRow(['Method', weighting.method])
  if (weighting.ahp_cr !== undefined) {
    ws2.addRow(['AHP CR', weighting.ahp_cr])
  }

  // Sheet 3: Results
  const ws3 = wb.addWorksheet('Results')
  ws3.addRow(['Rank', 'Alternative', 'Weighted Score', ...sortedCols.map((c) => `Norm: ${c.label}`)])
  results.forEach((r) => {
    ws3.addRow([
      r.rank,
      rowLabel(table, r.row_id),
      r.weighted_score,
      ...sortedCols.map((c) => r.normalized_scores[c.id] ?? 0),
    ])
  })

  // Sheet 4: Raw Scores
  const ws4 = wb.addWorksheet('Raw Scores')
  ws4.addRow(['Row', 'Column', 'Score', 'Confidence', 'Notes', 'User ID', 'Round'])
  scores.forEach((s) => {
    ws4.addRow([
      rowLabel(table, s.row_id),
      colLabel(table, s.col_id),
      s.score,
      s.confidence,
      s.notes ?? '',
      s.user_id,
      s.round,
    ])
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${table.title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
}

// ── DOCX Export ─────────────────────────────────────────────────

export async function exportDOCX(
  table: CrossTable,
  scores: Score[],
  results: RowResult[]
): Promise<void> {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer, Table: DocxTable, TableRow, TableCell, WidthType } = await import('docx')

  const { rows, columns, weighting } = table.config
  const weights = getWeights(columns, weighting)
  const sortedRows = [...rows].sort((a, b) => a.order - b.order)
  const sortedCols = [...columns].sort((a, b) => a.order - b.order)

  const children: (typeof Paragraph extends new (...args: any[]) => infer R ? R : never)[] = []

  // Title
  children.push(new Paragraph({ text: table.title, heading: HeadingLevel.TITLE }))
  if (table.description) {
    children.push(new Paragraph({ text: table.description }))
  }
  children.push(new Paragraph({ text: '' }))

  // Rankings section
  children.push(new Paragraph({ text: 'Rankings', heading: HeadingLevel.HEADING_1 }))
  results.forEach((r) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `#${r.rank} `, bold: true }),
          new TextRun({ text: `${rowLabel(table, r.row_id)} — Score: ${r.weighted_score.toFixed(4)}` }),
        ],
      })
    )
  })
  children.push(new Paragraph({ text: '' }))

  // Weights section
  children.push(new Paragraph({ text: 'Criterion Weights', heading: HeadingLevel.HEADING_1 }))
  children.push(new Paragraph({ text: `Method: ${weighting.method}` }))
  sortedCols.forEach((col, i) => {
    children.push(
      new Paragraph({
        text: `${col.label}: ${(weights[i] * 100).toFixed(1)}%`,
      })
    )
  })

  // Methodology
  children.push(new Paragraph({ text: '' }))
  children.push(new Paragraph({ text: 'Methodology', heading: HeadingLevel.HEADING_1 }))
  children.push(
    new Paragraph({
      text: `This analysis used a ${table.template_type} template with ${table.config.scoring.method} scoring. ${sortedRows.length} alternatives were evaluated against ${sortedCols.length} criteria using ${weighting.method} weighting.`,
    })
  )

  const doc = new Document({
    sections: [{ children }],
  })

  const buffer = await Packer.toBlob(doc)
  downloadBlob(buffer, `${table.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
}

// ── PPTX Export ─────────────────────────────────────────────────

export async function exportPPTX(
  table: CrossTable,
  scores: Score[],
  results: RowResult[]
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const { rows, columns, weighting } = table.config
  const weights = getWeights(columns, weighting)
  const sortedRows = [...rows].sort((a, b) => a.order - b.order)
  const sortedCols = [...columns].sort((a, b) => a.order - b.order)

  // Slide 1: Title
  const slide1 = pptx.addSlide()
  slide1.addText(table.title, { x: 1, y: 1.5, w: 11, h: 1.5, fontSize: 36, bold: true, color: '4F5BFF' })
  slide1.addText(table.description ?? '', { x: 1, y: 3, w: 11, h: 1, fontSize: 14, color: '666666' })
  slide1.addText(`Template: ${table.template_type} | ${sortedRows.length} alternatives | ${sortedCols.length} criteria`, {
    x: 1, y: 4, w: 11, h: 0.5, fontSize: 11, color: '999999',
  })

  // Slide 2: Matrix
  const slide2 = pptx.addSlide()
  slide2.addText('Decision Matrix', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 24, bold: true })
  const tableData = [
    [{ text: '', options: { bold: true } }, ...sortedCols.map((c) => ({ text: c.label.slice(0, 15), options: { bold: true, fontSize: 8 } }))],
    ...sortedRows.map((row) => [
      { text: row.label.slice(0, 20), options: { bold: true, fontSize: 8 } },
      ...sortedCols.map((col) => {
        const val = getScoreValue(scores, row.id, col.id)
        return { text: val !== null ? String(val) : '--', options: { fontSize: 8 } }
      }),
    ]),
  ]
  slide2.addTable(tableData as any, {
    x: 0.5, y: 1, w: 12, fontSize: 8,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
  })

  // Slide 3: Results chart (horizontal bar)
  const slide3 = pptx.addSlide()
  slide3.addText('Ranked Results', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 24, bold: true })
  slide3.addChart(pptx.ChartType.bar, [
    {
      name: 'Weighted Score',
      labels: results.map((r) => rowLabel(table, r.row_id)),
      values: results.map((r) => parseFloat(r.weighted_score.toFixed(4))),
    },
  ], {
    x: 0.5, y: 1, w: 12, h: 5.5,
    barDir: 'bar',
    showValue: true,
    chartColors: ['4F5BFF'],
  })

  // Slide 4: Weights
  const slide4 = pptx.addSlide()
  slide4.addText('Criterion Weights', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 24, bold: true })
  slide4.addChart(pptx.ChartType.bar, [
    {
      name: 'Weight (%)',
      labels: sortedCols.map((c) => c.label),
      values: weights.map((w) => parseFloat((w * 100).toFixed(1))),
    },
  ], {
    x: 0.5, y: 1, w: 12, h: 5.5,
    barDir: 'bar',
    showValue: true,
    chartColors: ['D4673A'],
  })

  // Slide 5: Findings
  const slide5 = pptx.addSlide()
  slide5.addText('Key Findings', { x: 0.5, y: 0.3, w: 12, h: 0.5, fontSize: 24, bold: true })
  const findings = [
    `Top-ranked: ${results.length > 0 ? rowLabel(table, results[0].row_id) : 'N/A'} (score: ${results[0]?.weighted_score.toFixed(4) ?? 'N/A'})`,
    `${sortedRows.length} alternatives evaluated against ${sortedCols.length} criteria`,
    `Weighting method: ${weighting.method}${weighting.ahp_cr !== undefined ? ` (CR: ${(weighting.ahp_cr * 100).toFixed(1)}%)` : ''}`,
    `Scoring method: ${table.config.scoring.method}`,
  ]
  findings.forEach((f, i) => {
    slide5.addText(f, { x: 1, y: 1.5 + i * 0.7, w: 11, h: 0.5, fontSize: 16, bullet: true })
  })

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  downloadBlob(blob, `${table.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`)
}

// ── Download helper ─────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
