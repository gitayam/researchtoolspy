/**
 * BCW Recommendations Component
 *
 * Displays Behaviour Change Wheel recommendations based on COM-B deficit assessment.
 * Shows intervention functions and policy categories with evidence base and
 * implementation considerations.
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info } from 'lucide-react'
import type {
  ComBDeficits,
  InterventionRecommendation,
  PolicyRecommendation,
  InterventionFunction,
} from '@/types/behavior-change-wheel'
import {
  generateInterventionRecommendations,
  generatePolicyRecommendations,
  assessBehaviorChangeFeasibility,
} from '@/utils/behaviour-change-wheel'

export interface BCWRecommendationsProps {
  deficits: ComBDeficits
  selectedInterventions?: InterventionFunction[]
  onInterventionSelect?: (interventions: InterventionFunction[]) => void
  readOnly?: boolean
}

export function BCWRecommendations({
  deficits,
  selectedInterventions = [],
  onInterventionSelect,
  readOnly = false,
}: BCWRecommendationsProps) {
  const [expandedInterventions, setExpandedInterventions] = useState<Set<string>>(new Set())
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set())

  // Generate recommendations
  const interventionRecommendations = generateInterventionRecommendations(deficits)
  const policyRecommendations =
    selectedInterventions.length > 0
      ? generatePolicyRecommendations(selectedInterventions)
      : []
  const feasibilityAssessment = assessBehaviorChangeFeasibility(deficits)

  // Toggle intervention expansion
  const toggleIntervention = (key: string) => {
    const newSet = new Set(expandedInterventions)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedInterventions(newSet)
  }

  // Toggle policy expansion
  const togglePolicy = (key: string) => {
    const newSet = new Set(expandedPolicies)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedPolicies(newSet)
  }

  // Toggle intervention selection
  const toggleInterventionSelection = (intervention: InterventionFunction) => {
    if (readOnly || !onInterventionSelect) return

    const newSelected = selectedInterventions.includes(intervention)
      ? selectedInterventions.filter((i) => i !== intervention)
      : [...selectedInterventions, intervention]

    onInterventionSelect(newSelected)
  }

  // Priority badge colors
  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
  }

  // Severity badge colors
  const getSeverityColor = (severity: 'major_barrier' | 'deficit' | 'adequate') => {
    switch (severity) {
      case 'major_barrier':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'deficit':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'adequate':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
  }

  // Feasibility badge colors
  const getFeasibilityColor = (feasibility: 'high' | 'medium' | 'low') => {
    switch (feasibility) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'low':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
  }

  if (interventionRecommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            All COM-B Components Adequate
          </CardTitle>
          <CardDescription>
            No deficits identified. All capability, opportunity, and motivation components are
            adequate for behavior performance.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Feasibility Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Behavior Change Feasibility Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Overall Feasibility:</span>
            <Badge className={getFeasibilityColor(feasibilityAssessment.feasibility)}>
              {feasibilityAssessment.feasibility.toUpperCase()}
            </Badge>
          </div>

          {feasibilityAssessment.barriers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Barriers Identified
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {feasibilityAssessment.barriers.map((barrier, idx) => (
                  <li key={idx}>{barrier}</li>
                ))}
              </ul>
            </div>
          )}

          {feasibilityAssessment.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Strengths
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {feasibilityAssessment.strengths.map((strength, idx) => (
                  <li key={idx}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {feasibilityAssessment.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Intervention Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Intervention Functions</CardTitle>
          <CardDescription>
            Based on Michie et al. (2011) Behaviour Change Wheel methodology. Click on interventions
            to view details and {!readOnly && 'select for implementation planning.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {interventionRecommendations.map((rec: InterventionRecommendation) => (
            <div key={rec.component_code} className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">{rec.component}</h3>
                <Badge className={getSeverityColor(rec.severity)}>
                  {rec.severity.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-2">
                {rec.interventions.map((intervention) => {
                  const key = `${rec.component_code}-${intervention.name}`
                  const isExpanded = expandedInterventions.has(key)
                  const isSelected = selectedInterventions.includes(intervention.name)

                  return (
                    <div
                      key={key}
                      className={`border rounded-lg p-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => toggleIntervention(key)}
                              className="font-medium text-sm hover:underline text-left"
                            >
                              {intervention.name
                                .split('_')
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(' ')}
                            </button>
                            <Badge className={getPriorityColor(intervention.priority)}>
                              {intervention.priority.toUpperCase()} PRIORITY
                            </Badge>
                            {!readOnly && (
                              <Button
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => toggleInterventionSelection(intervention.name)}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{intervention.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleIntervention(key)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-3 text-sm border-t pt-3">
                          <div>
                            <h4 className="font-semibold mb-1">Evidence Base</h4>
                            <p className="text-muted-foreground">{intervention.evidence_base}</p>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-1">Implementation Considerations</h4>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              {intervention.implementation_considerations.map((consideration, idx) => (
                                <li key={idx}>{consideration}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-1">Applicable Policy Categories</h4>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {intervention.applicable_policies.map((policy) => (
                                <Badge key={policy} variant="outline" className="text-xs">
                                  {policy.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Policy Recommendations */}
      {policyRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Policy Categories</CardTitle>
            <CardDescription>
              Policy categories that can support the selected intervention functions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {policyRecommendations.map((policy: PolicyRecommendation) => {
              const key = policy.policy
              const isExpanded = expandedPolicies.has(key)

              return (
                <div key={key} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <button
                        onClick={() => togglePolicy(key)}
                        className="font-medium text-sm hover:underline text-left"
                      >
                        {policy.name}
                      </button>
                      <p className="text-sm text-muted-foreground">{policy.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {policy.suitable_for_interventions.map((intervention) => (
                          <Badge key={intervention} variant="secondary" className="text-xs">
                            {intervention.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => togglePolicy(key)}>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 text-sm border-t pt-3">
                      <div>
                        <h4 className="font-semibold mb-1">Examples</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {policy.examples.map((example, idx) => (
                            <li key={idx}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
