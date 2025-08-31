import React from 'react'
import SecurityAssessmentDashboard from '@/components/security/SecurityAssessmentDashboard'

export default function SecurityAssessmentPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <SecurityAssessmentDashboard />
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Security Assessment - ResearchTools',
  description: 'Comprehensive API security analysis using evidence-based framework methodology',
}