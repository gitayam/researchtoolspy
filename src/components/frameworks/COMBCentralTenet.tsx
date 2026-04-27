/**
 * COM-B Central Tenet quote.
 *
 * Source: Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel:
 *   A Guide to Designing Interventions, p. 50.
 *
 * P3-2 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/
 */

import { Quote } from 'lucide-react'

export function COMBCentralTenet(): JSX.Element {
  return (
    <div className="my-4 p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
      <div className="flex items-start gap-3">
        <Quote className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm italic text-purple-900 dark:text-purple-100">
            Changing the incidence of any behaviour of an individual, group or population involves changing one or more of the following: capability, opportunity, and motivation relating either to the behaviour itself or behaviours that compete with or support it.
          </p>
          <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
            — Michie, Atkins & West (2014). <em>The Behaviour Change Wheel: A Guide to Designing Interventions</em>, p. 50.
          </p>
        </div>
      </div>
    </div>
  )
}
