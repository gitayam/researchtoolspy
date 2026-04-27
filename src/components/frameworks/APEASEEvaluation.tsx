/**
 * APEASE Evaluation Component
 *
 * Source: Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel:
 *   A Guide to Designing Interventions, Table 1, pp. 18-20.
 *
 * APEASE = Affordability, Practicability, Effectiveness/cost-effectiveness,
 *          Acceptability, Side-effects/safety, Equity.
 *
 * P1-1 — see docs/BEHAVIOR_FRAMEWORK_IMPROVEMENT_PLAN.md.
 * Canon: irregularpedia.org/general/behavior-analysis/ (APEASE: Evaluating Candidate Interventions).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DollarSign, Wrench, Target as TargetIcon, Users, AlertTriangle, Scale } from 'lucide-react'

export type APEASERating = 'high' | 'medium' | 'low' | undefined

export interface APEASECriterion {
  rating: APEASERating
  rationale: string
}

export interface APEASEAssessment {
  affordability: APEASECriterion
  practicability: APEASECriterion
  effectiveness: APEASECriterion
  acceptability: APEASECriterion
  sideEffects: APEASECriterion
  equity: APEASECriterion
}

export const EMPTY_APEASE: APEASEAssessment = {
  affordability: { rating: undefined, rationale: '' },
  practicability: { rating: undefined, rationale: '' },
  effectiveness: { rating: undefined, rationale: '' },
  acceptability: { rating: undefined, rationale: '' },
  sideEffects: { rating: undefined, rationale: '' },
  equity: { rating: undefined, rationale: '' }
}

export function isAPEASEComplete(a: APEASEAssessment): boolean {
  return [a.affordability, a.practicability, a.effectiveness, a.acceptability, a.sideEffects, a.equity].every(c => c.rating !== undefined)
}

interface Props {
  interventionName: string
  assessment: APEASEAssessment
  onChange: (a: APEASEAssessment) => void
  readOnly?: boolean
}

export function APEASEEvaluation({ interventionName, assessment, onChange, readOnly }: Props): JSX.Element {
  const criteria = [
    { key: 'affordability' as const, label: 'Affordability', icon: DollarSign, question: 'Can it be delivered within budget?' },
    { key: 'practicability' as const, label: 'Practicability', icon: Wrench, question: 'Can it be delivered as designed at the intended scale?' },
    { key: 'effectiveness' as const, label: 'Effectiveness', icon: TargetIcon, question: 'Will it work, and is the effect worth the cost?' },
    { key: 'acceptability' as const, label: 'Acceptability', icon: Users, question: 'Will stakeholders, target audience, and decision-makers accept it?' },
    { key: 'sideEffects' as const, label: 'Side-effects/safety', icon: AlertTriangle, question: 'What unintended consequences are possible?' },
    { key: 'equity' as const, label: 'Equity', icon: Scale, question: 'Will it disproportionately help or harm sub-groups?' }
  ]

  const setRating = (key: keyof APEASEAssessment, rating: APEASERating) => {
    onChange({ ...assessment, [key]: { ...assessment[key], rating } })
  }

  const setRationale = (key: keyof APEASEAssessment, rationale: string) => {
    onChange({ ...assessment, [key]: { ...assessment[key], rationale } })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>APEASE Evaluation: {interventionName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criteria.map(({ key, label, icon: Icon, question }) => (
          <Card key={key} className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1"><Icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-semibold">{label}</h3>
                  <span className="text-sm text-muted-foreground">{question}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant={assessment[key].rating === 'high' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRating(key, 'high')}
                    disabled={readOnly}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    High
                  </Button>
                  <Button
                    type="button"
                    variant={assessment[key].rating === 'medium' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRating(key, 'medium')}
                    disabled={readOnly}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    Medium
                  </Button>
                  <Button
                    type="button"
                    variant={assessment[key].rating === 'low' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRating(key, 'low')}
                    disabled={readOnly}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Low
                  </Button>
                </div>
                <div className="mt-3">
                  <Label htmlFor={`${key}-rationale`}>Rationale</Label>
                  <Textarea
                    id={`${key}-rationale`}
                    value={assessment[key].rationale}
                    onChange={e => setRationale(key, e.target.value)}
                    disabled={readOnly}
                    className="mt-1 min-h-[80px]"
                    placeholder={`Explain why you rated ${label} as ${assessment[key].rating || 'not yet rated'}`}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}