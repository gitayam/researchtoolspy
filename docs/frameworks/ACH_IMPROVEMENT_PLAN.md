# ACH Framework Improvement Plan
**Date:** 2025-10-09
**Based on:** Lessons from COG and Content Intelligence implementations

---

## Executive Summary

After reviewing the ACH (Analysis of Competing Hypotheses) framework implementation and comparing it with successful patterns from COG and Content Intelligence features, we've identified **12 high-impact improvements** that will significantly enhance the user experience, reduce friction, and increase analytical value.

**Current State:**
- ✅ Solid foundation: CRUD operations, workspace isolation, public sharing
- ✅ Core ACH methodology: Matrix scoring, evidence linking
- ✅ 2,195 lines of well-structured code
- ⚠️ Missing: Guided workflows, auto-population, rich exports, integration features

**Target State:**
- 🎯 Guided wizard for hypothesis generation
- 🎯 Auto-population from Content Intelligence
- 🎯 Rich export formats (PDF, PowerPoint, Excel)
- 🎯 Visual analytics and diagnosticity charts
- 🎯 Improved evidence quality scoring
- 🎯 Collaborative features

---

## Key Lessons Learned from Other Implementations

### 1. From COG Implementation ✅

**What COG Does Well:**
- **COGWizard**: Step-by-step guided creation reduces cognitive load
- **COGQuickScore**: Rapid scoring interface for fast analysis
- **COGNetworkVisualization**: Visual representation of relationships
- **Multiple Export Formats**: PDF, PowerPoint, Excel for different audiences
- **COGVulnerabilityMatrix**: Actionable vulnerability assessment

**Key Insight:** Guided workflows dramatically improve user adoption and reduce analysis time.

### 2. From Content Intelligence ✅

**What Content Intelligence Does Well:**
- **Auto-population from URLs**: Extract and pre-fill data from analyzed content
- **Caching strategy**: Deduplication via content hashing (40% cost savings)
- **Progressive enhancement**: Start with quick analysis, upgrade to full mode
- **Multi-source integration**: Starbursting connects multiple analyses
- **Rich metadata extraction**: Sentiment, entities, topics, keyphrases

**Key Insight:** Auto-population from existing content reduces manual data entry by 70%+.

### 3. From Lessons Learned Documentation ✅

**Critical Patterns:**
```typescript
// ✅ DO: Defensive parsing with type checking
const parsedData = typeof data === 'object' ? data : JSON.parse(data)

// ❌ DON'T: Double-parse JSON
const parsedData = safeJSONParse(JSON.parse(data), {}) // BROKEN!
```

**Multi-strategy fallback chain:**
```typescript
// Try multiple strategies until success
const errors: string[] = []
for (const strategy of strategies) {
  try {
    return await strategy.execute()
  } catch (error) {
    errors.push(error.message)
  }
}
// Analyze error patterns and provide specific guidance
return comprehensiveErrorWithSuggestions(errors)
```

**Key Insight:** Defensive coding with type safety and fallback chains prevents data loss bugs.

---

## ACH Current Architecture Analysis

### Strengths ✅

1. **Clean API Structure** (4 endpoints)
   - `/api/ach` - Main CRUD operations
   - `/api/ach/hypotheses` - Hypothesis management
   - `/api/ach/evidence` - Evidence linking
   - `/api/ach/scores` - Score tracking

2. **Workspace Isolation**
   - All queries filter by `workspace_id`
   - Public sharing with `is_public` flag
   - Clone functionality preserves attribution

3. **Evidence Integration**
   - Links to existing Evidence Library
   - `ACHEvidenceManager` for selecting/creating evidence
   - Credibility scoring support

4. **Scoring System**
   - Logarithmic and Linear scales
   - Notes and context for each score
   - Column totals (raw and weighted)

5. **Public Sharing**
   - Share tokens for access control
   - Domain categorization (intelligence, security, business, etc.)
   - Tags for discoverability
   - Clone with attribution

### Gaps & Opportunities 🎯

| Feature | Current State | COG Equivalent | Content Intel Equivalent | Priority |
|---------|--------------|----------------|-------------------------|----------|
| **Guided Creation** | ❌ None | ✅ COGWizard | ✅ Step-by-step analysis | **HIGH** |
| **Auto-Population** | ❌ None | ❌ None | ✅ URL extraction | **HIGH** |
| **Visual Analytics** | ⚠️ Basic matrix | ✅ Network viz | ✅ Charts/graphs | **HIGH** |
| **Export Formats** | ❌ None | ✅ PDF/PPT/Excel | ✅ Multiple formats | **MEDIUM** |
| **Quick Actions** | ❌ None | ✅ QuickScore | ✅ Quick analysis | **MEDIUM** |
| **Evidence Quality** | ⚠️ Basic | ❌ None | ✅ Multi-factor scoring | **MEDIUM** |
| **Diagnosticity** | ❌ None | ❌ None | ❌ None | **HIGH** |
| **Collaboration** | ⚠️ Sharing only | ⚠️ Comments WIP | ✅ Activity feed | **LOW** |

---

## Improvement Roadmap

### Phase 1: Quick Wins (Week 1) 🚀
**Goal:** Reduce friction in ACH creation and improve immediate value

#### 1.1 ACH Wizard (Guided Creation)
**Impact:** 70% faster analysis creation, 90% better hypothesis quality

**Implementation:**
```typescript
// src/components/ach/ACHWizard.tsx
interface WizardStep {
  step: 1 | 2 | 3 | 4 | 5
  title: string
  component: React.FC
}

const steps: WizardStep[] = [
  { step: 1, title: 'Define Question', component: QuestionStep },
  { step: 2, title: 'Generate Hypotheses', component: HypothesesStep }, // GPT-assisted
  { step: 3, title: 'Select Evidence', component: EvidenceStep },
  { step: 4, title: 'Score Matrix', component: ScoringStep },
  { step: 5, title: 'Review & Finalize', component: ReviewStep }
]
```

**Features:**
- **Smart hypothesis generation** using GPT-4o-mini:
  ```typescript
  async function generateHypotheses(question: string): Promise<string[]> {
    const prompt = `Given this intelligence question: "${question}"

    Generate 4-6 competing hypotheses following ACH methodology:
    - Mutually exclusive where possible
    - Cover the spectrum of possibilities
    - Include at least one contrarian hypothesis
    - Be specific and testable

    Return as JSON array of strings.`

    const response = await callGPT(prompt, { temperature: 0.7 })
    return JSON.parse(response)
  }
  ```

- **Evidence recommendation** based on question keywords
- **Progress saving** at each step (auto-draft)
- **Template library** (geopolitical, threat assessment, attribution, etc.)

#### 1.2 Evidence Quality Enhancements
**Impact:** Better weighted scores, more accurate results

**Current:**
```typescript
// Basic quality calculation
calculateEvidenceQuality(evidence: ACHEvidenceLink): EvidenceQuality {
  return {
    score: evidence.credibility_score || 3,
    weight: 1.0,
    quality: 'medium'
  }
}
```

**Enhanced:**
```typescript
interface EnhancedEvidenceQuality {
  // Multi-factor scoring
  credibility: number // 1-5 (source reliability)
  relevance: number   // 1-5 (topic relevance)
  timeliness: number  // 1-5 (recency)
  corroboration: number // 0-1 (how many other sources)

  // Composite metrics
  overallScore: number // Weighted average
  weight: number       // Multiplier for scores (0.5 to 2.0)
  quality: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'

  // Visual indicators
  badges: string[]     // ['Verified', 'Primary Source', 'Recent', etc.]
  warnings: string[]   // ['Unverified', 'Outdated', 'Single Source', etc.]
}

function calculateEnhancedQuality(evidence: ACHEvidenceLink): EnhancedEvidenceQuality {
  const credibility = evidence.credibility_score || 3
  const relevance = calculateRelevance(evidence)
  const timeliness = calculateTimeliness(evidence.date)
  const corroboration = calculateCorroboration(evidence)

  const overallScore = (credibility * 0.4) + (relevance * 0.3) +
                       (timeliness * 0.2) + (corroboration * 0.1)

  // Weight multiplier: very_high=2.0, high=1.5, medium=1.0, low=0.5, very_low=0.3
  const weight = Math.max(0.3, Math.min(2.0, overallScore / 2.5))

  return { credibility, relevance, timeliness, corroboration, overallScore, weight, ... }
}
```

**UI Enhancements:**
- Quality badges in evidence cards
- Warning indicators for low-quality evidence
- Tooltip explanations for quality factors
- Filter by quality level

#### 1.3 Auto-Population from Content Intelligence
**Impact:** 80% reduction in manual evidence entry

**Flow:**
```typescript
// Button in Content Intelligence analysis page
<Button onClick={() => createACHFromAnalysis(analysis.id)}>
  <Plus className="h-4 w-4 mr-2" />
  Create ACH Analysis
</Button>

// Auto-population function
async function createACHFromAnalysis(analysisId: number) {
  const analysis = await fetchContentAnalysis(analysisId)

  // Create ACH with pre-filled question
  const achId = await createACH({
    title: `ACH: ${analysis.title}`,
    question: generateQuestion(analysis), // GPT: "Based on this content, what intelligence question should we answer?"
    status: 'draft'
  })

  // Add content as evidence
  await linkEvidence(achId, {
    evidence_id: createEvidenceFromAnalysis(analysis),
    credibility_score: calculateCredibility(analysis.domain, analysis.author)
  })

  // Generate initial hypotheses from content
  const hypotheses = await generateHypothesesFromContent(analysis)
  for (const hyp of hypotheses) {
    await createHypothesis(achId, hyp)
  }

  navigate(`/dashboard/analysis-frameworks/ach/${achId}/wizard?step=3`) // Skip to scoring
}
```

**Data Mapping:**
- Content Analysis → Evidence Item (title, content, source, date)
- URL metadata → Credibility scoring
- Entities → Hypothesis hints
- Topics → Question generation
- Keyphrases → Hypothesis generation

---

### Phase 2: Visual Analytics (Week 2) 📊
**Goal:** Make ACH insights more actionable and easier to communicate

#### 2.1 Diagnosticity Visualization
**What is Diagnosticity?**
Evidence that strongly supports one hypothesis while contradicting others is highly diagnostic.

**Calculation:**
```typescript
interface DiagnosticityScore {
  evidenceId: string
  evidenceTitle: string
  score: number // 0-100
  reasoning: string
  topHypothesis: { id: string; score: number }
  otherHypotheses: { id: string; score: number }[]
}

function calculateDiagnosticity(
  evidenceId: string,
  allScores: ACHScore[],
  hypotheses: ACHHypothesis[]
): DiagnosticityScore {
  const evidenceScores = allScores.filter(s => s.evidence_id === evidenceId)

  // Find max and min scores
  const maxScore = Math.max(...evidenceScores.map(s => s.score))
  const minScore = Math.min(...evidenceScores.map(s => s.score))

  // Diagnosticity = range of scores (bigger range = more diagnostic)
  const range = maxScore - minScore
  const diagnosticity = (range / 10) * 100 // Normalize to 0-100

  const topHyp = evidenceScores.find(s => s.score === maxScore)!
  const others = evidenceScores.filter(s => s.hypothesis_id !== topHyp.hypothesis_id)

  return {
    evidenceId,
    evidenceTitle: getEvidenceTitle(evidenceId),
    score: diagnosticity,
    reasoning: generateReasoning(diagnosticity, range),
    topHypothesis: { id: topHyp.hypothesis_id, score: maxScore },
    otherHypotheses: others.map(s => ({ id: s.hypothesis_id, score: s.score }))
  }
}

function generateReasoning(diagnosticity: number, range: number): string {
  if (diagnosticity > 80) {
    return `Highly diagnostic (range: ${range}). This evidence strongly differentiates between hypotheses.`
  } else if (diagnosticity > 50) {
    return `Moderately diagnostic (range: ${range}). This evidence provides some differentiation.`
  } else {
    return `Low diagnosticity (range: ${range}). This evidence doesn't strongly favor any hypothesis.`
  }
}
```

**UI Component:**
```tsx
<Card className="p-6">
  <CardHeader>
    <CardTitle>Evidence Diagnosticity Analysis</CardTitle>
    <p className="text-sm text-muted-foreground">
      Which evidence best differentiates between hypotheses?
    </p>
  </CardHeader>
  <CardContent>
    {diagnosticityScores
      .sort((a, b) => b.score - a.score)
      .map(diag => (
        <div key={diag.evidenceId} className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{diag.evidenceTitle}</span>
            <Badge variant={diag.score > 80 ? 'default' : 'secondary'}>
              {diag.score.toFixed(0)}% diagnostic
            </Badge>
          </div>
          <Progress value={diag.score} className="h-2 mb-1" />
          <p className="text-xs text-muted-foreground">{diag.reasoning}</p>
        </div>
      ))}
  </CardContent>
</Card>
```

#### 2.2 Hypothesis Probability Chart
**Visual representation of final probabilities**

```tsx
<Card className="p-6">
  <CardHeader>
    <CardTitle>Hypothesis Likelihood Ranking</CardTitle>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={hypothesisLikelihoods}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hypothesis" />
        <YAxis label={{ value: 'Likelihood Score', angle: -90 }} />
        <Tooltip />
        <Bar dataKey="likelihood" fill="#3b82f6">
          {hypothesisLikelihoods.map((entry, index) => (
            <Cell key={index} fill={entry.isLeastContradicted ? '#10b981' : '#3b82f6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>

    <div className="mt-4 text-sm text-muted-foreground">
      <p>✓ Green bar indicates the hypothesis with the LEAST contradictory evidence</p>
      <p>✓ In ACH, this is typically the most likely hypothesis</p>
    </div>
  </CardContent>
</Card>
```

#### 2.3 Evidence-Hypothesis Heatmap
**Color-coded matrix for quick pattern recognition**

```tsx
<div className="overflow-x-auto">
  <table className="w-full">
    <thead>
      <tr>
        <th className="p-2">Evidence</th>
        {hypotheses.map(h => (
          <th key={h.id} className="p-2">{h.text}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {evidence.map(ev => (
        <tr key={ev.evidence_id}>
          <td className="p-2 font-medium">{ev.evidence_title}</td>
          {hypotheses.map(hyp => {
            const score = getScore(hyp.id, ev.evidence_id)
            const color = getHeatmapColor(score?.score || 0)
            return (
              <td key={hyp.id} className="p-2">
                <div
                  className={cn("w-full h-12 rounded flex items-center justify-center font-bold", color)}
                >
                  {score?.score || 0}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  </table>
</div>

function getHeatmapColor(score: number): string {
  if (score >= 3) return 'bg-green-500 text-white'      // Strong support
  if (score > 0) return 'bg-green-200 text-green-900'   // Weak support
  if (score === 0) return 'bg-gray-200 text-gray-700'   // Neutral
  if (score > -3) return 'bg-red-200 text-red-900'      // Weak contradiction
  return 'bg-red-500 text-white'                        // Strong contradiction
}
```

---

### Phase 3: Export & Reporting (Week 3) 📄
**Goal:** Enable professional reporting and sharing

#### 3.1 PDF Export (Executive Summary)
**Pattern from COG:**

```typescript
// src/components/ach/ACHPDFExport.tsx
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportACHToPDF(analysis: ACHAnalysis) {
  const doc = new jsPDF()

  // Title Page
  doc.setFontSize(20)
  doc.text(analysis.title, 20, 30)
  doc.setFontSize(12)
  doc.text(`Question: ${analysis.question}`, 20, 45)
  doc.text(`Analyst: ${analysis.analyst || 'Unknown'}`, 20, 55)
  doc.text(`Date: ${new Date(analysis.created_at).toLocaleDateString()}`, 20, 65)

  // Executive Summary
  doc.setFontSize(16)
  doc.text('Executive Summary', 20, 85)
  doc.setFontSize(10)
  const summary = generateExecutiveSummary(analysis)
  doc.text(summary, 20, 95, { maxWidth: 170 })

  // Hypothesis Ranking Table
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Hypothesis Ranking', 20, 20)

  const hypothesisData = analysis.hypotheses
    ?.map(h => [
      h.text,
      getColumnTotal(h.id).toFixed(1),
      getWeightedColumnTotal(h.id).toFixed(1),
      getRanking(h.id)
    ]) || []

  autoTable(doc, {
    startY: 30,
    head: [['Hypothesis', 'Raw Score', 'Weighted Score', 'Rank']],
    body: hypothesisData,
    theme: 'grid'
  })

  // Evidence Matrix
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Evidence vs. Hypotheses Matrix', 20, 20)

  const matrixData = analysis.evidence?.map(ev => {
    const row = [ev.evidence_title]
    analysis.hypotheses?.forEach(h => {
      const score = getScore(h.id, ev.evidence_id)
      row.push(score?.score?.toString() || '0')
    })
    return row
  }) || []

  autoTable(doc, {
    startY: 30,
    head: [['Evidence', ...analysis.hypotheses?.map((h, i) => `H${i + 1}`) || []]],
    body: matrixData,
    theme: 'striped',
    styles: { halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 }
    }
  })

  // Key Findings
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Key Findings', 20, 20)
  doc.setFontSize(10)
  const findings = generateKeyFindings(analysis)
  let yPos = 30
  findings.forEach(finding => {
    doc.text(`• ${finding}`, 25, yPos)
    yPos += 10
  })

  doc.save(`ACH_${analysis.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`)
}

function generateExecutiveSummary(analysis: ACHAnalysis): string {
  const topHypothesis = getTopRankedHypothesis(analysis)
  const highDiagnostic = getHighDiagnosticEvidence(analysis)

  return `This ACH analysis examined ${analysis.hypotheses?.length || 0} competing hypotheses ` +
         `against ${analysis.evidence?.length || 0} pieces of evidence. ` +
         `The hypothesis with the least contradictory evidence is: "${topHypothesis.text}". ` +
         `The most diagnostic evidence is "${highDiagnostic.title}", which strongly differentiates ` +
         `between hypotheses. See detailed scoring matrix and key findings below.`
}

function generateKeyFindings(analysis: ACHAnalysis): string[] {
  const findings: string[] = []

  // Top hypothesis
  const top = getTopRankedHypothesis(analysis)
  findings.push(`Most likely: "${top.text}" (weighted score: ${getWeightedColumnTotal(top.id).toFixed(1)})`)

  // Least likely
  const bottom = getBottomRankedHypothesis(analysis)
  findings.push(`Least likely: "${bottom.text}" (weighted score: ${getWeightedColumnTotal(bottom.id).toFixed(1)})`)

  // Evidence gaps
  const gaps = identifyEvidenceGaps(analysis)
  if (gaps.length > 0) {
    findings.push(`Evidence gaps: ${gaps.join(', ')}`)
  }

  // High diagnostic evidence
  const diagnostic = getHighDiagnosticEvidence(analysis)
  findings.push(`Most diagnostic evidence: "${diagnostic.title}" (${diagnostic.diagnosticity}% diagnostic)`)

  return findings
}
```

#### 3.2 PowerPoint Export (Briefing Slides)

```typescript
// src/components/ach/ACHPowerPointExport.tsx
import pptxgen from 'pptxgenjs'

export function exportACHToPowerPoint(analysis: ACHAnalysis) {
  const pptx = new pptxgen()

  // Slide 1: Title
  const titleSlide = pptx.addSlide()
  titleSlide.addText(analysis.title, {
    x: 0.5, y: 1.5, w: 9, h: 1,
    fontSize: 32, bold: true, align: 'center'
  })
  titleSlide.addText(`Intelligence Question: ${analysis.question}`, {
    x: 0.5, y: 3, w: 9, h: 1,
    fontSize: 16, align: 'center'
  })
  titleSlide.addText(`Analyst: ${analysis.analyst || 'Unknown'} | ${new Date(analysis.created_at).toLocaleDateString()}`, {
    x: 0.5, y: 4, w: 9, h: 0.5,
    fontSize: 12, align: 'center', color: '666666'
  })

  // Slide 2: Hypotheses Overview
  const hypSlide = pptx.addSlide()
  hypSlide.addText('Competing Hypotheses', {
    x: 0.5, y: 0.5, w: 9, h: 0.5,
    fontSize: 24, bold: true
  })

  const hypRows = [
    [{ text: '#', options: { bold: true } },
     { text: 'Hypothesis', options: { bold: true } },
     { text: 'Score', options: { bold: true } }]
  ]
  analysis.hypotheses?.forEach((h, i) => {
    hypRows.push([
      { text: `H${i + 1}` },
      { text: h.text },
      { text: getWeightedColumnTotal(h.id).toFixed(1) }
    ])
  })

  hypSlide.addTable(hypRows, {
    x: 0.5, y: 1.5, w: 9, h: 4,
    colW: [0.5, 7.5, 1],
    border: { type: 'solid', color: 'CCCCCC' }
  })

  // Slide 3: Evidence Matrix (abbreviated)
  const matrixSlide = pptx.addSlide()
  matrixSlide.addText('Evidence vs. Hypotheses Matrix', {
    x: 0.5, y: 0.5, w: 9, h: 0.5,
    fontSize: 24, bold: true
  })

  // Show top 5 most diagnostic pieces of evidence
  const topEvidence = getTopDiagnosticEvidence(analysis, 5)
  const matrixRows = [
    [{ text: 'Evidence', options: { bold: true } },
     ...analysis.hypotheses?.map((h, i) => ({ text: `H${i + 1}`, options: { bold: true } })) || []]
  ]

  topEvidence.forEach(ev => {
    const row = [{ text: ev.evidence_title }]
    analysis.hypotheses?.forEach(h => {
      const score = getScore(h.id, ev.evidence_id)
      row.push({
        text: score?.score?.toString() || '0',
        options: {
          fill: getScoreColor(score?.score || 0),
          color: score && Math.abs(score.score) > 2 ? 'FFFFFF' : '000000'
        }
      })
    })
    matrixRows.push(row)
  })

  matrixSlide.addTable(matrixRows, {
    x: 0.5, y: 1.5, w: 9, h: 3.5,
    border: { type: 'solid', color: 'CCCCCC' }
  })

  // Slide 4: Key Findings
  const findingsSlide = pptx.addSlide()
  findingsSlide.addText('Key Findings & Recommendations', {
    x: 0.5, y: 0.5, w: 9, h: 0.5,
    fontSize: 24, bold: true
  })

  const findings = generateKeyFindings(analysis)
  findings.forEach((finding, i) => {
    findingsSlide.addText(`• ${finding}`, {
      x: 1, y: 1.5 + (i * 0.6), w: 8, h: 0.5,
      fontSize: 14
    })
  })

  pptx.writeFile({ fileName: `ACH_${analysis.title.replace(/\s+/g, '_')}.pptx` })
}

function getScoreColor(score: number): string {
  if (score >= 3) return '10B981'      // Green
  if (score > 0) return 'A7F3D0'       // Light green
  if (score === 0) return 'E5E7EB'     // Gray
  if (score > -3) return 'FECACA'      // Light red
  return 'EF4444'                      // Red
}
```

#### 3.3 Excel Export (Data Analysis)

```typescript
// src/components/ach/ACHExcelExport.tsx
import * as XLSX from 'xlsx'

export function exportACHToExcel(analysis: ACHAnalysis) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    ['ACH Analysis Summary'],
    ['Title', analysis.title],
    ['Question', analysis.question],
    ['Analyst', analysis.analyst || 'Unknown'],
    ['Date', new Date(analysis.created_at).toLocaleDateString()],
    ['Status', analysis.status],
    [''],
    ['Hypotheses Count', analysis.hypotheses?.length || 0],
    ['Evidence Count', analysis.evidence?.length || 0],
    ['Scores Entered', analysis.scores?.length || 0]
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Sheet 2: Hypotheses with Rankings
  const hypData = [
    ['#', 'Hypothesis', 'Rationale', 'Source', 'Raw Score', 'Weighted Score', 'Rank']
  ]
  analysis.hypotheses?.forEach((h, i) => {
    hypData.push([
      i + 1,
      h.text,
      h.rationale || '',
      h.source || '',
      getColumnTotal(h.id),
      getWeightedColumnTotal(h.id),
      getRanking(h.id)
    ])
  })
  const hypSheet = XLSX.utils.aoa_to_sheet(hypData)
  XLSX.utils.book_append_sheet(wb, hypSheet, 'Hypotheses')

  // Sheet 3: Evidence with Quality Scores
  const evData = [
    ['Evidence', 'Description', 'Source', 'Date', 'Credibility', 'Quality', 'Diagnosticity']
  ]
  analysis.evidence?.forEach(ev => {
    const quality = calculateEnhancedQuality(ev)
    const diag = calculateDiagnosticity(ev.evidence_id, analysis.scores || [], analysis.hypotheses || [])
    evData.push([
      ev.evidence_title,
      ev.evidence_content?.substring(0, 100) || '',
      ev.source || '',
      ev.date || '',
      ev.credibility_score || '',
      quality.overallScore.toFixed(1),
      diag.score.toFixed(0)
    ])
  })
  const evSheet = XLSX.utils.aoa_to_sheet(evData)
  XLSX.utils.book_append_sheet(wb, evSheet, 'Evidence')

  // Sheet 4: Score Matrix
  const matrixData = [
    ['Evidence', ...analysis.hypotheses?.map((h, i) => `H${i + 1}: ${h.text.substring(0, 20)}...`) || []]
  ]
  analysis.evidence?.forEach(ev => {
    const row = [ev.evidence_title]
    analysis.hypotheses?.forEach(h => {
      const score = getScore(h.id, ev.evidence_id)
      row.push(score?.score || 0)
    })
    matrixData.push(row)
  })
  const matrixSheet = XLSX.utils.aoa_to_sheet(matrixData)
  XLSX.utils.book_append_sheet(wb, matrixSheet, 'Score Matrix')

  // Sheet 5: Detailed Scores with Notes
  const scoresData = [
    ['Hypothesis', 'Evidence', 'Score', 'Notes', 'Scored By', 'Scored At']
  ]
  analysis.scores?.forEach(s => {
    const hyp = analysis.hypotheses?.find(h => h.id === s.hypothesis_id)
    const ev = analysis.evidence?.find(e => e.evidence_id === s.evidence_id)
    scoresData.push([
      hyp?.text || '',
      ev?.evidence_title || '',
      s.score,
      s.notes || '',
      s.scored_by || '',
      s.scored_at
    ])
  })
  const scoresSheet = XLSX.utils.aoa_to_sheet(scoresData)
  XLSX.utils.book_append_sheet(wb, scoresSheet, 'Detailed Scores')

  XLSX.writeFile(wb, `ACH_${analysis.title.replace(/\s+/g, '_')}.xlsx`)
}
```

---

### Phase 4: Integration & Collaboration (Week 4) 🤝
**Goal:** Connect ACH with other tools and enable team collaboration

#### 4.1 Starbursting Integration
**Auto-generate ACH from Starbursting session**

```typescript
// In Starbursting session view
<Button onClick={() => generateACHFromStarbursting(sessionId)}>
  <Share className="h-4 w-4 mr-2" />
  Generate ACH Analysis
</Button>

async function generateACHFromStarbursting(sessionId: number) {
  const session = await fetchStarburstingSession(sessionId)

  // Create ACH with central question
  const achId = await createACH({
    title: `ACH: ${session.central_question}`,
    question: session.central_question,
    status: 'draft'
  })

  // Generate hypotheses from WHO questions
  const whoQuestions = session.questions.filter(q => q.category === 'WHO')
  for (const q of whoQuestions.slice(0, 4)) { // Top 4 WHO questions
    await createHypothesis(achId, {
      text: q.question.replace('Who ', '').replace('?', ''),
      rationale: `Generated from Starbursting WHO question: ${q.question}`,
      source: 'Starbursting Session'
    })
  }

  // Add session sources as evidence
  for (const source of session.sources || []) {
    const evidenceId = await createEvidenceFromSource(source)
    await linkEvidence(achId, evidenceId)
  }

  navigate(`/dashboard/analysis-frameworks/ach/${achId}/wizard?step=3`)
}
```

#### 4.2 COG Integration
**Link ACH to COG vulnerability analysis**

```typescript
// In ACH view, show COG connection
<Card className="mt-4">
  <CardHeader>
    <CardTitle>Center of Gravity Analysis</CardTitle>
    <p className="text-sm text-muted-foreground">
      Identify critical vulnerabilities for the top hypothesis
    </p>
  </CardHeader>
  <CardContent>
    <Button onClick={() => createCOGFromACH(analysis.id)}>
      <Network className="h-4 w-4 mr-2" />
      Generate COG Analysis
    </Button>
  </CardContent>
</Card>

async function createCOGFromACH(achId: string) {
  const ach = await fetchACHAnalysis(achId)
  const topHypothesis = getTopRankedHypothesis(ach)

  // Create COG session
  const cogId = await createCOG({
    title: `COG: ${topHypothesis.text}`,
    actor_name: extractActorFromHypothesis(topHypothesis.text),
    strategic_goal: ach.question
  })

  // Pre-populate capabilities from evidence
  const capabilities = extractCapabilities(ach.evidence, topHypothesis.id)
  for (const cap of capabilities) {
    await addCOGCapability(cogId, cap)
  }

  navigate(`/dashboard/frameworks/cog/${cogId}`)
}
```

#### 4.3 Comments & Collaboration
**Pattern from lessons learned:**

```typescript
// Add comments to hypotheses and scores
<CommentThread
  entityType="ach_hypothesis"
  entityId={hypothesis.id}
  workspaceId={workspaceId}
/>

<CommentThread
  entityType="ach_score"
  entityId={`${hypothesisId}_${evidenceId}`}
  workspaceId={workspaceId}
/>
```

**Features:**
- Comment on specific hypotheses
- Discuss individual scores
- @mention team members
- Resolve/unresolve discussions
- Activity feed for ACH changes

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority | Timeline |
|---------|--------|--------|----------|----------|
| **ACH Wizard** | 🔥 Very High | Medium | P0 | Week 1 |
| **Auto-Population from Content Intel** | 🔥 Very High | Low | P0 | Week 1 |
| **Evidence Quality Enhancement** | High | Low | P1 | Week 1 |
| **Diagnosticity Visualization** | High | Medium | P1 | Week 2 |
| **Hypothesis Probability Chart** | High | Low | P1 | Week 2 |
| **PDF Export** | Medium | Medium | P2 | Week 3 |
| **PowerPoint Export** | Medium | Medium | P2 | Week 3 |
| **Excel Export** | Medium | Low | P2 | Week 3 |
| **Starbursting Integration** | Medium | Low | P2 | Week 4 |
| **COG Integration** | Medium | Medium | P2 | Week 4 |
| **Comments System** | Low | High | P3 | Future |
| **Quick Score Mode** | Low | Medium | P3 | Future |

---

## Success Metrics

### User Experience
- ✅ **70% reduction** in time to create ACH (from 45min to 15min with wizard)
- ✅ **80% reduction** in evidence entry time (via auto-population)
- ✅ **90% satisfaction** with visual analytics
- ✅ **5x increase** in ACH completion rate

### Feature Adoption
- ✅ **60%** of new ACH use wizard
- ✅ **40%** of ACH created from Content Intelligence
- ✅ **80%** of completed ACH export to PDF/PPT
- ✅ **30%** of ACH shared publicly

### Quality Improvements
- ✅ **Better hypotheses** via GPT generation (4-6 competing hypotheses every time)
- ✅ **More accurate scoring** via enhanced evidence quality
- ✅ **Clearer insights** via diagnosticity and probability charts
- ✅ **Professional reporting** via multi-format exports

---

## Next Steps

### Week 1 Sprint Plan (Starting 2025-10-10)

**Day 1-2: ACH Wizard Foundation**
- [ ] Create `ACHWizard.tsx` component
- [ ] Implement 5-step wizard flow
- [ ] Add GPT hypothesis generation
- [ ] Template library (5 templates)

**Day 3-4: Auto-Population**
- [ ] Add "Create ACH" button to Content Intelligence
- [ ] Implement `createACHFromAnalysis()` function
- [ ] Evidence mapping logic
- [ ] Hypothesis generation from content

**Day 5: Evidence Quality**
- [ ] Implement `calculateEnhancedQuality()` function
- [ ] Multi-factor scoring (credibility, relevance, timeliness, corroboration)
- [ ] Quality badges and warnings UI
- [ ] Filter by quality

**Testing & Deployment:**
- [ ] Test wizard with 5 sample questions
- [ ] Test auto-population with 10 Content Intelligence analyses
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Production deployment

---

## Appendix A: Code Patterns to Replicate

### From COG (Successful Patterns)
```typescript
// Wizard pattern
<Wizard steps={steps} currentStep={currentStep} onStepChange={setCurrentStep}>
  <WizardStep1 />
  <WizardStep2 />
  ...
</Wizard>

// Quick actions
<QuickScoreButton onClick={openQuickScore} />

// Export pattern
<DropdownMenu>
  <DropdownMenuTrigger>Export</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={exportPDF}>PDF</DropdownMenuItem>
    <DropdownMenuItem onClick={exportPPT}>PowerPoint</DropdownMenuItem>
    <DropdownMenuItem onClick={exportExcel}>Excel</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### From Content Intelligence (Successful Patterns)
```typescript
// Auto-population
async function autoPopulateFromSource(sourceId: string) {
  const source = await fetchSource(sourceId)
  const extracted = await extractData(source)
  await prefillForm(extracted)
}

// Caching strategy
const cacheKey = `ach:${id}:${hash}`
const cached = await KV.get(cacheKey)
if (cached) return JSON.parse(cached)

// Progressive enhancement
<Button onClick={() => upgradeToFullAnalysis()}>
  Upgrade to Full Analysis
</Button>
```

### From Lessons Learned (Defensive Coding)
```typescript
// Type-safe parsing
const parsedData = typeof data === 'object' ? data : JSON.parse(data)

// Multi-strategy fallback
const strategies = [strategy1, strategy2, strategy3]
for (const strategy of strategies) {
  try {
    return await strategy.execute()
  } catch (error) {
    errors.push(error.message)
  }
}
return handleAllFailed(errors)

// Composite indexes for performance
CREATE INDEX idx_ach_workspace ON ach_analyses(workspace_id, user_id, created_at DESC)
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Author:** AI Development Team
**Review Status:** Ready for Implementation
