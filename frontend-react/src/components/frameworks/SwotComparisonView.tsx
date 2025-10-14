import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, AlertTriangle, Target, Zap, Award, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface SwotItem {
  id: string
  text: string
  evidence_ids?: string[]
  confidence?: number
  tags?: string[]
}

interface SwotData {
  id: string
  title: string
  description: string
  strengths: SwotItem[]
  weaknesses: SwotItem[]
  opportunities: SwotItem[]
  threats: SwotItem[]
  tags?: string[]
}

interface SwotComparisonViewProps {
  analyses: SwotData[]
  comparisonTag: string
  onClose: () => void
}

export function SwotComparisonView({ analyses, comparisonTag, onClose }: SwotComparisonViewProps) {
  const navigate = useNavigate()

  // Calculate comparison metrics
  const metrics = analyses.map(analysis => ({
    id: analysis.id,
    title: analysis.title,
    strengthCount: analysis.strengths.length,
    weaknessCount: analysis.weaknesses.length,
    opportunityCount: analysis.opportunities.length,
    threatCount: analysis.threats.length,
    totalPositive: analysis.strengths.length + analysis.opportunities.length,
    totalNegative: analysis.weaknesses.length + analysis.threats.length,
    evidenceCount: [
      ...analysis.strengths,
      ...analysis.weaknesses,
      ...analysis.opportunities,
      ...analysis.threats
    ].reduce((sum, item) => sum + (item.evidence_ids?.length || 0), 0)
  }))

  // Calculate scoring (simple heuristic: positive items - negative items + evidence)
  const scoredAnalyses = metrics.map(m => ({
    ...m,
    score: (m.totalPositive * 2) - (m.totalNegative * 1.5) + (m.evidenceCount * 0.5)
  })).sort((a, b) => b.score - a.score)

  const getBestInCategory = (category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats') => {
    const counts = analyses.map(a => ({
      title: a.title,
      count: a[category].length
    }))
    return counts.sort((a, b) => b.count - a.count)[0]
  }

  const CategoryComparison = ({
    title,
    items,
    color,
    bgColor,
    icon: Icon
  }: {
    title: string
    items: { analysis: string; items: SwotItem[] }[]
    color: string
    bgColor: string
    icon: any
  }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map(({ analysis, items: categoryItems }, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                  {analysis}
                </h4>
                <Badge variant="secondary">{categoryItems.length}</Badge>
              </div>
              {categoryItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic pl-2">None identified</p>
              ) : (
                <ul className="space-y-1.5">
                  {categoryItems.slice(0, 3).map((item, itemIdx) => (
                    <li key={itemIdx} className={`text-sm p-2 rounded ${bgColor}`}>
                      {item.text}
                      {item.evidence_ids && item.evidence_ids.length > 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {item.evidence_ids.length} evidence
                        </Badge>
                      )}
                    </li>
                  ))}
                  {categoryItems.length > 3 && (
                    <p className="text-xs text-gray-500 italic pl-2">
                      +{categoryItems.length - 3} more...
                    </p>
                  )}
                </ul>
              )}
              {idx < items.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Comparison: {comparisonTag}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comparing {analyses.length} analyses
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close Comparison
        </Button>
      </div>

      {/* Ranking Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            Decision Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scoredAnalyses.map((item, idx) => {
              const analysis = analyses.find(a => a.id === item.id)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all cursor-pointer hover:shadow-md ${
                    idx === 0
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400'
                      : 'bg-white dark:bg-gray-800 border'
                  }`}
                  onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${item.id}`)}
                >
                  <div className="flex-shrink-0">
                    {idx === 0 && <span className="text-3xl">🏆</span>}
                    {idx === 1 && <span className="text-3xl">🥈</span>}
                    {idx === 2 && <span className="text-3xl">🥉</span>}
                    {idx > 2 && (
                      <span className="text-xl font-bold text-gray-400">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {analysis?.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {item.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {item.totalPositive}
                      </div>
                      <div className="text-gray-500">positive</div>
                    </div>
                    <div>
                      <div className="font-semibold text-red-600 dark:text-red-400">
                        {item.totalNegative}
                      </div>
                      <div className="text-gray-500">negative</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Strengths</div>
              <div className="font-bold text-green-600 dark:text-green-400 text-lg">
                {getBestInCategory('strengths').title}
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {getBestInCategory('strengths').count}
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Weaknesses</div>
              <div className="font-bold text-red-600 dark:text-red-400 text-lg">
                {getBestInCategory('weaknesses').title}
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {getBestInCategory('weaknesses').count}
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Opportunities</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                {getBestInCategory('opportunities').title}
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {getBestInCategory('opportunities').count}
              </div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Most Threats</div>
              <div className="font-bold text-orange-600 dark:text-orange-400 text-lg">
                {getBestInCategory('threats').title}
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {getBestInCategory('threats').count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CategoryComparison
          title="Strengths"
          items={analyses.map(a => ({ analysis: a.title, items: a.strengths }))}
          color="border-green-500"
          bgColor="bg-green-50 dark:bg-green-900/20"
          icon={TrendingUp}
        />
        <CategoryComparison
          title="Weaknesses"
          items={analyses.map(a => ({ analysis: a.title, items: a.weaknesses }))}
          color="border-red-500"
          bgColor="bg-red-50 dark:bg-red-900/20"
          icon={AlertTriangle}
        />
        <CategoryComparison
          title="Opportunities"
          items={analyses.map(a => ({ analysis: a.title, items: a.opportunities }))}
          color="border-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          icon={Target}
        />
        <CategoryComparison
          title="Threats"
          items={analyses.map(a => ({ analysis: a.title, items: a.threats }))}
          color="border-orange-500"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          icon={Zap}
        />
      </div>

      {/* Individual Analysis Links */}
      <Card>
        <CardHeader>
          <CardTitle>View Individual Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {analyses.map(analysis => (
              <Button
                key={analysis.id}
                variant="outline"
                className="justify-start"
                onClick={() => navigate(`/dashboard/analysis-frameworks/swot-dashboard/${analysis.id}`)}
              >
                {analysis.title}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
