'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Users, Target, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Stakeholder {
  id: string
  name: string
  role: string
  influence: 'high' | 'medium' | 'low'
  interest: 'high' | 'medium' | 'low'
  supportLevel: 'champion' | 'supportive' | 'neutral' | 'resistant' | 'opponent'
  strategy: string
  concerns: string
  expectations: string
  communication: string
}

export default function CreateStakeholderAnalysisPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [currentStakeholder, setCurrentStakeholder] = useState<Stakeholder>({
    id: '',
    name: '',
    role: '',
    influence: 'medium',
    interest: 'medium',
    supportLevel: 'neutral',
    strategy: '',
    concerns: '',
    expectations: '',
    communication: ''
  })

  const addStakeholder = () => {
    if (currentStakeholder.name && currentStakeholder.role) {
      setStakeholders([...stakeholders, { ...currentStakeholder, id: Date.now().toString() }])
      setCurrentStakeholder({
        id: '',
        name: '',
        role: '',
        influence: 'medium',
        interest: 'medium',
        supportLevel: 'neutral',
        strategy: '',
        concerns: '',
        expectations: '',
        communication: ''
      })
    }
  }

  const removeStakeholder = (id: string) => {
    setStakeholders(stakeholders.filter(s => s.id !== id))
  }

  const getStakeholderQuadrant = (influence: string, interest: string) => {
    if (influence === 'high' && interest === 'high') return 'Manage Closely'
    if (influence === 'high' && interest !== 'high') return 'Keep Satisfied'
    if (influence !== 'high' && interest === 'high') return 'Keep Informed'
    return 'Monitor'
  }

  const getSupportLevelColor = (level: string) => {
    switch (level) {
      case 'champion': return 'text-green-600 bg-green-50'
      case 'supportive': return 'text-blue-600 bg-blue-50'
      case 'neutral': return 'text-gray-600 bg-gray-50'
      case 'resistant': return 'text-orange-600 bg-orange-50'
      case 'opponent': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save to API
    router.push('/frameworks/stakeholder')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/frameworks/stakeholder">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Create Stakeholder Analysis</h1>
            <p className="text-gray-600 mt-1">Map and analyze key stakeholders</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Details</CardTitle>
            <CardDescription>Basic information about your stakeholder analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Project Alpha Stakeholder Map"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the context and purpose of this analysis..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Stakeholder</CardTitle>
            <CardDescription>Define each stakeholder's attributes and engagement strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input 
                  value={currentStakeholder.name}
                  onChange={(e) => setCurrentStakeholder({...currentStakeholder, name: e.target.value})}
                  placeholder="Stakeholder name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role/Position</label>
                <Input 
                  value={currentStakeholder.role}
                  onChange={(e) => setCurrentStakeholder({...currentStakeholder, role: e.target.value})}
                  placeholder="e.g., Department Head, Customer, Investor"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Influence Level</label>
                <Select 
                  value={currentStakeholder.influence}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setCurrentStakeholder({...currentStakeholder, influence: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Interest Level</label>
                <Select 
                  value={currentStakeholder.interest}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setCurrentStakeholder({...currentStakeholder, interest: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Support Level</label>
                <Select 
                  value={currentStakeholder.supportLevel}
                  onValueChange={(value: 'champion' | 'supportive' | 'neutral' | 'resistant' | 'opponent') => 
                    setCurrentStakeholder({...currentStakeholder, supportLevel: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="champion">Champion</SelectItem>
                    <SelectItem value="supportive">Supportive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="resistant">Resistant</SelectItem>
                    <SelectItem value="opponent">Opponent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Key Concerns</label>
                <Textarea 
                  value={currentStakeholder.concerns}
                  onChange={(e) => setCurrentStakeholder({...currentStakeholder, concerns: e.target.value})}
                  placeholder="What are their main concerns?"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Expectations</label>
                <Textarea 
                  value={currentStakeholder.expectations}
                  onChange={(e) => setCurrentStakeholder({...currentStakeholder, expectations: e.target.value})}
                  placeholder="What do they expect from this project?"
                  rows={2}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Engagement Strategy</label>
              <Textarea 
                value={currentStakeholder.strategy}
                onChange={(e) => setCurrentStakeholder({...currentStakeholder, strategy: e.target.value})}
                placeholder="How will you engage with this stakeholder?"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Communication Approach</label>
              <Input 
                value={currentStakeholder.communication}
                onChange={(e) => setCurrentStakeholder({...currentStakeholder, communication: e.target.value})}
                placeholder="e.g., Weekly reports, Monthly meetings, Email updates"
              />
            </div>

            <Button 
              type="button" 
              onClick={addStakeholder}
              disabled={!currentStakeholder.name || !currentStakeholder.role}
            >
              Add Stakeholder
            </Button>
          </CardContent>
        </Card>

        {stakeholders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Stakeholder Map ({stakeholders.length})</CardTitle>
              <CardDescription>Overview of all identified stakeholders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stakeholders.map((stakeholder) => (
                  <div key={stakeholder.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{stakeholder.name}</h4>
                        <p className="text-sm text-gray-600">{stakeholder.role}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStakeholder(stakeholder.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Influence:</span>
                        <span className="ml-2 font-medium capitalize">{stakeholder.influence}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Interest:</span>
                        <span className="ml-2 font-medium capitalize">{stakeholder.interest}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Quadrant:</span>
                        <span className="ml-2 font-medium">
                          {getStakeholderQuadrant(stakeholder.influence, stakeholder.interest)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSupportLevelColor(stakeholder.supportLevel)}`}>
                          {stakeholder.supportLevel}
                        </span>
                      </div>
                    </div>

                    {(stakeholder.concerns || stakeholder.expectations || stakeholder.strategy) && (
                      <div className="space-y-2 pt-3 border-t">
                        {stakeholder.concerns && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Concerns:</span>
                            <p className="text-gray-600 mt-1">{stakeholder.concerns}</p>
                          </div>
                        )}
                        {stakeholder.expectations && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Expectations:</span>
                            <p className="text-gray-600 mt-1">{stakeholder.expectations}</p>
                          </div>
                        )}
                        {stakeholder.strategy && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Strategy:</span>
                            <p className="text-gray-600 mt-1">{stakeholder.strategy}</p>
                          </div>
                        )}
                        {stakeholder.communication && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Communication:</span>
                            <p className="text-gray-600 mt-1">{stakeholder.communication}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={!title || stakeholders.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            Save Analysis
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/frameworks/stakeholder')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}