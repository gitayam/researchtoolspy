'use client'

import { ACHExport } from '@/components/frameworks/ach-export'
import { ScaleType } from '@/lib/ach-scoring'
import type { ACHExportData } from '@/lib/ach-export'

export default function ACHExportTestPage() {
  // Sample data for testing exports
  const sampleData: ACHExportData = {
    title: 'Sample ACH Analysis - Attribution Investigation',
    description: 'Analysis to determine the most likely perpetrator of a cyber attack based on available evidence.',
    hypotheses: [
      { id: 'h1', text: 'Nation-state actor from Country A conducted the attack' },
      { id: 'h2', text: 'Criminal organization seeking financial gain' },
      { id: 'h3', text: 'Hacktivist group with political motivations' },
      { id: 'h4', text: 'Insider threat from within the organization' }
    ],
    evidence: [
      { 
        id: 'e1', 
        text: 'Attack used advanced persistent threat (APT) techniques typical of nation-state actors',
        confidenceScore: 11,
        evaluationResponses: { 'source_type': 13, 'corroboration': 8, 'bias': 5, 'deception': 8 }
      },
      { 
        id: 'e2', 
        text: 'Financial records show large cryptocurrency transfers to known criminal wallets',
        confidenceScore: 8,
        evaluationResponses: { 'source_type': 8, 'corroboration': 13, 'bias': 3, 'deception': 5 }
      },
      { 
        id: 'e3', 
        text: 'Attack coincided with political tensions between countries',
        confidenceScore: 5,
        evaluationResponses: { 'source_type': 5, 'corroboration': 3, 'bias': 8, 'deception': 3 }
      },
      { 
        id: 'e4', 
        text: 'No insider access logs show suspicious activity during attack timeframe',
        confidenceScore: 9,
        evaluationResponses: { 'source_type': 13, 'corroboration': 8, 'bias': 1, 'deception': 1 }
      }
    ],
    scores: new Map([
      ['e1', new Map([
        ['h1', { hypothesisId: 'h1', evidenceId: 'e1', score: 13, weight: { credibility: 4, relevance: 5 }, evidenceCredibility: 11 }],
        ['h2', { hypothesisId: 'h2', evidenceId: 'e1', score: -5, weight: { credibility: 4, relevance: 4 }, evidenceCredibility: 11 }],
        ['h3', { hypothesisId: 'h3', evidenceId: 'e1', score: 3, weight: { credibility: 4, relevance: 3 }, evidenceCredibility: 11 }],
        ['h4', { hypothesisId: 'h4', evidenceId: 'e1', score: -8, weight: { credibility: 4, relevance: 4 }, evidenceCredibility: 11 }]
      ])],
      ['e2', new Map([
        ['h1', { hypothesisId: 'h1', evidenceId: 'e2', score: -3, weight: { credibility: 3, relevance: 4 }, evidenceCredibility: 8 }],
        ['h2', { hypothesisId: 'h2', evidenceId: 'e2', score: 13, weight: { credibility: 4, relevance: 5 }, evidenceCredibility: 8 }],
        ['h3', { hypothesisId: 'h3', evidenceId: 'e2', score: -1, weight: { credibility: 3, relevance: 3 }, evidenceCredibility: 8 }],
        ['h4', { hypothesisId: 'h4', evidenceId: 'e2', score: 5, weight: { credibility: 3, relevance: 3 }, evidenceCredibility: 8 }]
      ])],
      ['e3', new Map([
        ['h1', { hypothesisId: 'h1', evidenceId: 'e3', score: 8, weight: { credibility: 2, relevance: 4 }, evidenceCredibility: 5 }],
        ['h2', { hypothesisId: 'h2', evidenceId: 'e3', score: 0, weight: { credibility: 2, relevance: 2 }, evidenceCredibility: 5 }],
        ['h3', { hypothesisId: 'h3', evidenceId: 'e3', score: 5, weight: { credibility: 2, relevance: 4 }, evidenceCredibility: 5 }],
        ['h4', { hypothesisId: 'h4', evidenceId: 'e3', score: 0, weight: { credibility: 2, relevance: 2 }, evidenceCredibility: 5 }]
      ])],
      ['e4', new Map([
        ['h1', { hypothesisId: 'h1', evidenceId: 'e4', score: 1, weight: { credibility: 4, relevance: 3 }, evidenceCredibility: 9 }],
        ['h2', { hypothesisId: 'h2', evidenceId: 'e4', score: 1, weight: { credibility: 4, relevance: 3 }, evidenceCredibility: 9 }],
        ['h3', { hypothesisId: 'h3', evidenceId: 'e4', score: 1, weight: { credibility: 4, relevance: 3 }, evidenceCredibility: 9 }],
        ['h4', { hypothesisId: 'h4', evidenceId: 'e4', score: -13, weight: { credibility: 4, relevance: 5 }, evidenceCredibility: 9 }]
      ])]
    ]),
    scaleType: 'logarithmic' as ScaleType,
    createdAt: new Date(),
    analyst: 'Senior Intelligence Analyst',
    organization: 'Cyber Defense Unit'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">ACH Export Test</h1>
          <p className="text-gray-600 mt-2">
            Test the government-standard ACH export functionality with sample data
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Sample Analysis Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Hypotheses:</span>
              <div className="font-medium">{sampleData.hypotheses.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Evidence:</span>
              <div className="font-medium">{sampleData.evidence.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Scale:</span>
              <div className="font-medium">Logarithmic (Fibonacci)</div>
            </div>
            <div>
              <span className="text-gray-500">SATS Evaluated:</span>
              <div className="font-medium">Yes</div>
            </div>
          </div>
        </div>

        <ACHExport data={sampleData} />
      </div>
    </div>
  )
}