/**
 * AI Prompt Templates
 *
 * Structured prompts for different AI use cases in intelligence analysis
 */

export interface PromptContext {
  framework?: string
  field?: string
  currentValue?: string
  relatedFields?: Record<string, any>
  linkedEvidence?: any[]
  entityType?: string
  workspaceContext?: any
}

/**
 * Field Generation Prompts
 */
export const fieldGenerationPrompts = {
  /**
   * SWOT Analysis - Strengths
   */
  swotStrength: (context: PromptContext) => `
You are assisting with a SWOT Analysis. Generate content for the "Strengths" section.

${context.relatedFields ? `Related Context:
- Weaknesses: ${context.relatedFields.weaknesses?.length || 0} identified
- Opportunities: ${context.relatedFields.opportunities?.length || 0} identified
- Threats: ${context.relatedFields.threats?.length || 0} identified
` : ''}

${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items available` : ''}

Generate 3-5 key strengths as bullet points. Each should be:
- Specific and measurable
- Based on evidence (if available)
- Relevant to strategic objectives
- Clear and concise

${context.currentValue ? `Existing content to expand on:\n${context.currentValue}\n` : ''}

Format as markdown bullet points.`,

  /**
   * Deception Analysis - MOM
   */
  deceptionMOM: (context: PromptContext) => `
You are assisting with Deception Detection Analysis using the MOM (Motive, Opportunity, Means) framework.

${context.relatedFields?.scenario ? `Scenario:\n${context.relatedFields.scenario}\n` : ''}

Analyze and provide assessment of:
1. **Motive**: Why would the actor engage in deception?
2. **Opportunity**: When and where could deception occur?
3. **Means**: What capabilities enable deception?

${context.linkedEvidence ? `
Available Evidence: ${context.linkedEvidence.length} items
Consider:
- Actor capabilities and patterns
- Historical deception precedents
- Current operational context
` : ''}

Provide structured analysis with:
- Clear assessment of each component (Motive/Opportunity/Means)
- Confidence level (High/Medium/Low) for each
- Key indicators supporting assessment
- Gaps in information

${context.currentValue ? `Build upon existing analysis:\n${context.currentValue}\n` : ''}`,

  /**
   * COG Analysis
   */
  cogCapability: (context: PromptContext) => `
You are assisting with Center of Gravity (COG) Analysis. Generate content for a critical capability.

${context.relatedFields ? `COG Context:
- Requirements already identified: ${context.relatedFields.requirements?.length || 0}
- Vulnerabilities identified: ${context.relatedFields.vulnerabilities?.length || 0}
` : ''}

A critical capability is a primary ability that enables the center of gravity to function.

Generate 2-4 critical capabilities that:
- Are essential to the actor's primary objective
- Represent fundamental abilities (not just resources)
- Can be analyzed for dependencies and vulnerabilities
- Are specific and actionable

${context.currentValue ? `Expand on:\n${context.currentValue}\n` : ''}

Format as numbered list with brief explanations.`,

  /**
   * Causeway Analysis
   */
  causewayAction: (context: PromptContext) => `
You are assisting with Causeway Analysis (Actor-Action-Target-Means-When-Where).

${context.relatedFields ? `Causeway Context:
- Actor: ${context.relatedFields.actor || '[to be determined]'}
- Target: ${context.relatedFields.target || '[to be determined]'}
` : ''}

For the "Action" field, describe what specific action occurred or is expected.

Actions should be:
- Specific observable activities
- Time-bound events
- Clearly attributable
- Analytically significant

${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items to consider` : ''}

${context.currentValue ? `Refine existing:\n${context.currentValue}\n` : ''}

Provide concise action description (1-2 sentences).`,

  /**
   * Generic Field Suggestion
   */
  generic: (context: PromptContext) => `
Framework: ${context.framework || 'Unknown'}
Field: ${context.field || 'Unknown'}

${context.relatedFields ? `Related Fields:\n${JSON.stringify(context.relatedFields, null, 2)}\n` : ''}

${context.linkedEvidence ? `Available Evidence: ${context.linkedEvidence.length} items\n` : ''}

Generate appropriate content for the "${context.field}" field in this ${context.framework} framework.

Consider:
- Framework methodology and standards
- Related field content for consistency
- Available evidence and context
- Analytical best practices

${context.currentValue ? `Existing content to expand:\n${context.currentValue}\n\nExpand and enhance this content.` : 'Generate new content from scratch.'}

Provide clear, structured content appropriate for intelligence analysis.`
}

/**
 * Summarization Prompts
 */
export const summarizationPrompts = {
  executive: (content: string) => `
Summarize the following intelligence analysis as a BLUF (Bottom Line Up Front) executive summary.

Content:
${content}

Requirements:
- Limit to 2-3 sentences maximum
- Lead with the most critical finding
- Use present tense, active voice
- No hedging language
- Classification-appropriate language

Format as a single paragraph.`,

  standard: (content: string) => `
Summarize the following intelligence analysis as a standard analytical summary.

Content:
${content}

Requirements:
- Limit to 1 paragraph (4-6 sentences)
- Include key findings and implications
- Maintain analytical objectivity
- Use intelligence community writing standards
- Preserve critical details

Format as a single paragraph.`,

  comprehensive: (content: string) => `
Create a comprehensive summary of the following intelligence analysis.

Content:
${content}

Requirements:
- Multi-paragraph structure
- Include: Key Judgments, Supporting Evidence, Gaps, Implications
- Use subheadings for organization
- Preserve analytical nuance
- Include confidence assessments

Format with markdown headings and structure.`
}

/**
 * Question Generation Prompts
 */
export const questionPrompts = {
  analytical: (context: PromptContext) => `
Framework: ${context.framework}
Completed Analysis: ${JSON.stringify(context.relatedFields, null, 2)}

${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items\n` : ''}

Generate 4-6 probing analytical questions that would strengthen this analysis.

Question types to include:
1. **Evidence Gaps**: What information is missing?
2. **Alternative Hypotheses**: What other explanations exist?
3. **Contradictions**: What inconsistencies need resolution?
4. **Collection Priorities**: What should be gathered next?

Each question should:
- Be specific to the analysis content
- Encourage critical thinking
- Identify actionable next steps
- Challenge assumptions

Return as JSON array: ["Question 1?", "Question 2?", ...]`,

  completeness: (context: PromptContext) => `
Framework: ${context.framework}
Completed Fields: ${Object.keys(context.relatedFields || {}).join(', ')}
Empty Fields: ${context.field || 'multiple'}

${context.linkedEvidence ? `Linked Evidence: ${context.linkedEvidence.length} items\n` : ''}

Generate 3-4 questions to guide completion of remaining sections.

Questions should:
- Be specific to empty/incomplete fields
- Reference available evidence when possible
- Guide analytical thinking
- Be answerable with available information

Return as JSON array: ["Question 1?", "Question 2?", ...]`,

  evidence: (context: PromptContext) => `
Linked Evidence Items: ${context.linkedEvidence?.length || 0}
Framework: ${context.framework}

Generate 3-4 questions about evidence quality and sourcing.

Focus on:
- Source reliability and credibility
- Corroboration between sources
- Temporal consistency
- Collection gaps and biases

Return as JSON array: ["Question 1?", "Question 2?", ...]`
}

/**
 * Guidance Prompts
 */
export const guidancePrompts = {
  frameworkIntro: (framework: string) => `
The user is starting a ${framework} analysis.

Provide brief (2-3 sentences) guidance on:
- What this framework is designed to analyze
- Key considerations for effective analysis
- Common pitfalls to avoid

Be concise and actionable. Use intelligence community standards.`,

  evidenceLinking: () => `
The user has not linked evidence to this framework analysis.

Provide brief (2 sentences) guidance encouraging evidence-based analysis and how to link evidence.

Be helpful and concise.`,

  completionPrompt: (framework: string, completionPercent: number) => `
The user has completed ${completionPercent}% of their ${framework} analysis.

Provide brief (1-2 sentences) encouragement and next steps.

Be positive and specific about what remains.`
}

/**
 * Formatting Prompts
 */
export const formattingPrompts = {
  enhance: (content: string) => `
Format and enhance the following text for inclusion in an intelligence report:

${content}

Apply these improvements:
- Standardize dates to "DD Mon YYYY" format (e.g., "15 Jan 2025")
- Add **bold markdown** for key entities, organizations, and terms
- Fix grammar, punctuation, and clarity
- Add proper capitalization for acronyms and proper nouns
- Structure with bullet points (-) if content is list-like
- Add [needs verification] tags for unverified claims
- Remove redundancy and improve conciseness

Return ONLY the formatted content with no explanations or meta-commentary.`,

  structure: (content: string) => `
Restructure the following unorganized content into well-formatted intelligence analysis:

${content}

Apply structure:
- Use markdown headings (##) for main sections
- Use bullet points for lists
- Use **bold** for key terms
- Use numbered lists for sequential items
- Add clear paragraph breaks

Return formatted content ready for inclusion in a report.`,

  citations: (content: string) => `
Add proper citation markers to the following content:

${content}

- Identify claims that need source attribution
- Add [Source: X] markers where appropriate
- Flag unsourced assertions with [needs source]
- Preserve existing citations

Return formatted content with citation markers.`
}

/**
 * Build prompt from template
 */
export function buildPrompt(
  type: 'field' | 'summarize' | 'questions' | 'guidance' | 'format',
  subtype: string,
  context: PromptContext | string
): string {
  switch (type) {
    case 'field':
      const fieldPrompt = fieldGenerationPrompts[subtype as keyof typeof fieldGenerationPrompts]
      return fieldPrompt ? fieldPrompt(context as PromptContext) : fieldGenerationPrompts.generic(context as PromptContext)

    case 'summarize':
      const summaryPrompt = summarizationPrompts[subtype as keyof typeof summarizationPrompts]
      return summaryPrompt ? summaryPrompt(context as string) : summarizationPrompts.standard(context as string)

    case 'questions':
      const questionPrompt = questionPrompts[subtype as keyof typeof questionPrompts]
      return questionPrompt ? questionPrompt(context as PromptContext) : questionPrompts.analytical(context as PromptContext)

    case 'guidance':
      if (subtype === 'frameworkIntro') {
        return guidancePrompts.frameworkIntro((context as PromptContext).framework || '')
      }
      if (subtype === 'evidenceLinking') {
        return guidancePrompts.evidenceLinking()
      }
      if (subtype === 'completionPrompt') {
        const ctx = context as PromptContext
        return guidancePrompts.completionPrompt(ctx.framework || '', 0)
      }
      return ''

    case 'format':
      const formatPrompt = formattingPrompts[subtype as keyof typeof formattingPrompts]
      return formatPrompt ? formatPrompt(context as string) : formattingPrompts.enhance(context as string)

    default:
      return ''
  }
}
