'use client'

import { Info, BookOpen, Target, Brain, Shield, Lightbulb } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

interface TechniqueSnippetProps {
  technique: 'ach' | 'swot' | 'cog' | 'dime' | 'pmesii-pt' | 'starbursting' | 'pest' | 'vrio' | 'stakeholder' | 'trend'
  expanded?: boolean
}

const techniqueInfo = {
  ach: {
    title: 'Analysis of Competing Hypotheses (ACH)',
    icon: Brain,
    description: 'A systematic method for evaluating multiple hypotheses by examining consistency with available evidence.',
    purpose: 'ACH helps analysts avoid confirmation bias by explicitly considering alternative explanations and systematically evaluating how well evidence supports or contradicts each hypothesis.',
    keySteps: [
      'Identify all reasonable hypotheses',
      'List significant evidence and arguments',
      'Assess each piece of evidence against each hypothesis',
      'Refine hypotheses and evidence as needed',
      'Draw tentative conclusions about relative likelihood',
      'Analyze sensitivity to key assumptions'
    ],
    bestPractices: [
      'Include all reasonable hypotheses, even unlikely ones',
      'Focus on evidence that discriminates between hypotheses',
      'Document assumptions and uncertainty levels',
      'Consider evidence credibility and relevance',
      'Revisit analysis when new evidence emerges'
    ],
    output: 'Ranked hypotheses with supporting rationale and identification of key assumptions and evidence gaps.'
  },
  swot: {
    title: 'SWOT Analysis',
    icon: Target,
    description: 'Strategic planning tool that evaluates Strengths, Weaknesses, Opportunities, and Threats.',
    purpose: 'SWOT provides a structured framework for assessing internal capabilities and external factors to inform strategic decision-making.',
    keySteps: [
      'Define the objective or scope of analysis',
      'Identify internal Strengths (positive attributes)',
      'Identify internal Weaknesses (areas for improvement)',
      'Identify external Opportunities (favorable conditions)',
      'Identify external Threats (potential challenges)',
      'Develop strategies that leverage strengths and opportunities'
    ],
    bestPractices: [
      'Be specific and avoid vague statements',
      'Prioritize factors by impact and likelihood',
      'Consider timeframes for opportunities and threats',
      'Validate findings with stakeholders',
      'Link analysis to actionable strategies'
    ],
    output: 'Four-quadrant matrix with prioritized factors and strategic recommendations.'
  },
  cog: {
    title: 'Center of Gravity (COG) Analysis',
    icon: Shield,
    description: 'Military planning tool that identifies critical sources of power and their vulnerabilities.',
    purpose: 'COG analysis helps identify the source of an adversary\'s strength and the critical vulnerabilities that, if exploited, could lead to their defeat.',
    keySteps: [
      'Identify Centers of Gravity (sources of power)',
      'Determine Critical Capabilities (primary abilities)',
      'Identify Critical Requirements (essential conditions)',
      'Find Critical Vulnerabilities (exploitable weaknesses)',
      'Develop targeting strategies',
      'Assess risk and second-order effects'
    ],
    bestPractices: [
      'Consider both physical and moral factors',
      'Analyze at appropriate level (strategic/operational/tactical)',
      'Account for adversary adaptation',
      'Validate vulnerabilities through multiple sources',
      'Consider friendly COGs for protection'
    ],
    output: 'Hierarchical breakdown of power sources with identified vulnerabilities and exploitation strategies.'
  },
  dime: {
    title: 'DIME Analysis',
    icon: Target,
    description: 'Framework for analyzing national power through Diplomatic, Information, Military, and Economic instruments.',
    purpose: 'DIME provides a comprehensive view of how nations project power and influence, enabling coordinated multi-domain strategies.',
    keySteps: [
      'Assess Diplomatic relationships and influence',
      'Evaluate Information operations and narratives',
      'Analyze Military capabilities and posture',
      'Examine Economic leverage and dependencies',
      'Identify synergies between instruments',
      'Develop integrated strategies'
    ],
    bestPractices: [
      'Consider both hard and soft power elements',
      'Analyze interdependencies between instruments',
      'Account for temporal dynamics',
      'Assess adversary and allied DIME capabilities',
      'Align strategies with policy objectives'
    ],
    output: 'Multi-domain power assessment with integrated strategy recommendations.'
  },
  'pmesii-pt': {
    title: 'PMESII-PT Analysis',
    icon: Brain,
    description: 'Comprehensive framework for understanding operational environments across eight interrelated domains.',
    purpose: 'PMESII-PT provides a holistic understanding of complex operational environments by examining Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, and Time factors.',
    keySteps: [
      'Map Political structures and dynamics',
      'Assess Military capabilities and threats',
      'Analyze Economic systems and resources',
      'Understand Social structures and cultures',
      'Evaluate Information environments',
      'Document Infrastructure capabilities',
      'Consider Physical Environment constraints',
      'Account for Time-based factors'
    ],
    bestPractices: [
      'Identify cross-domain relationships',
      'Use multiple sources for validation',
      'Consider both current state and trends',
      'Account for regional variations',
      'Update analysis regularly'
    ],
    output: 'Comprehensive operational environment assessment with identified opportunities and risks.'
  },
  starbursting: {
    title: 'Starbursting Technique',
    icon: Lightbulb,
    description: 'Brainstorming method that systematically generates questions to explore all aspects of an idea.',
    purpose: 'Starbursting ensures comprehensive exploration of concepts by generating questions across multiple dimensions before seeking answers.',
    keySteps: [
      'Place central idea at the center',
      'Generate Who questions (stakeholders, actors)',
      'Generate What questions (actions, outcomes)',
      'Generate Where questions (locations, contexts)',
      'Generate When questions (timing, sequences)',
      'Generate Why questions (motivations, causes)',
      'Generate How questions (methods, processes)',
      'Prioritize and answer critical questions'
    ],
    bestPractices: [
      'Defer judgment during question generation',
      'Encourage quantity over quality initially',
      'Build on others\' questions',
      'Group related questions for analysis',
      'Identify knowledge gaps'
    ],
    output: 'Comprehensive question map with prioritized areas for investigation.'
  },
  pest: {
    title: 'PEST Analysis',
    icon: Target,
    description: 'Strategic tool examining Political, Economic, Social, and Technological factors affecting an organization.',
    purpose: 'PEST analysis helps organizations understand macro-environmental factors that influence strategic decisions and operations.',
    keySteps: [
      'Identify Political factors (regulations, policies)',
      'Examine Economic conditions (growth, inflation)',
      'Analyze Social trends (demographics, culture)',
      'Assess Technological developments (innovation, disruption)',
      'Evaluate factor impacts and likelihoods',
      'Develop response strategies'
    ],
    bestPractices: [
      'Focus on factors you cannot control',
      'Consider both current and future states',
      'Quantify impacts where possible',
      'Link to strategic objectives',
      'Update regularly as environment changes'
    ],
    output: 'Environmental scan with prioritized factors and strategic implications.'
  },
  vrio: {
    title: 'VRIO Framework',
    icon: Shield,
    description: 'Resource-based analysis evaluating Valuable, Rare, Inimitable, and Organized resources.',
    purpose: 'VRIO helps identify sustainable competitive advantages by systematically evaluating organizational resources and capabilities.',
    keySteps: [
      'Identify key resources and capabilities',
      'Assess if Valuable (exploit opportunities/neutralize threats)',
      'Determine if Rare (possessed by few competitors)',
      'Evaluate if Inimitable (difficult to copy)',
      'Check if Organized (systems to exploit resource)',
      'Classify competitive implications'
    ],
    bestPractices: [
      'Consider both tangible and intangible resources',
      'Validate assessments with market data',
      'Account for dynamic competitive environments',
      'Link to value chain activities',
      'Identify resource development priorities'
    ],
    output: 'Resource portfolio assessment with competitive advantage classification.'
  },
  stakeholder: {
    title: 'Stakeholder Analysis',
    icon: Target,
    description: 'Systematic identification and assessment of individuals and groups affected by or influencing a project.',
    purpose: 'Stakeholder analysis ensures all relevant parties are identified, understood, and appropriately engaged throughout an initiative.',
    keySteps: [
      'Identify all stakeholders',
      'Assess stakeholder interests and concerns',
      'Evaluate influence and importance levels',
      'Analyze stakeholder relationships',
      'Develop engagement strategies',
      'Create communication plans'
    ],
    bestPractices: [
      'Cast a wide net initially',
      'Consider indirect stakeholders',
      'Map stakeholder networks',
      'Account for changing influence over time',
      'Tailor engagement to stakeholder needs'
    ],
    output: 'Stakeholder matrix with engagement strategies and communication plans.'
  },
  trend: {
    title: 'Trend Analysis',
    icon: Brain,
    description: 'Systematic examination of patterns and trajectories to forecast future developments.',
    purpose: 'Trend analysis identifies emerging patterns and discontinuities to support strategic foresight and planning.',
    keySteps: [
      'Define scope and timeframe',
      'Collect historical data',
      'Identify patterns and trajectories',
      'Detect weak signals and emerging issues',
      'Analyze drivers and inhibitors',
      'Project future scenarios',
      'Assess implications and uncertainties'
    ],
    bestPractices: [
      'Use multiple data sources',
      'Distinguish trends from fads',
      'Consider non-linear developments',
      'Account for black swan events',
      'Update projections regularly'
    ],
    output: 'Trend projections with scenarios and strategic implications.'
  }
}

export function TechniqueSnippet({ technique, expanded = false }: TechniqueSnippetProps) {
  const info = techniqueInfo[technique]
  if (!info) return null

  const Icon = info.icon

  if (!expanded) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <Icon className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">{info.title}</AlertTitle>
        <AlertDescription className="text-blue-800">
          {info.description}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Icon className="h-6 w-6 text-blue-600 mt-1" />
            <div className="space-y-2 flex-1">
              <h3 className="text-lg font-semibold text-blue-900">{info.title}</h3>
              <p className="text-sm text-blue-800">{info.description}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Purpose</h4>
              <p className="text-sm text-blue-800">{info.purpose}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Steps</h4>
              <ol className="space-y-1">
                {info.keySteps.map((step, index) => (
                  <li key={index} className="text-sm text-blue-800 flex gap-2">
                    <span className="text-blue-600 font-medium">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Best Practices</h4>
              <ul className="space-y-1">
                {info.bestPractices.map((practice, index) => (
                  <li key={index} className="text-sm text-blue-800 flex gap-2">
                    <span className="text-blue-600">•</span>
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Expected Output</h4>
              <p className="text-sm text-blue-800">{info.output}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TechniqueQuickInfo({ technique }: { technique: TechniqueSnippetProps['technique'] }) {
  const info = techniqueInfo[technique]
  if (!info) return null

  return (
    <div className="inline-flex items-center gap-1 text-sm text-gray-500">
      <Info className="h-3 w-3" />
      <span>{info.description}</span>
    </div>
  )
}