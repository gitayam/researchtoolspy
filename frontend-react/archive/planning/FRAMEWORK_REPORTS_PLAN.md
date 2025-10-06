# Framework Reports & Export System - Implementation Plan

## Overview
Comprehensive reporting and export system for all analysis frameworks with AI-powered features and multiple export formats.

## Problem Statement
Users need to:
1. Generate professional reports from their framework analyses
2. Export in multiple formats (Word, PDF, PowerPoint, CSV)
3. Preview reports before saving/exporting
4. Have AI-assisted summaries and insights
5. Ensure data is never lost during save operations

## Architecture

### 1. Report Generation System

#### Core Components
- **ReportGenerator**: Main orchestrator for report creation
- **ReportPreview**: Component to preview report before export
- **ReportTemplates**: Format-specific templates (Word, PDF, PPT, CSV)
- **AI Report Enhancer**: AI-powered summary and insights generation

#### Data Flow
```
Framework Data → Report Generator → AI Enhancement → Template Selection → Export/Preview
```

### 2. AI-Powered Features

#### AI Summary Generation
- **Executive Summary**: 2-3 sentence BLUF (Bottom Line Up Front)
- **Standard Summary**: 1 paragraph overview
- **Comprehensive Summary**: Multi-paragraph with sections
- **Key Insights**: AI-identified patterns and findings
- **Recommendations**: Actionable next steps

#### AI Enhancement API Endpoint
```
POST /api/ai/report-enhance
{
  "frameworkType": "dime|swot|ach|pmesii-pt|...",
  "data": { /* framework data */ },
  "enhancementType": "summary|insights|recommendations|full"
}
```

### 3. Export Formats

#### Word (.docx)
**Library**: `docx` (https://www.npmjs.com/package/docx)
- Professional formatted documents
- Headers, footers, page numbers
- Tables, charts, images
- Custom styling and branding

#### PDF (.pdf)
**Library**: `jsPDF` + `html2canvas` (https://www.npmjs.com/package/jspdf)
- Print-ready documents
- Embedded fonts and styling
- Charts and visualizations
- Pagination and watermarks

#### PowerPoint (.pptx)
**Library**: `pptxgenjs` (https://www.npmjs.com/package/pptxgenjs)
- Slide deck presentations
- Title slide, summary, detailed slides
- Charts and data visualizations
- Speaker notes

#### CSV (.csv)
**Library**: `papaparse` (https://www.npmjs.com/package/papaparse)
- Tabular data export
- Compatible with Excel/Google Sheets
- Multiple sheets for complex frameworks

### 4. Report Template Structure

#### Universal Template Sections
```markdown
# {Framework Title} Analysis Report

## Executive Summary
[AI-generated executive summary]

## Analysis Overview
- **Title**: {analysis.title}
- **Date**: {analysis.created_at}
- **Framework**: {framework_type}
- **Status**: {analysis.status}

## Detailed Findings
[Framework-specific sections]

## Key Insights
[AI-generated insights]

## Recommendations
[AI-generated recommendations]

## Data Tables
[Structured data in tabular format]

## Appendix
- Methodology
- Data sources
- Evidence items (if applicable)
```

#### Framework-Specific Templates

**SWOT Report**
- 2x2 matrix visualization
- Cross-analysis (S-O, W-T strategies)
- Priority ranking

**ACH Report**
- Hypothesis ranking table
- Evidence quality matrix
- Quality-weighted scores
- Methodology explanation

**DIME Report**
- 4-quadrant analysis
- Diplomatic/Information/Military/Economic sections
- Cross-domain insights

**PMESII-PT Report**
- 7-dimension analysis
- Interconnections diagram
- System dynamics

**Deception (SATS) Report**
- MOM/POP/MOSES/EVE scores
- Risk level assessment
- Indicators breakdown
- Probability calculations

### 5. Implementation Phases

#### Phase 1: Core Infrastructure (Priority 1)
- [x] Fix save functionality for all frameworks
- [ ] Create `ReportGenerator` base class
- [ ] Implement error handling and validation
- [ ] Add auto-save drafts

#### Phase 2: AI Enhancement (Priority 1)
- [ ] Create `/api/ai/report-enhance` endpoint
- [ ] Implement executive summary generation
- [ ] Add key insights extraction
- [ ] Build recommendations engine

#### Phase 3: Export Formats (Priority 2)
- [ ] Implement Word export with `docx`
- [ ] Implement PDF export with `jsPDF`
- [ ] Implement PowerPoint export with `pptxgenjs`
- [ ] Implement CSV export with `papaparse`

#### Phase 4: Report Preview (Priority 2)
- [ ] Create `ReportPreview` component
- [ ] Add live preview rendering
- [ ] Implement edit-in-preview mode
- [ ] Add export options UI

#### Phase 5: Advanced Features (Priority 3)
- [ ] Report versioning
- [ ] Collaborative comments
- [ ] Custom templates
- [ ] Scheduled report generation

### 6. Technical Implementation

#### Dependencies to Add
```json
{
  "docx": "^8.5.0",
  "jspdf": "^2.5.2",
  "html2canvas": "^1.4.1",
  "pptxgenjs": "^3.12.0",
  "papaparse": "^5.4.1"
}
```

#### New Components

**`src/components/reports/ReportGenerator.tsx`**
```typescript
interface ReportOptions {
  frameworkType: string
  data: any
  format: 'word' | 'pdf' | 'pptx' | 'csv'
  includeAI: boolean
  template?: 'standard' | 'executive' | 'detailed'
}

class ReportGenerator {
  async generate(options: ReportOptions): Promise<Blob>
  async preview(options: ReportOptions): Promise<string>
  async enhance(data: any): Promise<AIEnhancements>
}
```

**`src/components/reports/ReportPreview.tsx`**
```typescript
interface ReportPreviewProps {
  frameworkType: string
  data: any
  onExport: (format: string) => void
  onSave?: () => void
}
```

**`src/components/reports/ExportButton.tsx`**
```typescript
interface ExportButtonProps {
  frameworkType: string
  analysisId: string
  data: any
  formats: Array<'word' | 'pdf' | 'pptx' | 'csv'>
}
```

#### API Endpoints

**`functions/api/reports/generate.ts`**
- Generate report with AI enhancements
- Return formatted report data

**`functions/api/reports/export.ts`**
- Handle server-side export generation
- Stream large files

### 7. User Experience Flow

#### Export Flow
1. User clicks "Export" button on any framework analysis
2. Modal opens with options:
   - Format selection (Word/PDF/PowerPoint/CSV)
   - Template selection (Standard/Executive/Detailed)
   - AI enhancement toggle
   - Preview button
3. User clicks "Preview Report"
4. Report preview renders with all enhancements
5. User can edit summary/insights inline
6. User clicks "Export as [Format]"
7. File downloads automatically

#### Report Preview Before Save
1. User fills out framework form
2. User clicks "Preview Report" (new button next to Save)
3. Modal shows rendered report
4. User can toggle AI enhancements on/off
5. User can export OR save to database
6. Saves include report metadata for quick re-generation

### 8. Error Handling & Data Protection

#### Save Error Prevention
- Auto-save drafts every 30 seconds
- Local storage backup
- Validation before save
- Clear error messages
- Retry mechanism

#### Data Loss Prevention
```typescript
// Auto-save implementation
useEffect(() => {
  const interval = setInterval(() => {
    localStorage.setItem(
      `draft_${frameworkType}_${analysisId}`,
      JSON.stringify(formData)
    )
  }, 30000) // 30 seconds
  return () => clearInterval(interval)
}, [formData])

// Restore on mount
useEffect(() => {
  const draft = localStorage.getItem(`draft_${frameworkType}_${analysisId}`)
  if (draft && !initialData) {
    if (confirm('Found unsaved draft. Restore?')) {
      setFormData(JSON.parse(draft))
    }
  }
}, [])
```

### 9. Framework-Specific Export Logic

#### SWOT → PowerPoint
- Slide 1: Title + Executive Summary
- Slide 2: 2x2 SWOT Matrix
- Slide 3: Strengths Details
- Slide 4: Weaknesses Details
- Slide 5: Opportunities Details
- Slide 6: Threats Details
- Slide 7: Strategies (S-O, W-O, S-T, W-T)
- Slide 8: Recommendations

#### ACH → Word Document
- Cover Page
- Table of Contents
- Executive Summary
- Methodology Explanation
- Hypotheses List
- Evidence Matrix Table
- Quality Weighting Explanation
- Ranked Results
- Recommendations
- Appendix: Full Evidence Details

#### DIME → CSV
```csv
Dimension,Item,Description,Priority,Source
Diplomatic,Item 1,Description 1,High,Evidence 1
Information,Item 2,Description 2,Medium,Evidence 2
...
```

### 10. Testing Strategy

#### Unit Tests
- Report generation for each framework
- Export to each format
- AI enhancement API
- Data validation

#### Integration Tests
- End-to-end export flow
- Save and restore drafts
- Error recovery

#### Manual Testing Checklist
- [ ] SWOT export to all formats
- [ ] ACH export to all formats
- [ ] DIME export to all formats
- [ ] PMESII-PT export to all formats
- [ ] COG export to all formats
- [ ] Deception export to all formats
- [ ] Starbursting export to all formats
- [ ] Causeway export to all formats
- [ ] Report preview accuracy
- [ ] AI enhancements quality
- [ ] Error handling

### 11. Performance Considerations

- Lazy load export libraries (code splitting)
- Stream large exports
- Cache AI enhancements
- Background generation for large reports
- Progress indicators for slow operations

### 12. Success Metrics

- Zero data loss incidents
- < 3 seconds for report generation
- < 5 seconds for export to any format
- 90%+ AI summary accuracy rating
- User adoption of export features

## Next Steps

1. **Immediate**: Fix DIME save error and add validation
2. **Week 1**: Implement core ReportGenerator and AI enhancement
3. **Week 2**: Build export for Word and PDF
4. **Week 3**: Add PowerPoint and CSV export
5. **Week 4**: Polish UI, add preview, comprehensive testing
