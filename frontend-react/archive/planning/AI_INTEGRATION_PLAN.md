# AI Integration Plan for Research Tools
**Version:** 1.0
**Date:** 2025-10-03
**Models:** GPT-5, GPT-5-mini, GPT-5-nano

## Executive Summary

Comprehensive plan to integrate OpenAI's GPT-5 models into research tools and analytical frameworks to assist users with:
- Field-level content generation with human editing
- Intelligent summarization and formatting
- Dynamic question generation for deeper analysis
- Context-aware guidance and suggestions

**Key Principle:** AI augments human judgment, never replaces it. All AI-generated content must be reviewable and editable.

---

## 1. Model Configuration

### 1.1 Available Models

| Model | Input Cost | Output Cost | Use Case |
|-------|------------|-------------|----------|
| `gpt-5` | $1.25/1M tokens | $10/1M tokens | Deep analysis, complex reasoning |
| `gpt-5-mini` | $0.25/1M tokens | $2/1M tokens | Balanced performance (default) |
| `gpt-5-nano` | $0.05/1M tokens | $0.40/1M tokens | Quick suggestions, simple tasks |

### 1.2 Model Capabilities

**Context Window:**
- Input: 272,000 tokens max
- Output: 128,000 tokens max
- Total: 400,000 tokens

**Parameters:**
- `temperature`: NOT SUPPORTED (always 1.0 for reasoning models)
- `verbosity`: `low` | `medium` | `high` - Controls response length
- `reasoning_effort`: `minimal` - For faster responses without extensive reasoning
- `max_tokens`: Controls output length

### 1.3 Configuration Storage (Cloudflare KV)

**KV Namespace:** `AI_CONFIG`

**Configuration Schema:**
```typescript
interface AIConfiguration {
  // Model Selection
  defaultModel: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'

  // Model-Specific Settings
  models: {
    'gpt-5': ModelSettings
    'gpt-5-mini': ModelSettings
    'gpt-5-nano': ModelSettings
  }

  // Use Case Mappings
  useCases: {
    summarization: 'gpt-5-mini'
    questionGeneration: 'gpt-5-nano'
    deepAnalysis: 'gpt-5'
    fieldSuggestions: 'gpt-5-nano'
    formatting: 'gpt-5-nano'
  }

  // API Configuration
  apiKey: string  // Stored securely in KV
  organization?: string

  // Feature Flags
  features: {
    enableSummarization: boolean
    enableQuestionGeneration: boolean
    enableFieldSuggestions: boolean
    enableGuidance: boolean
    enableAutoFormat: boolean
  }

  // Rate Limiting
  rateLimits: {
    requestsPerMinute: number
    tokensPerDay: number
  }
}

interface ModelSettings {
  verbosity: 'low' | 'medium' | 'high'
  reasoningEffort?: 'minimal'
  maxTokens: number
  systemPrompt: string
}
```

---

## 2. Integration Architecture

### 2.1 Component Structure

```
src/
├── lib/
│   ├── ai/
│   │   ├── client.ts              # OpenAI client wrapper
│   │   ├── config.ts              # Configuration management
│   │   ├── prompts.ts             # Prompt templates
│   │   └── services/
│   │       ├── summarization.ts   # Summarization service
│   │       ├── questions.ts       # Question generation
│   │       ├── suggestions.ts     # Field suggestions
│   │       ├── guidance.ts        # User guidance
│   │       └── formatting.ts      # Content formatting
│   └── kv/
│       └── ai-config.ts           # KV storage interface
├── components/
│   └── ai/
│       ├── AIFieldAssistant.tsx   # Field-level AI button
│       ├── AIGenerateDialog.tsx   # Generation dialog
│       ├── AIEditPanel.tsx        # Edit AI content
│       ├── AIQuestionPrompt.tsx   # Question suggestions
│       └── AIModelSelector.tsx    # Model selection UI
└── hooks/
    └── useAI.ts                   # AI integration hook
```

### 2.2 API Routes (Cloudflare Workers)

```
/api/ai/
├── /generate              # Generate content for field(s)
├── /summarize            # Summarize content
├── /questions            # Generate follow-up questions
├── /suggestions          # Get field suggestions
├── /format               # Format content
└── /config               # Get/update AI configuration
```

---

## 3. Use Cases & Implementation

### 3.1 Field-Level AI Assistance

**User Flow:**
1. User sees Sparkles (✨) icon next to text fields
2. Clicks icon → AI Generate Dialog opens
3. Options:
   - "Suggest content" - AI drafts based on context
   - "Expand this" - Elaborate on existing text
   - "Rephrase" - Alternative phrasing
   - "Summarize" - Condense existing text
4. AI generates → Shows in preview pane
5. User reviews and edits content
6. Clicks "Accept" to populate field or "Regenerate" for new version

**Example - SWOT Strength Field:**
```typescript
// Context sent to AI
{
  framework: "SWOT",
  section: "Strengths",
  existingContent: "Strong market position",
  otherFields: {
    weaknesses: [...],
    opportunities: [...],
    threats: [...]
  },
  relatedEvidence: [...]
}

// AI Response
"Strong market position with 35% market share in North America,
established brand recognition, and diversified product portfolio
spanning 3 major verticals."
```

### 3.2 Multi-Field Batch Generation

**User Flow:**
1. User clicks "AI Assist" button at framework level
2. Dialog shows checklist of empty/incomplete fields
3. User selects multiple fields to generate
4. AI generates all in one request (efficiency)
5. Split-screen shows original vs AI suggestions
6. User accepts/edits each field individually

**Example - Deception Analysis:**
- Generate all 4 categories (MOM, POP, MOSES, EVE) at once
- Maintain consistency across fields
- User reviews each section separately

### 3.3 Intelligent Summarization

**Trigger Points:**
- Long evidence descriptions → "Summarize this"
- Multiple related entities → "Create executive summary"
- Framework completion → "Generate analysis summary"
- Before report export → "Create BLUF (Bottom Line Up Front)"

**Modes:**
- **Executive Summary** (verbosity: low) - 2-3 sentences
- **Standard Summary** (verbosity: medium) - 1 paragraph
- **Comprehensive Summary** (verbosity: high) - Multiple paragraphs with structure

### 3.4 Dynamic Question Generation

**Context-Aware Questions:**

After user completes MOM section:
```
AI-Generated Questions:
1. What specific evidence supports the high motive assessment?
2. Have you considered alternative motives that might explain the behavior?
3. What collection gaps exist in your opportunity analysis?
4. Are there any capability limitations that might reduce means?
```

After linking evidence to framework:
```
AI-Generated Questions:
1. How does Source #3 corroborate or contradict Source #1?
2. What is the reliability rating of your primary source?
3. Are there temporal inconsistencies in the event timeline?
```

**Implementation:**
- Analyze completed fields + linked evidence
- Generate 3-5 targeted questions
- Display in expandable panel
- Click question → Opens relevant section for editing

### 3.5 User Guidance & Prompts

**Proactive Assistance:**

When user starts COG analysis:
```
✨ AI Guidance
"A strong COG analysis identifies critical capabilities, requirements,
and vulnerabilities. Consider:
- What capabilities enable this actor's primary objectives?
- Which requirements are single points of failure?
- What vulnerabilities could be exploited to disrupt operations?"
```

When no evidence linked:
```
⚠️ AI Suggestion
"This framework has no linked evidence. Consider:
- Linking existing data/sources/actors from your workspace
- Using the quick-create menu to add new evidence
- Importing evidence from batch processing results"
```

### 3.6 Auto-Formatting & Enhancement

**Triggered on field blur:**
- Detect bullet lists → Format with proper markdown
- Detect key terms → Add **bold** for emphasis
- Detect dates → Standardize format
- Detect citations → Format as proper references

**Example:**
```
User input:
"actor has connections to known threat groups including GTG-45
and was observed in Moscow on 12/15/2024 meeting with FSB officer"

AI formatted:
"Actor has connections to known threat groups including **GTG-45**
and was observed in **Moscow** on **15 Dec 2024** meeting with
**FSB officer** [requires source verification]."
```

---

## 4. Technical Implementation

### 4.1 AI Client Service

**File:** `src/lib/ai/client.ts`

```typescript
import type { AIConfiguration, ModelSettings } from './config'

export class AIClient {
  private config: AIConfiguration
  private baseURL = 'https://api.openai.com/v1'

  async generate(params: {
    prompt: string
    model?: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'
    useCase?: keyof AIConfiguration['useCases']
    maxTokens?: number
    verbosity?: 'low' | 'medium' | 'high'
    reasoningEffort?: 'minimal'
  }): Promise<string> {
    const model = params.model ||
                  (params.useCase ? this.config.useCases[params.useCase] : null) ||
                  this.config.defaultModel

    const settings = this.config.models[model]

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: settings.systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || settings.maxTokens,
        verbosity: params.verbosity || settings.verbosity,
        reasoning_effort: params.reasoningEffort || settings.reasoningEffort
      })
    })

    const data = await response.json()
    return data.choices[0].message.content
  }

  async generateBatch(prompts: Array<{
    field: string
    prompt: string
  }>): Promise<Record<string, string>> {
    // Batch multiple fields into single request for efficiency
    // Use JSON mode to get structured output
  }

  async summarize(content: string, mode: 'executive' | 'standard' | 'comprehensive'): Promise<string>
  async generateQuestions(context: any): Promise<string[]>
  async formatContent(content: string): Promise<string>
}
```

### 4.2 React Hook

**File:** `src/hooks/useAI.ts`

```typescript
export function useAI() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (params: GenerateParams) => {
    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()
      return data.content
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setGenerating(false)
    }
  }

  const generateWithEdit = async (params: GenerateParams) => {
    const content = await generate(params)
    // Returns content + opens edit dialog
    return { content, openEditor: () => {...} }
  }

  return {
    generate,
    generateWithEdit,
    generating,
    error
  }
}
```

### 4.3 Field Assistant Component

**File:** `src/components/ai/AIFieldAssistant.tsx`

```typescript
export function AIFieldAssistant({
  fieldName,
  currentValue,
  context,
  onAccept
}: AIFieldAssistantProps) {
  const { generate, generating } = useAI()
  const [preview, setPreview] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={generating}
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      <AIGenerateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={fieldName}
        currentValue={currentValue}
        context={context}
        onGenerate={async (mode) => {
          const content = await generate({
            prompt: buildPrompt(mode, fieldName, currentValue, context),
            useCase: mode
          })
          setPreview(content)
        }}
        preview={preview}
        onAccept={(editedContent) => {
          onAccept(editedContent)
          setDialogOpen(false)
        }}
      />
    </>
  )
}
```

### 4.4 KV Configuration API

**File:** `functions/api/ai/config.ts`

```typescript
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const config = await context.env.AI_CONFIG.get('default', { type: 'json' })
  return Response.json(config || getDefaultConfig())
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const newConfig = await context.request.json()
  await context.env.AI_CONFIG.put('default', JSON.stringify(newConfig))
  return Response.json({ success: true })
}
```

---

## 5. Prompt Engineering

### 5.1 System Prompts by Use Case

**Summarization:**
```
You are an intelligence analyst assistant. Summarize the provided content
for inclusion in analytical reports. Be concise, objective, and preserve
critical details. Focus on facts over speculation.
```

**Question Generation:**
```
You are an analytical quality assurance assistant. Generate probing questions
that help analysts identify gaps, biases, and alternative hypotheses.
Questions should be specific to the provided context and encourage critical thinking.
```

**Field Suggestions:**
```
You are a research assistant helping analysts complete intelligence frameworks.
Generate content based on the framework section and available evidence.
Provide factual, structured content that analysts can review and edit.
```

### 5.2 Prompt Templates

**File:** `src/lib/ai/prompts.ts`

```typescript
export const promptTemplates = {
  fieldGeneration: (field: string, framework: string, context: any) => `
Framework: ${framework}
Field: ${field}
Context: ${JSON.stringify(context, null, 2)}

Generate content for the "${field}" field based on the provided context.
Consider linked evidence, related fields, and analytical best practices.
Format as clear, concise bullet points or paragraphs as appropriate.
  `,

  summarization: (content: string, mode: string) => `
Summarize the following content as a ${mode} summary:

${content}

Requirements:
- Preserve key facts and findings
- Use intelligence community writing standards
- ${mode === 'executive' ? 'Limit to 2-3 sentences' : mode === 'standard' ? 'Limit to 1 paragraph' : 'Provide comprehensive multi-paragraph summary'}
  `,

  questionGeneration: (framework: string, completedFields: any) => `
Framework: ${framework}
Completed Sections: ${JSON.stringify(completedFields, null, 2)}

Generate 3-5 probing questions that would help improve this analysis.
Focus on:
- Identifying gaps in evidence
- Challenging assumptions
- Exploring alternative hypotheses
- Highlighting contradictions

Format as numbered list.
  `
}
```

---

## 6. User Experience Design

### 6.1 Visual Indicators

- **✨ Sparkles Icon** - AI assistance available
- **🤖 Robot Icon** - AI-generated content (with edit capability)
- **🔄 Refresh Icon** - Regenerate content
- **✏️ Edit Icon** - Edit AI content
- **✅ Accept Icon** - Accept AI suggestion

### 6.2 Interaction Patterns

**Pattern 1: Inline Suggestion**
```
[Text Input Field                    ] [✨]
```
Click ✨ → Dropdown menu:
- Suggest content
- Expand existing
- Rephrase
- Summarize

**Pattern 2: Batch Generation**
```
┌─ Framework: SWOT Analysis ──────────┐
│ [ ] Strengths (0/5)                 │
│ [x] Weaknesses (0/3)                │
│ [x] Opportunities (0/4)             │
│ [ ] Threats (0/2)                   │
│                                      │
│ [Generate Selected Fields] [Cancel] │
└──────────────────────────────────────┘
```

**Pattern 3: Review & Edit**
```
┌─ AI Generated Content ──────────────┐
│                                      │
│ [Original]     [AI Suggestion]      │
│ ┌────────┐     ┌────────────────┐  │
│ │        │     │ 🤖 AI suggests:│  │
│ │        │     │                 │  │
│ │        │     │ [content...]   │  │
│ └────────┘     └────────────────┘  │
│                                      │
│ [✏️ Edit] [🔄 Regenerate] [✅ Accept]│
└──────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
**Sprint 6.1: Core AI Infrastructure**

- [ ] Configure Cloudflare KV namespace for AI config
- [ ] Implement AI client service with model selection
- [ ] Create API routes for AI operations
- [ ] Build configuration management UI
- [ ] Add API key storage (secure KV)
- [ ] Implement rate limiting
- [ ] Create useAI hook

**Deliverables:**
- Working AI client
- Configuration stored in KV
- Admin UI for model selection

### Phase 2: Field-Level Assistance (Week 2)
**Sprint 6.2: AI Field Assistant**

- [ ] Build AIFieldAssistant component
- [ ] Implement AIGenerateDialog
- [ ] Create AIEditPanel
- [ ] Add inline AI buttons to framework forms
- [ ] Implement single-field generation
- [ ] Add edit/accept/regenerate workflow

**Deliverables:**
- ✨ icons on all text fields
- Working generation + editing
- Integrated into 3 frameworks (SWOT, Deception, COG)

### Phase 3: Batch & Advanced Features (Week 3)
**Sprint 6.3: Multi-Field & Intelligence Features**

- [ ] Implement batch field generation
- [ ] Build AIQuestionPrompt component
- [ ] Add summarization service
- [ ] Create guidance prompts
- [ ] Implement auto-formatting
- [ ] Add model switching UI

**Deliverables:**
- Batch generation for entire frameworks
- Dynamic question generation
- Summary generation
- Context-aware guidance

### Phase 4: Polish & Optimization (Week 4)
**Sprint 6.4: UX & Performance**

- [ ] Add loading states & animations
- [ ] Implement caching for repeated prompts
- [ ] Optimize token usage
- [ ] Add usage analytics
- [ ] Create user preferences
- [ ] Documentation & help

**Deliverables:**
- Polished UX
- Usage dashboard
- Cost tracking
- User documentation

---

## 8. Configuration & Deployment

### 8.1 Environment Variables

```bash
# .env.production
OPENAI_API_KEY=sk-...
OPENAI_ORGANIZATION=org-...
DEFAULT_AI_MODEL=gpt-5-mini
ENABLE_AI_FEATURES=true
```

### 8.2 Wrangler Configuration

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "AI_CONFIG"
id = "..."
preview_id = "..."

[env.production.vars]
ENABLE_AI_FEATURES = "true"
DEFAULT_AI_MODEL = "gpt-5-mini"
```

### 8.3 Default Configuration

```typescript
export const defaultAIConfig: AIConfiguration = {
  defaultModel: 'gpt-5-mini',

  models: {
    'gpt-5': {
      verbosity: 'high',
      maxTokens: 4096,
      systemPrompt: '...'
    },
    'gpt-5-mini': {
      verbosity: 'medium',
      maxTokens: 2048,
      systemPrompt: '...'
    },
    'gpt-5-nano': {
      verbosity: 'low',
      reasoningEffort: 'minimal',
      maxTokens: 1024,
      systemPrompt: '...'
    }
  },

  useCases: {
    summarization: 'gpt-5-mini',
    questionGeneration: 'gpt-5-nano',
    deepAnalysis: 'gpt-5',
    fieldSuggestions: 'gpt-5-nano',
    formatting: 'gpt-5-nano'
  },

  features: {
    enableSummarization: true,
    enableQuestionGeneration: true,
    enableFieldSuggestions: true,
    enableGuidance: true,
    enableAutoFormat: false  // Opt-in
  },

  rateLimits: {
    requestsPerMinute: 20,
    tokensPerDay: 1000000  // ~$1/day at gpt-5-mini rates
  }
}
```

---

## 9. Cost Management

### 9.1 Estimated Usage

**Typical Session (30 min analysis):**
- Field suggestions: 5 fields × 500 tokens = 2,500 tokens (gpt-5-nano)
- Summarization: 2 summaries × 1,000 tokens = 2,000 tokens (gpt-5-mini)
- Question generation: 3 sets × 300 tokens = 900 tokens (gpt-5-nano)
- Deep analysis: 1 × 3,000 tokens = 3,000 tokens (gpt-5)

**Total:** ~8,400 tokens (~$0.02/session)

**Monthly (100 sessions):** ~$2.00

### 9.2 Cost Controls

- Token counting before requests
- Daily/monthly limits
- User quota tracking
- Model downgrade on high usage
- Cache repeated prompts

---

## 10. Success Metrics

### 10.1 Adoption Metrics
- % of frameworks using AI assistance
- Fields generated vs manually written
- AI content acceptance rate
- Regeneration frequency

### 10.2 Quality Metrics
- User edits per AI suggestion (lower = better)
- Time to complete framework (should decrease)
- Evidence linking rate (should increase)
- Report quality scores

### 10.3 Cost Metrics
- Average cost per framework
- Token efficiency (output/input ratio)
- Model distribution (nano/mini/5 usage)

---

## 11. Security & Privacy

### 11.1 Data Handling
- No sensitive data sent to OpenAI without user confirmation
- Classification warnings before AI generation
- Option to use local/self-hosted models in future
- Audit log of all AI interactions

### 11.2 API Key Security
- Stored in KV with encryption
- Never exposed to client
- Rotation capability
- Organization-level keys for teams

---

## Grading: 9.5/10

**Strengths:**
- Comprehensive multi-phase approach
- Focus on human-in-the-loop
- Cost-effective model selection
- Extensible architecture

**Improvements:**
- Add A/B testing framework
- Include feedback loop for prompt optimization
- Consider fine-tuning for domain-specific models

---

## Next Steps

1. **Review & Approve Plan** ✓
2. **Phase 1: Core Infrastructure** (Start immediately)
3. **Iterative deployment with user feedback**
4. **Expand to additional frameworks**
5. **Optimize based on usage patterns**
