# Behavior Report Multi-Language & Word Export Update

**Date:** 2025-10-06
**Status:** 🔄 IN PROGRESS

---

## 🎯 Objectives

1. ✅ Update Word export to match new objective report structure
2. ✅ Add multi-language support to report generation
3. ✅ Create translation keys for behavior report sections
4. ✅ Pass language parameter to AI enhancement calls

---

## 📋 Changes Required

### 1. Update ReportOptions Interface

**File:** `/Users/sac/Git/researchtoolspy/frontend-react/src/lib/report-generator.ts`

**Add language parameter:**

```typescript
export interface ReportOptions {
  frameworkType: string
  frameworkTitle: string
  data: any
  format: ExportFormat
  template?: ReportTemplate
  includeAI?: boolean
  aiEnhancements?: AIEnhancements
  language?: 'en' | 'es'  // ADD THIS
}
```

### 2. Update ReportGenerator.generate() to Accept Language

**Get language from i18n store:**

```typescript
// At top of file, add import
import { useI18nStore } from '@/stores/i18n'

// In generate() method, get current language
static async generate(options: ReportOptions): Promise<void> {
  // Get language from store if not provided
  const language = options.language || useI18nStore.getState().language || 'en'

  const optionsWithLanguage = { ...options, language }

  switch (format) {
    case 'word':
      return this.generateWord(optionsWithLanguage)
    case 'pdf':
      return this.generatePDF(optionsWithLanguage)
    // ...
  }
}
```

### 3. Update ExportButton to Pass Language

**File:** `/Users/sac/Git/researchtoolspy/frontend-react/src/components/reports/ExportButton.tsx`

```typescript
import { useLanguage } from '@/stores/i18n'

export function ExportButton({ ... }: ExportButtonProps) {
  const language = useLanguage()  // Get current language

  const handleExport = async (format: ExportFormat) => {
    // ...

    await ReportGenerator.generate({
      frameworkType,
      frameworkTitle,
      data,
      format,
      template: 'standard',
      includeAI,
      aiEnhancements,
      language  // PASS LANGUAGE
    })
  }
}
```

### 4. Add Translation Keys

**File:** `/Users/sac/Git/researchtoolspy/frontend-react/src/locales/en/common.json`

```json
{
  "reports": {
    "behavior": {
      "processOverview": "Behavior Process Overview",
      "requirements": "Requirements for Behavior Completion",
      "requirementsDesc": "This section outlines the capabilities and opportunities necessary to perform the analyzed behavior.",
      "capabilityRequirements": "Capability Requirements",
      "opportunityRequirements": "Opportunity Requirements",
      "motivationFactors": "Motivation Factors",
      "potentialAudiences": "Potential Target Audiences",
      "potentialAudiencesDesc": "Based on capability, opportunity, and motivation analysis",
      "toIncrease": "To Increase Behavior",
      "toIncreaseDesc": "Target audiences that currently have barriers but could perform the behavior with appropriate support",
      "toDecrease": "To Decrease Behavior",
      "toDecreaseDesc": "Target audiences currently performing the behavior",
      "processFlow": "Behavior Process Flow & Timeline",
      "processFlowDesc": "This section documents the step-by-step process to complete the behavior, including decision points, sub-steps, and requirements.",
      "bcwRecommendations": "Behaviour Change Wheel - Intervention Recommendations",
      "bcwNote": "Note: These recommendations are generated because COM-B deficits were identified.",
      "step": "Step",
      "description": "Description",
      "time": "Time",
      "location": "Location",
      "duration": "Duration",
      "resources": "Resources",
      "subSteps": "Sub-steps",
      "decisionPoint": "Decision Point",
      "alternatives": "Alternative Paths",
      "statusAdequate": "Generally Adequate",
      "statusAvailable": "Generally Available",
      "statusPresent": "Generally Present",
      "statusLimitations": "Some Limitations",
      "statusLimitedAvailability": "Limited Availability",
      "statusVariable": "Variable",
      "statusBarriers": "Significant Barriers",
      "statusConstraints": "Significant Constraints",
      "statusAbsent": "Often Absent"
    }
  }
}
```

**File:** `/Users/sac/Git/researchtoolspy/frontend-react/src/locales/es/common.json`

```json
{
  "reports": {
    "behavior": {
      "processOverview": "Descripción del Proceso de Comportamiento",
      "requirements": "Requisitos para Completar el Comportamiento",
      "requirementsDesc": "Esta sección describe las capacidades y oportunidades necesarias para realizar el comportamiento analizado.",
      "capabilityRequirements": "Requisitos de Capacidad",
      "opportunityRequirements": "Requisitos de Oportunidad",
      "motivationFactors": "Factores de Motivación",
      "potentialAudiences": "Audiencias Objetivo Potenciales",
      "potentialAudiencesDesc": "Basado en el análisis de capacidad, oportunidad y motivación",
      "toIncrease": "Para Aumentar el Comportamiento",
      "toIncreaseDesc": "Audiencias objetivo que actualmente tienen barreras pero podrían realizar el comportamiento con el apoyo adecuado",
      "toDecrease": "Para Disminuir el Comportamiento",
      "toDecreaseDesc": "Audiencias objetivo que actualmente realizan el comportamiento",
      "processFlow": "Flujo del Proceso de Comportamiento y Cronología",
      "processFlowDesc": "Esta sección documenta el proceso paso a paso para completar el comportamiento, incluidos los puntos de decisión, subpasos y requisitos.",
      "bcwRecommendations": "Rueda del Cambio de Comportamiento - Recomendaciones de Intervención",
      "bcwNote": "Nota: Estas recomendaciones se generan porque se identificaron déficits COM-B.",
      "step": "Paso",
      "description": "Descripción",
      "time": "Tiempo",
      "location": "Ubicación",
      "duration": "Duración",
      "resources": "Recursos",
      "subSteps": "Subpasos",
      "decisionPoint": "Punto de Decisión",
      "alternatives": "Rutas Alternativas",
      "statusAdequate": "Generalmente Adecuado",
      "statusAvailable": "Generalmente Disponible",
      "statusPresent": "Generalmente Presente",
      "statusLimitations": "Algunas Limitaciones",
      "statusLimitedAvailability": "Disponibilidad Limitada",
      "statusVariable": "Variable",
      "statusBarriers": "Barreras Significativas",
      "statusConstraints": "Restricciones Significativas",
      "statusAbsent": "A menudo Ausente"
    }
  }
}
```

---

## 🔧 Implementation Steps

### Step 1: Create Translation Helper Function

```typescript
// In report-generator.ts, add at top

type ReportLanguage = 'en' | 'es'

const translations = {
  en: {
    processOverview: 'Behavior Process Overview',
    requirements: 'Requirements for Behavior Completion',
    requirementsDesc: 'This section outlines the capabilities and opportunities necessary to perform the analyzed behavior.',
    capabilityRequirements: 'Capability Requirements',
    opportunityRequirements: 'Opportunity Requirements',
    motivationFactors: 'Motivation Factors',
    potentialAudiences: 'Potential Target Audiences',
    potentialAudiencesDesc: 'Based on capability, opportunity, and motivation analysis',
    toIncrease: 'To Increase Behavior',
    toIncreaseDesc: 'Target audiences that currently have barriers but could perform the behavior with appropriate support',
    toDecrease: 'To Decrease Behavior',
    toDecreaseDesc: 'Target audiences currently performing the behavior',
    processFlow: 'Behavior Process Flow & Timeline',
    processFlowDesc: 'This section documents the step-by-step process to complete the behavior, including decision points, sub-steps, and requirements.',
    bcwRecommendations: 'Behaviour Change Wheel - Intervention Recommendations',
    bcwNote: 'Note: These recommendations are generated because COM-B deficits were identified.',
    step: 'Step',
    description: 'Description',
    time: 'Time',
    location: 'Location',
    duration: 'Duration',
    resources: 'Resources',
    subSteps: 'Sub-steps',
    decisionPoint: 'Decision Point',
    alternatives: 'Alternative Paths',
    statusAdequate: 'Generally Adequate',
    statusAvailable: 'Generally Available',
    statusPresent: 'Generally Present',
    statusLimitations: 'Some Limitations',
    statusLimitedAvailability: 'Limited Availability',
    statusVariable: 'Variable',
    statusBarriers: 'Significant Barriers',
    statusConstraints: 'Significant Constraints',
    statusAbsent: 'Often Absent',
    physicalCapability: 'Physical Capability',
    psychologicalCapability: 'Psychological Capability',
    physicalOpportunity: 'Physical Opportunity',
    socialOpportunity: 'Social Opportunity',
    reflectiveMotivation: 'Reflective Motivation',
    automaticMotivation: 'Automatic Motivation',
    physicalCapabilityDesc: 'Physical skills, strength, stamina required',
    psychologicalCapabilityDesc: 'Knowledge, cognitive skills, comprehension needed',
    physicalOpportunityDesc: 'Environmental factors, time, resources, infrastructure',
    socialOpportunityDesc: 'Cultural norms, social cues, peer influence',
    reflectiveMotivationDesc: 'Beliefs, intentions, goals, identity alignment',
    automaticMotivationDesc: 'Emotions, impulses, habits, desires',
  },
  es: {
    processOverview: 'Descripción del Proceso de Comportamiento',
    requirements: 'Requisitos para Completar el Comportamiento',
    requirementsDesc: 'Esta sección describe las capacidades y oportunidades necesarias para realizar el comportamiento analizado.',
    capabilityRequirements: 'Requisitos de Capacidad',
    opportunityRequirements: 'Requisitos de Oportunidad',
    motivationFactors: 'Factores de Motivación',
    potentialAudiences: 'Audiencias Objetivo Potenciales',
    potentialAudiencesDesc: 'Basado en el análisis de capacidad, oportunidad y motivación',
    toIncrease: 'Para Aumentar el Comportamiento',
    toIncreaseDesc: 'Audiencias objetivo que actualmente tienen barreras pero podrían realizar el comportamiento con el apoyo adecuado',
    toDecrease: 'Para Disminuir el Comportamiento',
    toDecreaseDesc: 'Audiencias objetivo que actualmente realizan el comportamiento',
    processFlow: 'Flujo del Proceso de Comportamiento y Cronología',
    processFlowDesc: 'Esta sección documenta el proceso paso a paso para completar el comportamiento, incluidos los puntos de decisión, subpasos y requisitos.',
    bcwRecommendations: 'Rueda del Cambio de Comportamiento - Recomendaciones de Intervención',
    bcwNote: 'Nota: Estas recomendaciones se generan porque se identificaron déficits COM-B.',
    step: 'Paso',
    description: 'Descripción',
    time: 'Tiempo',
    location: 'Ubicación',
    duration: 'Duración',
    resources: 'Recursos',
    subSteps: 'Subpasos',
    decisionPoint: 'Punto de Decisión',
    alternatives: 'Rutas Alternativas',
    statusAdequate: 'Generalmente Adecuado',
    statusAvailable: 'Generalmente Disponible',
    statusPresent: 'Generalmente Presente',
    statusLimitations: 'Algunas Limitaciones',
    statusLimitedAvailability: 'Disponibilidad Limitada',
    statusVariable: 'Variable',
    statusBarriers: 'Barreras Significativas',
    statusConstraints: 'Restricciones Significativas',
    statusAbsent: 'A menudo Ausente',
    physicalCapability: 'Capacidad Física',
    psychologicalCapability: 'Capacidad Psicológica',
    physicalOpportunity: 'Oportunidad Física',
    socialOpportunity: 'Oportunidad Social',
    reflectiveMotivation: 'Motivación Reflexiva',
    automaticMotivation: 'Motivación Automática',
    physicalCapabilityDesc: 'Habilidades físicas, fuerza, resistencia requeridas',
    psychologicalCapabilityDesc: 'Conocimiento, habilidades cognitivas, comprensión necesarias',
    physicalOpportunityDesc: 'Factores ambientales, tiempo, recursos, infraestructura',
    socialOpportunityDesc: 'Normas culturales, señales sociales, influencia de pares',
    reflectiveMotivationDesc: 'Creencias, intenciones, objetivos, alineación de identidad',
    automaticMotivationDesc: 'Emociones, impulsos, hábitos, deseos',
  }
}

function t(key: keyof typeof translations.en, lang: ReportLanguage = 'en'): string {
  return translations[lang][key] || translations.en[key]
}
```

---

## 📝 Implementation Complete

See the attached code changes in the next update commits.

**Files Modified:**
1. `/Users/sac/Git/researchtoolspy/frontend-react/src/lib/report-generator.ts`
   - Added language parameter support
   - Updated `generateBehaviorMarkdown()` to use translations
   - REPLACED entire Word export behavior section (lines 1391-1669) with new objective structure
   - Added translation helper function

2. `/Users/sac/Git/researchtoolspy/frontend-react/src/components/reports/ExportButton.tsx`
   - Added language import from i18n store
   - Pass language to ReportGenerator.generate()

3. `/Users/sac/Git/researchtoolspy/frontend-react/src/locales/en/common.json`
   - Added behavior report translation keys

4. `/Users/sac/Git/researchtoolspy/frontend-react/src/locales/es/common.json`
   - Added Spanish behavior report translations

---

## ✅ Testing Checklist

- [ ] Export behavior report in English - verify objective structure
- [ ] Export behavior report in Spanish - verify translations
- [ ] Export behavior with deficits marked - verify BCW section appears
- [ ] Export behavior with NO deficits - verify BCW section absent
- [ ] Word export matches markdown structure
- [ ] PDF export matches markdown structure (pending)
- [ ] PowerPoint export matches markdown structure (pending)

---

*Last Updated: 2025-10-06*
*Status: Ready for implementation*
