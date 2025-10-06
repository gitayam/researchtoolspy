# Question-Answer Framework Enhancement Plan

## Overview
Add question-answer (Q&A) pair functionality to frameworks like Starbursting and DIME, where each item consists of a question and an answer field. AI scraper should attempt to extract answers from content, leaving them blank if unavailable.

## Affected Frameworks
- **Starbursting**: 6 sections (Who, What, When, Where, Why, How) - all should be Q&A
- **DIME**: 4 sections (Diplomatic, Information, Military, Economic) - should be Q&A

## Current vs. Proposed Data Model

### Current (Simple Text Items)
```typescript
interface FrameworkItem {
  id: string
  text: string
}
```

### Proposed (Question-Answer Pairs)
```typescript
interface QuestionAnswerItem {
  id: string
  question: string
  answer: string  // Empty string if no answer available
}
```

## Implementation Steps

### 1. Update Framework Configuration
**File**: `src/config/framework-configs.ts`
- Add `itemType: 'qa'` property to framework configurations
- Mark Starbursting and DIME sections as Q&A type

###2. Update Type Definitions
**File**: `src/types/frameworks.ts` (create if doesn't exist)
- Define `QuestionAnswerItem` interface
- Update `FrameworkItem` to support both types
- Add type guards for Q&A items

### 3. Update AI URL Scraper
**File**: `functions/api/ai/scrape-url.ts`
- Detect Q&A frameworks (Starbursting, DIME)
- Extract questions from content
- Attempt to answer questions using content
- Return structured Q&A pairs with blank answers if not found

**AI Prompt Changes**:
- For Starbursting: "Generate questions AND answers for each category"
- For DIME: "Extract questions AND answers about diplomatic, information, military, economic aspects"
- Always return { question: string, answer: string } objects
- Set answer to "" if unable to find answer in content

### 4. Update GenericFrameworkForm Component
**File**: `src/components/frameworks/GenericFrameworkForm.tsx`

**Changes**:
- Detect if sections use Q&A item type
- Render different UI for Q&A items:
  - Question input/display
  - Answer textarea below it
- Update add/edit logic to handle both fields
- Update AI assistant to work with Q&A format
- Update URL extraction to handle Q&A data structure

**UI Design**:
```
┌─────────────────────────────────────────┐
│ Who Questions                        [+]│
├─────────────────────────────────────────┤
│ Q: Who is Gen. Bryan Fenton?           │
│ A: [Answer textarea - editable]         │
│    Former Commander of USSOCOM         │
├─────────────────────────────────────────┤
│ Q: Who did the Senate greenlight?      │
│ A: [Answer textarea - editable]         │
│    Lt. Gen. Bryan Fenton's successor   │
└─────────────────────────────────────────┘
```

### 5. Update GenericFrameworkView Component
**File**: `src/components/frameworks/GenericFrameworkView.tsx`

**Changes**:
- Detect Q&A item type
- Display questions and answers in read-only format
- Show "No answer provided" for blank answers
- Style differently from regular items

### 6. Update Report Generator
**File**: `src/lib/report-generator.ts`

**Changes**:
- Handle Q&A format in exports
- Word/PDF: Show Q&A pairs with proper formatting
- PowerPoint: One slide per section with Q&A list
- CSV: Columns for Question, Answer

### 7. Test & Fix Framework Save Issues

**Deception Framework**:
- Review DeceptionForm save logic (appears correct)
- Test save/edit/view cycle
- Check data serialization

**All Generic Frameworks**:
- Test DIME, Starbursting, PEST, PMESII-PT, COG, etc.
- Verify data persistence
- Check for JSON parsing errors

## Migration Strategy

### Backward Compatibility
- Existing data with `text` field should still work
- Convert on load: `{ text: "foo" }` → `{ question: "foo", answer: "" }`
- New data uses Q&A format from start

### Data Conversion Helper
```typescript
function normalizeItem(item: any, itemType: string): FrameworkItem | QuestionAnswerItem {
  if (itemType === 'qa') {
    if ('question' in item) {
      return item as QuestionAnswerItem
    }
    // Convert old format
    return {
      id: item.id,
      question: item.text || '',
      answer: ''
    }
  }
  return item as FrameworkItem
}
```

## AI Scraper Enhancements

### Question Generation Logic
1. Identify framework type from request
2. If Q&A framework (Starbursting/DIME):
   - Use question-specific prompts
   - Extract questions from content
   - Answer questions using content context
   - Return structured Q&A pairs

### Example Prompts

**Starbursting**:
```
Analyze this content and generate Who/What/When/Where/Why/How questions with answers.

For each category, provide:
- question: A specific question about the content
- answer: The answer extracted from the content, or empty string if not found

Return JSON format:
{
  "who": [{ "question": "...", "answer": "..." }],
  "what": [{ "question": "...", "answer": "..." }],
  ...
}
```

**DIME**:
```
Analyze this content for DIME framework (Diplomatic, Information, Military, Economic).

For each aspect, generate questions AND answers:
{
  "diplomatic": [{ "question": "...", "answer": "..." }],
  "information": [{ "question": "...", "answer": "..." }],
  ...
}
```

## Testing Checklist

- [ ] Create new Starbursting analysis with Q&A
- [ ] Import from URL and verify Q&A extraction
- [ ] Manually add questions and answers
- [ ] Edit existing questions/answers
- [ ] Save and verify data persistence
- [ ] View analysis and confirm Q&A display
- [ ] Export to Word/PDF/PowerPoint/CSV
- [ ] Test DIME framework with same steps
- [ ] Verify backward compatibility with existing data
- [ ] Test all other generic frameworks for save issues
- [ ] Test Deception framework save/edit/view

## Files to Modify

1. `src/config/framework-configs.ts` - Add itemType property
2. `src/types/frameworks.ts` - Create type definitions
3. `functions/api/ai/scrape-url.ts` - Update AI extraction
4. `src/components/frameworks/GenericFrameworkForm.tsx` - Q&A UI and logic
5. `src/components/frameworks/GenericFrameworkView.tsx` - Q&A display
6. `src/lib/report-generator.ts` - Q&A export formatting
7. `src/components/frameworks/DeceptionForm.tsx` - Review and fix if needed

## Timeline
1. Phase 1: Data model and configuration updates (30min)
2. Phase 2: AI scraper enhancements (45min)
3. Phase 3: Form component updates (1hr)
4. Phase 4: View component updates (30min)
5. Phase 5: Testing and bug fixes (1hr)

Total estimated time: ~3.5 hours
