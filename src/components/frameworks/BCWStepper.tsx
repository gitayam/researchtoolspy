/**
 * BCW 8-Step Process Stepper
 *
 * Source: Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel:
 *   A Guide to Designing Interventions. Steps 1-8 are the canonical intervention
 *   design process described in Chapters 1-3.
 *
 * P2-3 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/ (The 8-Step Intervention Design Process).
 */

export type BCWStepKey =
  | 'define-problem'        // Step 1
  | 'select-target'         // Step 2
  | 'specify-target'        // Step 3
  | 'identify-changes'      // Step 4 (COM-B diagnosis)
  | 'intervention-functions'// Step 5
  | 'policy-categories'     // Step 6
  | 'bcts'                  // Step 7
  | 'mode-of-delivery'      // Step 8

export interface BCWStepperProps {
  currentStep: BCWStepKey
  completedSteps?: BCWStepKey[]
  onStepClick?: (step: BCWStepKey) => void
}

const STEP_META: Record<BCWStepKey, { number: number; stage: 1 | 2 | 3; label: string; description: string }> = {
  'define-problem':         { number: 1, stage: 1, label: 'Define problem',         description: 'Define the problem in behavioural terms' },
  'select-target':          { number: 2, stage: 1, label: 'Select target behaviour',description: 'Choose which behaviour to target' },
  'specify-target':         { number: 3, stage: 1, label: 'Specify target',         description: 'Who, what, when, where, how often, with whom' },
  'identify-changes':       { number: 4, stage: 1, label: 'Identify what needs to change', description: 'COM-B diagnosis (and optionally TDF)' },
  'intervention-functions': { number: 5, stage: 2, label: 'Intervention functions', description: 'From the BCW 9 functions' },
  'policy-categories':      { number: 6, stage: 2, label: 'Policy categories',      description: 'From the BCW 7 policy categories' },
  'bcts':                   { number: 7, stage: 3, label: 'Behaviour change techniques', description: 'From BCTTv1 (93 BCTs in 16 groupings)' },
  'mode-of-delivery':       { number: 8, stage: 3, label: 'Mode of delivery',       description: 'When, how often, in what setting' }
}

export function BCWStepper(props: BCWStepperProps): JSX.Element {
  const { currentStep, completedSteps = [], onStepClick } = props

  const isCompleted = (step: BCWStepKey) => completedSteps.includes(step)
  const isCurrent = (step: BCWStepKey) => step === currentStep
  const isPending = (step: BCWStepKey) => !isCompleted(step) && !isCurrent(step)

  const getStepState = (step: BCWStepKey) => {
    if (isCompleted(step)) return 'completed'
    if (isCurrent(step)) return 'current'
    return 'pending'
  }

  const getStageLabel = (stage: 1 | 2 | 3) => {
    switch (stage) {
      case 1: return 'Understand the behaviour'
      case 2: return 'Identify intervention options'
      case 3: return 'Identify content and implementation options'
    }
  }

  const stepsByStage: Record<number, BCWStepKey[]> = {
    1: ['define-problem', 'select-target', 'specify-target', 'identify-changes'],
    2: ['intervention-functions', 'policy-categories'],
    3: ['bcts', 'mode-of-delivery']
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex flex-col gap-4">
        {Object.entries(stepsByStage).map(([stageNum, steps]) => {
          const stage = Number(stageNum) as 1 | 2 | 3
          return (
            <div key={stage} className="flex flex-col gap-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {getStageLabel(stage)}
              </div>
              <div className="flex gap-2">
                {steps.map((step, index) => {
                  const state = getStepState(step)
                  const meta = STEP_META[step]
                  const isClickable = onStepClick !== undefined
                  
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onStepClick?.(step)}
                        disabled={!isClickable}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
                          isClickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-default'
                        } ${
                          state === 'completed' ? 'bg-green-50 dark:bg-green-900/30' :
                          state === 'current' ? 'bg-blue-50 dark:bg-blue-900/30' :
                          'bg-gray-50 dark:bg-gray-800/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                          state === 'completed' ? 'bg-green-500 text-white' :
                          state === 'current' ? 'bg-blue-500 text-white' :
                          'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                        }`}>
                          {state === 'completed' ? '✓' : meta.number}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className={`font-medium ${
                            state === 'completed' ? 'text-green-700 dark:text-green-300' :
                            state === 'current' ? 'text-blue-700 dark:text-blue-300' :
                            'text-gray-600 dark:text-gray-300'
                          }`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {meta.description}
                          </span>
                        </div>
                      </button>
                      {index < steps.length - 1 && (
                        <div className="text-gray-400 dark:text-gray-500">
                          →
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}