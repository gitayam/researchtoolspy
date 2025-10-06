# COG Analysis - Internationalization (i18n) Status & Recommendations

**Last Updated:** 2025-10-06
**Review Focus:** Phase 3 Export Features + Multi-Language Support

---

## 📊 Current i18n Infrastructure Status

### ✅ What Exists

1. **Language Store** (`src/stores/i18n.ts`)
   - Zustand-based state management for language selection
   - Supports: English (`en`) and Spanish (`es`)
   - Persisted in localStorage as `app-language`
   - Provides convenience hooks: `useLanguage()` and `useSetLanguage()`

2. **Translation Files**
   - **English**: `src/locales/en/common.json` (875 lines)
   - **Spanish**: `src/locales/es/common.json` (complete translations)
   - Comprehensive coverage:
     - App-wide strings (buttons, navigation, common terms)
     - Framework names and descriptions
     - Tool descriptions
     - Authentication messages
     - All 13 analysis frameworks

3. **i18n Dependencies** (already installed)
   - `i18next@25.5.3`
   - `react-i18next@16.0.0`
   - `i18next-browser-languagedetector@8.2.0`

### ❌ What's Missing

1. **No Active Implementation**
   - ⚠️ **NO components currently use i18n/translations**
   - Translation store exists but is not consumed anywhere
   - No `useTranslation()` hook usage in any component
   - All text is hard-coded in English

2. **No i18next Configuration**
   - Missing initialization file (typically `src/lib/i18n.ts`)
   - No `I18nextProvider` in app root
   - Translation JSON files are not loaded/registered

3. **COG Analysis Components** (Phase 1-3)
   - All hard-coded English strings
   - No i18n keys used in:
     - `COGForm.tsx` (1,250+ lines)
     - `COGView.tsx` (700+ lines)
     - `COGVulnerabilityMatrix.tsx` (450+ lines)
     - `COGWizard.tsx` (wizard flow)
     - `COGQuickScore.tsx` (scoring interface)
     - **NEW: Phase 3 Export Components** (1,830+ lines total)

4. **Phase 3 Export Components** (⚠️ Not i18n-ready)
   - `COGNetworkVisualization.tsx` (450 lines) - All labels/tooltips hard-coded
   - `COGPowerPointExport.tsx` (430 lines) - Slide titles/content hard-coded
   - `COGExcelExport.tsx` (390 lines) - Column headers/sheet names hard-coded
   - `COGPDFExport.tsx` (560 lines) - Section titles/content hard-coded

---

## 🎯 Phase 3 Export Features - Detailed Review

### Components Built This Session

#### 1. **Network Visualization** (`COGNetworkVisualization.tsx`)
**Hard-Coded Strings:**
- Button labels: "Zoom In", "Zoom Out", "Fit View", "Reset", "Toggle Labels"
- UI text: "What If? Simulation Mode", "Network Statistics", "Selected Node"
- Tooltips: "Click node to remove", "Drag to pan, scroll to zoom"
- Statistics labels: "Total Nodes", "Total Edges", "Removed Nodes"

**i18n Impact:** **Medium Priority**
- User-facing UI with many interactive elements
- Tooltips and help text for usability
- Recommendation: Add i18n for full accessibility

#### 2. **PowerPoint Export** (`COGPowerPointExport.tsx`)
**Hard-Coded Strings:**
- Slide titles: "CENTER OF GRAVITY ANALYSIS", "EXECUTIVE SUMMARY", "OPERATIONAL CONTEXT"
- Section headers: "TOP 10 VULNERABILITIES", "RECOMMENDATIONS", "NETWORK ANALYSIS"
- Content labels: "Classification", "Date", "Scoring System", "Priority", "Score"

**i18n Impact:** **HIGH Priority**
- **Exported documents are presentation artifacts**
- Should match user's language preference
- Military/DoD briefings may require Spanish for partner nation collaboration
- Recommendation: **Critical for multi-national operations**

#### 3. **Excel Export** (`COGExcelExport.tsx`)
**Hard-Coded Strings:**
- Sheet names: "Targeting Matrix", "COG Summary", "Analysis Summary"
- Column headers: "Priority", "Vulnerability", "COG", "Actor", "Domain", "Type", "Score", "Status"
- Section titles: "OPERATIONAL CONTEXT", "STATISTICS", "TOP 10 VULNERABILITIES"

**i18n Impact:** **HIGH Priority**
- **Exported workbooks are shared planning documents**
- Excel files used across teams/organizations
- Column headers critical for data interpretation
- Recommendation: **Essential for international collaboration**

#### 4. **PDF Report** (`COGPDFExport.tsx`)
**Hard-Coded Strings:**
- Report sections: "EXECUTIVE SUMMARY", "OPERATIONAL CONTEXT", "COG ANALYSIS BY ACTOR"
- Content labels: "Friendly Forces", "Adversary", "Host Nation", "Third Party"
- OPORD guidance: "APPENDIX A - OPORD INTEGRATION", "TARGETING GUIDANCE"
- Classification: "UNCLASSIFIED"

**i18n Impact:** **HIGH Priority**
- **Formal reports following JP 5-0 standards**
- Used in operational planning and briefings
- May need to be provided to coalition partners
- Recommendation: **Mandatory for joint/combined operations**

---

## 🚨 Key Findings: Multi-Language Readiness

### Overall Assessment: **NOT READY**

| Component Category | i18n Ready? | Priority | Impact |
|-------------------|-------------|----------|---------|
| COG Form | ❌ No | High | User experience |
| COG View | ❌ No | High | User experience |
| Network Viz | ❌ No | Medium | Interactive features |
| **PowerPoint Export** | ❌ **No** | **CRITICAL** | **Presentation artifacts** |
| **Excel Export** | ❌ **No** | **CRITICAL** | **Shared planning docs** |
| **PDF Report** | ❌ **No** | **CRITICAL** | **Formal reports** |
| AI COG Assistant | ❌ No | High | AI-generated content |

### Critical Gap Analysis

**The Phase 3 export features present the HIGHEST i18n priority** because:

1. **Exported Documents = Permanent Artifacts**
   - Unlike UI elements that change with language toggle
   - PDF/PPTX/XLSX files are saved and shared
   - Documents should reflect user's language preference at export time

2. **Multi-National Operations Use Case**
   - Coalition operations with Spanish-speaking partners
   - Joint planning with Latin American militaries
   - Partner nation capacity building

3. **Professional Standards**
   - JP 5-0 compliance may require Spanish versions
   - DoD/NATO operations include Spanish as working language
   - Export quality reflects tool credibility

---

## 📋 Recommended Implementation Roadmap

### Phase 1: i18n Infrastructure Setup (1-2 days)

1. **Create i18n Configuration** (`src/lib/i18n.ts`)
   ```typescript
   import i18n from 'i18next'
   import { initReactI18next } from 'react-i18next'
   import LanguageDetector from 'i18next-browser-languagedetector'

   import enCommon from '@/locales/en/common.json'
   import esCommon from '@/locales/es/common.json'

   i18n
     .use(LanguageDetector)
     .use(initReactI18next)
     .init({
       resources: {
         en: { common: enCommon },
         es: { common: esCommon }
       },
       fallbackLng: 'en',
       defaultNS: 'common',
       interpolation: { escapeValue: false }
     })

   export default i18n
   ```

2. **Add I18nextProvider to App Root** (`src/App.tsx`)
   ```typescript
   import { I18nextProvider } from 'react-i18next'
   import i18n from '@/lib/i18n'

   function App() {
     return (
       <I18nextProvider i18n={i18n}>
         {/* ... app content ... */}
       </I18nextProvider>
     )
   }
   ```

3. **Sync i18next with Zustand Store**
   - Update `useSetLanguage()` to call `i18n.changeLanguage(lang)`
   - Ensure language changes persist and propagate

### Phase 2: Add COG-Specific Translation Keys (2-3 days)

1. **Create COG Translation Namespace** (`src/locales/en/cog.json`)
   ```json
   {
     "title": "Center of Gravity Analysis",
     "operationalContext": {
       "title": "Operational Context",
       "objective": "What is your analysis objective?",
       "desiredImpact": "What impact do we want to achieve?",
       "ourIdentity": "Who are we?",
       "environment": "Where are we operating?",
       "constraints": "What constraints/restraints limit us?",
       "timeframe": "What is the operational timeframe?",
       "strategicLevel": "At what strategic level?"
     },
     "cog": {
       "title": "Center of Gravity",
       "description": "What is this Center of Gravity?",
       "rationale": "Why is this a COG?",
       "validation": "COG Validation Checklist"
     },
     "capabilities": {
       "title": "Critical Capabilities",
       "subtitle": "What can the COG DO?",
       "description": "Capability Description",
       "howItWorks": "How does this capability work?",
       "strategicContribution": "How does this support objectives?"
     },
     "export": {
       "powerpoint": {
         "generating": "Generating PowerPoint...",
         "slideTitle": "CENTER OF GRAVITY ANALYSIS",
         "executiveSummary": "EXECUTIVE SUMMARY",
         "operationalContext": "OPERATIONAL CONTEXT",
         "cogAnalysis": "CENTER OF GRAVITY ANALYSIS",
         "vulnerabilityMatrix": "VULNERABILITY MATRIX",
         "recommendations": "RECOMMENDATIONS"
       },
       "excel": {
         "generating": "Generating Excel...",
         "targetingMatrix": "Targeting Matrix",
         "cogSummary": "COG Summary",
         "analysisSummary": "Analysis Summary",
         "columnHeaders": {
           "priority": "Priority",
           "vulnerability": "Vulnerability",
           "cog": "COG",
           "actor": "Actor",
           "domain": "Domain",
           "type": "Type",
           "score": "Score",
           "actions": "Recommended Actions",
           "status": "Status"
         }
       },
       "pdf": {
         "generating": "Generating PDF Report...",
         "coverPage": {
           "title": "CENTER OF GRAVITY",
           "subtitle": "ANALYSIS REPORT",
           "classification": "CLASSIFICATION:",
           "unclassified": "UNCLASSIFIED",
           "date": "DATE:",
           "scoringSystem": "SCORING SYSTEM:"
         },
         "sections": {
           "executiveSummary": "EXECUTIVE SUMMARY",
           "operationalContext": "1. OPERATIONAL CONTEXT",
           "cogAnalysis": "2. CENTER OF GRAVITY ANALYSIS",
           "vulnerabilityAssessment": "3. VULNERABILITY ASSESSMENT",
           "recommendations": "4. RECOMMENDATIONS",
           "opordIntegration": "APPENDIX A - OPORD INTEGRATION"
         },
         "actorCategories": {
           "friendly": "Friendly Forces",
           "adversary": "Adversary",
           "hostNation": "Host Nation",
           "thirdParty": "Third Party"
         }
       }
     }
   }
   ```

2. **Create Spanish COG Translations** (`src/locales/es/cog.json`)
   - Mirror structure with Spanish translations
   - Military terminology requires expert translation
   - Consider DoD/NATO Spanish glossaries for accuracy

### Phase 3: Implement i18n in Export Components (3-4 days)

#### Excel Export Example
```typescript
import { useTranslation } from 'react-i18next'

export function COGExcelExport({ analysis, vulnerabilities }: COGExcelExportProps) {
  const { t } = useTranslation(['cog', 'common'])

  const handleExport = async () => {
    // Sheet names
    const targetingSheet = workbook.addWorksheet(t('cog:export.excel.targetingMatrix'))
    const cogSheet = workbook.addWorksheet(t('cog:export.excel.cogSummary'))
    const summarySheet = workbook.addWorksheet(t('cog:export.excel.analysisSummary'))

    // Column headers
    targetingSheet.columns = [
      { header: t('cog:export.excel.columnHeaders.priority'), key: 'priority', width: 10 },
      { header: t('cog:export.excel.columnHeaders.vulnerability'), key: 'vulnerability', width: 40 },
      { header: t('cog:export.excel.columnHeaders.cog'), key: 'cog', width: 35 },
      // ... more columns
    ]
  }
}
```

#### PowerPoint Export Example
```typescript
const slideTitle = pptx.addSlide()
slideTitle.addText(t('cog:export.powerpoint.slideTitle'), {
  fontSize: 44, bold: true, align: 'center'
})

const slideExec = pptx.addSlide()
slideExec.addText(t('cog:export.powerpoint.executiveSummary'), {
  fontSize: 28, bold: true
})
```

#### PDF Export Example
```typescript
pdf.text(t('cog:export.pdf.coverPage.title'), pageWidth / 2, 35, { align: 'center' })
pdf.text(t('cog:export.pdf.coverPage.subtitle'), pageWidth / 2, 50, { align: 'center' })

pdf.text(t('cog:export.pdf.sections.executiveSummary'), margin, currentY)
```

### Phase 4: Test Multi-Language Exports (1 day)

1. **Export Verification Tests**
   - Generate PowerPoint in English → Verify all labels
   - Switch to Spanish → Generate PowerPoint → Verify Spanish labels
   - Repeat for Excel and PDF
   - Verify formatting remains correct with longer Spanish text

2. **Edge Cases**
   - Long translations that break layouts
   - Character encoding (Spanish accents: á, é, í, ó, ú, ñ)
   - Right-to-left languages (future: Arabic?)

---

## 🎬 Quick Start: Minimum Viable i18n

If time is limited, implement **export components only**:

1. **Export Priority Order:**
   1. PDF Report (most formal/professional)
   2. PowerPoint (most shared/presented)
   3. Excel (most collaborative/editable)
   4. Network Visualization (least critical)

2. **Minimal Translation Keys** (50-100 keys vs full 500+)
   - Focus on export-specific strings only
   - Use existing `common.json` for shared strings (buttons, etc.)
   - Defer form/view i18n to later phase

3. **Implementation Time:**
   - 1 day: i18n setup + PDF export
   - 1 day: PowerPoint + Excel exports
   - 1 day: Testing + refinement

---

## 📊 Translation Coverage Needed

### Existing Coverage (Already Translated)
✅ Buttons: save, cancel, delete, edit, create, export, etc. (48 strings)
✅ Common terms: loading, error, success, status, date, etc. (24 strings)
✅ Navigation: dashboard, frameworks, evidence, tools, etc. (24 strings)
✅ Framework names: SWOT, COG, ACH, PMESII-PT, etc. (13 strings)

### **Missing Coverage for Phase 3 Exports**
❌ **Export component UI labels** (50+ strings)
❌ **PowerPoint slide titles/content** (30+ strings)
❌ **Excel sheet names/headers** (40+ strings)
❌ **PDF report sections/labels** (60+ strings)
❌ **Network visualization tooltips** (20+ strings)

**Estimated New Keys Needed:** ~200 strings
**Translation Effort:** 4-6 hours for Spanish (with subject matter expert)

---

## ✅ Recommendations Summary

### Immediate Actions (Week 1)

1. **Set up i18n infrastructure** (i18n.ts, I18nextProvider)
2. **Create `cog.json` translation namespace** with export keys
3. **Implement i18n in PDF export component** (highest priority)
4. **Test English → Spanish export functionality**

### Short-Term (Weeks 2-3)

5. **Add i18n to PowerPoint and Excel exports**
6. **Add i18n to Network Visualization**
7. **Comprehensive testing with both languages**

### Long-Term (Month 2+)

8. **Add i18n to all COG form components** (Phase 1-2)
9. **Add i18n to AI COG Assistant**
10. **Consider additional languages** (French for coalition ops?)

### Quality Assurance

- **Military terminology accuracy** - Engage Spanish-speaking military personnel
- **DoD/NATO standards compliance** - Use official glossaries
- **Cultural appropriateness** - Review with native speakers
- **Layout/formatting** - Spanish text averages 20% longer than English

---

## 🌍 Strategic Value of Multi-Language Support

### Use Cases for Spanish COG Analysis

1. **Partner Nation Capacity Building**
   - Training Latin American militaries
   - Security cooperation with Mexico, Colombia, etc.
   - Counter-narcotics operations

2. **Coalition Operations**
   - Joint planning with Spanish/Latin American forces
   - NATO operations (Spain as member)
   - UN peacekeeping missions

3. **Domestic Operations**
   - U.S. National Guard border operations
   - Interagency coordination with Spanish-speaking agencies
   - Community engagement in Spanish-speaking regions

4. **Export Control Compliance**
   - Providing tools to foreign partners in their language
   - Reducing training/adoption barriers

---

## 📚 Technical Reference

### i18next Integration Pattern
```typescript
// Component example
import { useTranslation } from 'react-i18next'

function COGComponent() {
  const { t } = useTranslation(['cog', 'common'])

  return (
    <div>
      <h1>{t('cog:title')}</h1>
      <button>{t('common:buttons.save')}</button>
    </div>
  )
}
```

### Language Switching
```typescript
// User clicks language selector
import { useSetLanguage } from '@/stores/i18n'
import { useTranslation } from 'react-i18next'

function LanguageSelector() {
  const setLanguage = useSetLanguage()
  const { i18n } = useTranslation()

  const changeLanguage = (lang: 'en' | 'es') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return <button onClick={() => changeLanguage('es')}>Español</button>
}
```

---

**Status:** Infrastructure exists, implementation needed
**Priority:** High for exports, Medium for UI
**Estimated Effort:** 1-2 weeks for full Phase 3 i18n support
**Blocker:** None - all dependencies installed, translations partially available

**Next Steps:** Implement Phase 1 (i18n infrastructure setup) before adding more COG features.
