/**
 * Starbursting Progress Dashboard
 * Visual progress tracking for question completion
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { QuestionAnswerItem } from '@/types/frameworks'
import { isQuestionAnswerItem } from '@/types/frameworks'

interface CategoryStats {
  total: number
  answered: number
  answeredWithEvidence: number
  critical: number
  high: number
}

interface StarburstingDashboardProps {
  sectionData: Record<string, any[]>
  questionEvidence?: { [questionId: string]: any[] }
}

export function StarburstingDashboard({ sectionData, questionEvidence = {} }: StarburstingDashboardProps) {
  const categories = ['who', 'what', 'when', 'where', 'why', 'how']
  const categoryLabels: Record<string, string> = {
    who: 'Who',
    what: 'What',
    when: 'When',
    where: 'Where',
    why: 'Why',
    how: 'How'
  }

  const categoryIcons: Record<string, string> = {
    who: '👤',
    what: '❓',
    when: '⏰',
    where: '📍',
    why: '💡',
    how: '⚙️'
  }

  // Calculate stats per category
  const categoryStats: Record<string, CategoryStats> = {}
  let totalQuestions = 0
  let totalAnswered = 0
  let totalWithEvidence = 0
  let totalCritical = 0
  let totalHigh = 0

  categories.forEach(cat => {
    const items = sectionData[cat] || []
    const questions = items.filter(isQuestionAnswerItem) as QuestionAnswerItem[]

    const answered = questions.filter(q => q.answer && q.answer.trim().length > 0).length
    const answeredWithEvidence = questions.filter(q =>
      q.answer && q.answer.trim().length > 0 &&
      q.evidence_ids && q.evidence_ids.length > 0
    ).length
    const critical = questions.filter(q => q.priority === 'critical').length
    const high = questions.filter(q => q.priority === 'high').length

    categoryStats[cat] = {
      total: questions.length,
      answered,
      answeredWithEvidence,
      critical,
      high
    }

    totalQuestions += questions.length
    totalAnswered += answered
    totalWithEvidence += answeredWithEvidence
    totalCritical += critical
    totalHigh += high
  })

  const completionPercentage = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0
  const evidencePercentage = totalAnswered > 0 ? (totalWithEvidence / totalAnswered) * 100 : 0

  // Get high-priority unanswered questions
  const unansweredHighPriority: Array<{ category: string; question: string; priority: string }> = []

  categories.forEach(cat => {
    const items = sectionData[cat] || []
    const questions = items.filter(isQuestionAnswerItem) as QuestionAnswerItem[]

    questions.forEach(q => {
      if ((!q.answer || q.answer.trim().length === 0) && (q.priority === 'critical' || q.priority === 'high')) {
        unansweredHighPriority.push({
          category: cat,
          question: q.question,
          priority: q.priority || 'medium'
        })
      }
    })
  })

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Progress</CardTitle>
          <CardDescription>Question completion overview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Questions Answered</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalAnswered} / {totalQuestions}
              </span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {completionPercentage.toFixed(1)}% complete
            </p>
          </div>

          {totalAnswered > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">With Evidence Support</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  {totalWithEvidence} / {totalAnswered}
                </span>
              </div>
              <Progress value={evidencePercentage} className="h-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {evidencePercentage.toFixed(1)}% of answers have evidence
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Answered with evidence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Answered without evidence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Unanswered (high priority)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
              <span>Unanswered (low priority)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Progress by question type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categories.map(cat => {
              const stats = categoryStats[cat]
              const percentage = stats.total > 0 ? (stats.answered / stats.total) * 100 : 0

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryIcons[cat]}</span>
                      <span className="font-medium text-sm">{categoryLabels[cat]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {stats.answered}/{stats.total}
                      </span>
                      {stats.critical > 0 && (
                        <Badge variant="destructive" className="text-xs h-5">
                          {stats.critical} critical
                        </Badge>
                      )}
                      {stats.high > 0 && (
                        <Badge variant="secondary" className="text-xs h-5 bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                          {stats.high} high
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* High-Priority Unanswered */}
      {unansweredHighPriority.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">High-Priority Unanswered</CardTitle>
            <CardDescription>Critical and high-priority questions needing answers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unansweredHighPriority.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800">
                  <Badge
                    variant={item.priority === 'critical' ? 'destructive' : 'secondary'}
                    className="text-xs shrink-0 mt-0.5"
                  >
                    {item.priority}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                      {categoryIcons[item.category]} {categoryLabels[item.category]}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-gray-100 break-words">
                      {item.question}
                    </div>
                  </div>
                </div>
              ))}
              {unansweredHighPriority.length > 5 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                  + {unansweredHighPriority.length - 5} more high-priority questions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
