import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BookOpen,
  Calendar,
  Users,
  Database,
  BarChart3,
  Shield,
  Share2,
  Edit,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface Milestone {
  phase: string
  tasks: string[]
  duration: string
  deliverables: string[]
}

interface ResearchPlan {
  methodology: {
    approach: string
    design: string
    rationale: string
    dataCollection: string[]
    sampling: string
    sampleSize: string
  }
  timeline: {
    totalDuration: string
    milestones: Milestone[]
    criticalPath: string[]
  }
  resources: {
    personnel: string[]
    equipment: string[]
    software: string[]
    funding: string
    facilities: string[]
  }
  literatureReview: {
    databases: string[]
    searchTerms: string[]
    inclusionCriteria: string[]
    exclusionCriteria: string[]
    expectedSources: number
  }
  dataAnalysis: {
    quantitativeTests: string[]
    qualitativeApproaches: string[]
    software: string[]
    validationMethods: string[]
  }
  ethicalConsiderations: {
    irbRequired: boolean
    riskLevel: string
    consentRequired: boolean
    privacyMeasures: string[]
    potentialRisks: string[]
  }
  dissemination: {
    targetJournals: string[]
    conferences: string[]
    stakeholders: string[]
    formats: string[]
  }
}

interface ResearchPlanDisplayProps {
  plan: ResearchPlan
  onEdit?: (section: string, updatedData: any) => void
  onExport?: () => void
}

export default function ResearchPlanDisplay({ plan, onEdit, onExport }: ResearchPlanDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [editingSection, setEditingSection] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-purple-600" />
                Your Research Plan
              </CardTitle>
              <CardDescription>
                A comprehensive, actionable plan for your research project
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {onExport && (
                <Button variant="outline" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview Cards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{plan.methodology.approach}</div>
                <div className="text-sm text-gray-500 mt-1">Research Approach</div>
                <div className="text-xs text-gray-400 mt-2">{plan.methodology.design}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{plan.timeline.totalDuration}</div>
                <div className="text-sm text-gray-500 mt-1">Total Duration</div>
                <div className="text-xs text-gray-400 mt-2">{plan.timeline.milestones.length} milestones</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {plan.ethicalConsiderations.riskLevel}
                </div>
                <div className="text-sm text-gray-500 mt-1">Risk Level</div>
                <div className="text-xs text-gray-400 mt-2">
                  {plan.ethicalConsiderations.irbRequired ? 'IRB Required' : 'No IRB Required'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="literature">Literature</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="ethics">Ethics</TabsTrigger>
          <TabsTrigger value="dissemination">Dissemination</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Research Plan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Methodology</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{plan.methodology.rationale}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Data Collection</h4>
                <div className="flex flex-wrap gap-2">
                  {plan.methodology.dataCollection.map((method, i) => (
                    <Badge key={i} variant="secondary">{method}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Critical Path</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {plan.timeline.criticalPath.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Methodology Tab */}
        <TabsContent value="methodology">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Methodology
                  </CardTitle>
                  <CardDescription>Research approach and design</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('methodology')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Approach</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.methodology.approach}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Research Design</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.methodology.design}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Rationale</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.methodology.rationale}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Data Collection Methods</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.methodology.dataCollection.map((method, i) => (
                    <li key={i}>{method}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Sampling Strategy</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.methodology.sampling}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Sample Size</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.methodology.sampleSize}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline & Milestones
                  </CardTitle>
                  <CardDescription>Project schedule and key deliverables</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('timeline')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-semibold">Total Duration</label>
                <p className="text-2xl font-bold text-purple-600 mt-1">{plan.timeline.totalDuration}</p>
              </div>

              <div>
                <label className="text-sm font-semibold mb-3 block">Milestones</label>
                <div className="space-y-4">
                  {plan.timeline.milestones.map((milestone, i) => (
                    <Card key={i} className="border-l-4 border-l-purple-600">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{milestone.phase}</h4>
                          <Badge variant="outline">{milestone.duration}</Badge>
                        </div>
                        <div className="space-y-2 mt-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">TASKS</p>
                            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              {milestone.tasks.map((task, j) => (
                                <li key={j}>{task}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">DELIVERABLES</p>
                            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              {milestone.deliverables.map((deliverable, j) => (
                                <li key={j}>{deliverable}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold">Critical Path</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                  {plan.timeline.criticalPath.map((task, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Resources Required
                  </CardTitle>
                  <CardDescription>Personnel, equipment, and funding</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('resources')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Personnel</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.resources.personnel.map((person, i) => (
                    <li key={i}>{person}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Equipment</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.resources.equipment.map((equip, i) => (
                    <li key={i}>{equip}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Software</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.resources.software.map((soft, i) => (
                    <Badge key={i} variant="secondary">{soft}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Estimated Funding</label>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{plan.resources.funding}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Facilities</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.resources.facilities.map((facility, i) => (
                    <li key={i}>{facility}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Literature Review Tab */}
        <TabsContent value="literature">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Literature Review Strategy
                  </CardTitle>
                  <CardDescription>Search strategy and inclusion criteria</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('literature')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Databases to Search</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.literatureReview.databases.map((db, i) => (
                    <Badge key={i} variant="secondary">{db}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Search Terms</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.literatureReview.searchTerms.map((term, i) => (
                    <Badge key={i} variant="outline">{term}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Inclusion Criteria</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.literatureReview.inclusionCriteria.map((criterion, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Exclusion Criteria</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.literatureReview.exclusionCriteria.map((criterion, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Expected Number of Sources</label>
                <p className="text-2xl font-bold text-purple-600 mt-1">{plan.literatureReview.expectedSources}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Analysis Tab */}
        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Data Analysis Plan
                  </CardTitle>
                  <CardDescription>Statistical tests and validation methods</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('analysis')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.dataAnalysis.quantitativeTests.length > 0 && (
                <div>
                  <label className="text-sm font-semibold">Quantitative Tests</label>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                    {plan.dataAnalysis.quantitativeTests.map((test, i) => (
                      <li key={i}>{test}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.dataAnalysis.qualitativeApproaches.length > 0 && (
                <div>
                  <label className="text-sm font-semibold">Qualitative Approaches</label>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                    {plan.dataAnalysis.qualitativeApproaches.map((approach, i) => (
                      <li key={i}>{approach}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold">Analysis Software</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.dataAnalysis.software.map((soft, i) => (
                    <Badge key={i} variant="secondary">{soft}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Validation Methods</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.dataAnalysis.validationMethods.map((method, i) => (
                    <li key={i}>{method}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ethics Tab */}
        <TabsContent value="ethics">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Ethical Considerations
                  </CardTitle>
                  <CardDescription>IRB, consent, and risk management</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('ethics')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">IRB Required</p>
                  <p className="text-xl font-bold mt-1">
                    {plan.ethicalConsiderations.irbRequired ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Risk Level</p>
                  <p className="text-xl font-bold mt-1">{plan.ethicalConsiderations.riskLevel}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500">Consent Required</p>
                  <p className="text-xl font-bold mt-1">
                    {plan.ethicalConsiderations.consentRequired ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Privacy Measures</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.ethicalConsiderations.privacyMeasures.map((measure, i) => (
                    <li key={i}>{measure}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Potential Risks</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.ethicalConsiderations.potentialRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dissemination Tab */}
        <TabsContent value="dissemination">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Dissemination Strategy
                  </CardTitle>
                  <CardDescription>Publication and presentation plans</CardDescription>
                </div>
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingSection('dissemination')}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Target Journals</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.dissemination.targetJournals.map((journal, i) => (
                    <li key={i}>{journal}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Conferences</label>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                  {plan.dissemination.conferences.map((conf, i) => (
                    <li key={i}>{conf}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-sm font-semibold">Key Stakeholders</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.dissemination.stakeholders.map((stakeholder, i) => (
                    <Badge key={i} variant="secondary">{stakeholder}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Dissemination Formats</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {plan.dissemination.formats.map((format, i) => (
                    <Badge key={i} variant="outline">{format}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
