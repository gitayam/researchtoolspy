/**
 * Behaviour & Theory consensus definitions.
 *
 * Source: Michie, S., West, R., Campbell, R., Brown, J., Gainforth, H. (2014).
 *   ABC of Behaviour Change Theories. Silverback Publishing. Chapter 1.
 *
 * P3-1 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/
 */

import { BookOpen } from 'lucide-react'

export function BehaviourTheoryGlossary(){
  return (
    <details className="my-3 rounded-md border border-gray-200 dark:border-gray-800">
      <summary className="cursor-pointer p-3 flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4 text-blue-500" />
        Definitions: behaviour and theory
      </summary>
      <div className="p-3 pt-0 space-y-3 text-sm">
        <div>
          <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Behaviour</h4>
          <p className="italic text-muted-foreground leading-relaxed">
            Anything a person does in response to internal or external events. Actions may be overt (motor or verbal) and directly measurable or, covert (activities not viewable but involving voluntary muscles) and indirectly measurable; behaviours are physical events that occur in the body and are controlled by the brain.
          </p>
        </div>
        <div>
          <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Theory</h4>
          <p className="italic text-muted-foreground leading-relaxed">
            A set of concepts and/or statements with specification of how phenomena relate to each other. Theory provides an organising description of a system that accounts for what is known, and explains and predicts phenomena.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          — Consensus Delphi definitions from Michie et al. (2014), <em>ABC of Behaviour Change Theories</em>, Chapter 1.
        </p>
      </div>
    </details>
  )
}
