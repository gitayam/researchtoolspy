'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Brain,
  BarChart3,
  Search,
  Shield,
  Zap,
  Globe,
  Users,
  TrendingUp,
  Eye,
  Lightbulb,
  AlertTriangle,
  Layers,
  Activity,
  Clock,
  Award,
  Filter,
  Grid3x3,
  List,
  Sparkles,
  BookOpen,
  ArrowRight,
  Star,
  ChevronRight,
  X
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FrameworkListSkeleton } from '@/components/loading/framework-card-skeleton'

const frameworks = [
  {
    id: 'swot',
    title: 'SWOT Analysis',
    description: 'Strategic planning framework analyzing Strengths, Weaknesses, Opportunities, and Threats',
    icon: Target,
    color: 'bg-blue-500',
    gradient: 'from-blue-500 to-blue-600',
    hoverColor: 'hover:bg-blue-600',
    category: 'Strategic Planning',
    complexity: 'Beginner',
    estimatedTime: '15-30 min',
    popularity: 95,
    available: true
  },
  {
    id: 'cog',
    title: 'COG Analysis',
    description: 'Center of Gravity analysis for identifying critical capabilities and vulnerabilities',
    icon: Brain,
    color: 'bg-green-500',
    gradient: 'from-green-500 to-green-600',
    hoverColor: 'hover:bg-green-600',
    category: 'Military Strategy',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    popularity: 85,
    available: true
  },
  {
    id: 'pmesii-pt',
    title: 'PMESII-PT',
    description: 'Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time',
    icon: BarChart3,
    color: 'bg-purple-500',
    gradient: 'from-purple-500 to-purple-600',
    hoverColor: 'hover:bg-purple-600',
    category: 'Environmental Analysis',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    popularity: 78,
    available: true
  },
  {
    id: 'ach',
    title: 'ACH Analysis',
    description: 'Analysis of Competing Hypotheses for structured analytical thinking',
    icon: Search,
    color: 'bg-orange-500',
    gradient: 'from-orange-500 to-orange-600',
    hoverColor: 'hover:bg-orange-600',
    category: 'Hypothesis Testing',
    complexity: 'Advanced',
    estimatedTime: '60-90 min',
    popularity: 92,
    available: true
  },
  {
    id: 'dime',
    title: 'DIME Analysis',
    description: 'Diplomatic, Information, Military, Economic instruments of national power',
    icon: Shield,
    color: 'bg-red-500',
    gradient: 'from-red-500 to-red-600',
    hoverColor: 'hover:bg-red-600',
    category: 'National Power',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    popularity: 72,
    available: true
  },
  {
    id: 'vrio',
    title: 'VRIO Framework',
    description: 'Value, Rarity, Imitability, Organization analysis for competitive advantage',
    icon: Zap,
    color: 'bg-yellow-500',
    gradient: 'from-yellow-500 to-yellow-600',
    hoverColor: 'hover:bg-yellow-600',
    category: 'Competitive Analysis',
    complexity: 'Intermediate',
    estimatedTime: '20-30 min',
    popularity: 81,
    available: true
  },
  {
    id: 'pest',
    title: 'PEST Analysis',
    description: 'Political, Economic, Social, Technological environmental factors analysis',
    icon: Globe,
    color: 'bg-teal-500',
    gradient: 'from-teal-500 to-teal-600',
    hoverColor: 'hover:bg-teal-600',
    category: 'Environmental Analysis',
    complexity: 'Beginner',
    estimatedTime: '20-30 min',
    popularity: 88,
    available: true
  },
  {
    id: 'stakeholder',
    title: 'Stakeholder Analysis',
    description: 'Systematic identification and analysis of stakeholder influence and interest',
    icon: Users,
    color: 'bg-pink-500',
    gradient: 'from-pink-500 to-pink-600',
    hoverColor: 'hover:bg-pink-600',
    category: 'Relationship Mapping',
    complexity: 'Beginner',
    estimatedTime: '15-25 min',
    popularity: 76,
    available: true
  },
  {
    id: 'trend',
    title: 'Trend Analysis',
    description: 'Systematic analysis of patterns and trends for forecasting and planning',
    icon: TrendingUp,
    color: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600',
    hoverColor: 'hover:bg-indigo-600',
    category: 'Forecasting',
    complexity: 'Intermediate',
    estimatedTime: '30-40 min',
    popularity: 79,
    available: true
  },
  {
    id: 'surveillance',
    title: 'Surveillance Analysis',
    description: 'Systematic monitoring and analysis framework for research gathering',
    icon: Eye,
    color: 'bg-gray-500',
    gradient: 'from-gray-500 to-gray-600',
    hoverColor: 'hover:bg-gray-600',
    category: 'Research',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    popularity: 68,
    available: true
  },
  {
    id: 'starbursting',
    title: 'Starbursting',
    description: 'Systematic questioning framework with 5W analysis and URL processing',
    icon: Lightbulb,
    color: 'bg-amber-500',
    gradient: 'from-amber-500 to-amber-600',
    hoverColor: 'hover:bg-amber-600',
    category: 'Question Analysis',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    popularity: 74,
    available: true
  },
  {
    id: 'dotmlpf',
    title: 'DOTMLPF-P',
    description: 'Military capability assessment across Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities, and Policy',
    icon: Shield,
    color: 'bg-amber-600',
    gradient: 'from-amber-600 to-amber-700',
    hoverColor: 'hover:bg-amber-700',
    category: 'Military Strategy',
    complexity: 'Advanced',
    estimatedTime: '60-90 min',
    popularity: 65,
    available: true
  },
  {
    id: 'behavior',
    title: 'Behavior Analysis',
    description: 'COM-B model for understanding and changing behavior through Capability, Opportunity, and Motivation assessment',
    icon: Activity,
    color: 'bg-emerald-600',
    gradient: 'from-emerald-600 to-emerald-700',
    hoverColor: 'hover:bg-emerald-700',
    category: 'Behavioral Science',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    popularity: 71,
    available: true
  },
  {
    id: 'causeway',
    title: 'Causeway Analysis',
    description: 'Systematic cause-and-effect analysis for understanding complex relationships and dependencies',
    icon: Layers,
    color: 'bg-cyan-600',
    gradient: 'from-cyan-600 to-cyan-700',
    hoverColor: 'hover:bg-cyan-700',
    category: 'Causal Analysis',
    complexity: 'Intermediate',
    estimatedTime: '30-45 min',
    popularity: 70,
    available: true
  },
  {
    id: 'fundamental-flow',
    title: 'Fundamental Flow',
    description: 'Strategic flow analysis for understanding core processes and critical pathways',
    icon: TrendingUp,
    color: 'bg-violet-600',
    gradient: 'from-violet-600 to-violet-700',
    hoverColor: 'hover:bg-violet-700',
    category: 'Process Analysis',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    popularity: 66,
    available: true
  },
  {
    id: 'deception',
    title: 'Deception Detection',
    description: 'Systematic analysis to identify potential deception, misinformation, and credibility issues in content',
    icon: AlertTriangle,
    color: 'bg-orange-600',
    gradient: 'from-orange-600 to-orange-700',
    hoverColor: 'hover:bg-orange-700',
    category: 'Information Analysis',
    complexity: 'Advanced',
    estimatedTime: '45-60 min',
    popularity: 83,
    available: true
  }
]

const categories = [
  'All',
  'Strategic Planning',
  'Military Strategy',
  'Environmental Analysis',
  'Hypothesis Testing',
  'National Power',
  'Competitive Analysis',
  'Relationship Mapping',
  'Forecasting',
  'Research',
  'Question Analysis',
  'Behavioral Science',
  'Information Analysis',
  'Causal Analysis',
  'Process Analysis'
]

const complexityLevels = ['All', 'Beginner', 'Intermediate', 'Advanced']

export default function FrameworksPage() {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedComplexity, setSelectedComplexity] = useState('All')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'popularity' | 'name' | 'time'>('popularity')

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const stagger = {
    visible: {
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  // Simulate loading state for initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Filter and sort frameworks
  const filteredFrameworks = useMemo(() => {
    let filtered = frameworks.filter(framework => {
      const matchesSearch = framework.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           framework.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || framework.category === selectedCategory
      const matchesComplexity = selectedComplexity === 'All' || framework.complexity === selectedComplexity
      return matchesSearch && matchesCategory && matchesComplexity && framework.available
    })

    // Sort frameworks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.popularity - a.popularity
        case 'name':
          return a.title.localeCompare(b.title)
        case 'time':
          const getMinTime = (time: string) => parseInt(time.split('-')[0])
          return getMinTime(a.estimatedTime) - getMinTime(b.estimatedTime)
        default:
          return 0
      }
    })

    return filtered
  }, [searchTerm, selectedCategory, selectedComplexity, sortBy])

  if (loading) {
    return (
      <motion.div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/10 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Analysis Frameworks</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Loading frameworks...
            </p>
          </div>
          <FrameworkListSkeleton />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/10"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <div className="p-6 space-y-8">
        {/* Hero Header */}
        <motion.div
          className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-2xl"
          variants={fadeInUp}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />

          <div className="relative z-10">
            <motion.div
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">16+ Intelligence Frameworks</span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              Analysis Frameworks
            </h1>
            <p className="text-xl text-white/90 mb-6 max-w-3xl">
              Choose from our comprehensive suite of research and intelligence analysis frameworks,
              each designed to provide structured approaches to complex analytical challenges.
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <BookOpen className="h-4 w-4" />
                {frameworks.length} Frameworks Available
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <Clock className="h-4 w-4" />
                15 min - 90 min Duration
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <Award className="h-4 w-4" />
                All Skill Levels
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
          variants={fadeInUp}
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search frameworks by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-12 text-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Complexity Filter */}
            <select
              value={selectedComplexity}
              onChange={(e) => setSelectedComplexity(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {complexityLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="popularity">Most Popular</option>
              <option value="name">Alphabetical</option>
              <option value="time">Shortest First</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategory !== 'All' || selectedComplexity !== 'All' || searchTerm) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {searchTerm && (
                <Badge variant="secondary" className="px-3 py-1">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory !== 'All' && (
                <Badge variant="secondary" className="px-3 py-1">
                  Category: {selectedCategory}
                  <button onClick={() => setSelectedCategory('All')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedComplexity !== 'All' && (
                <Badge variant="secondary" className="px-3 py-1">
                  Complexity: {selectedComplexity}
                  <button onClick={() => setSelectedComplexity('All')} className="ml-2">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </motion.div>

        {/* Results Count */}
        <motion.div
          className="flex items-center justify-between"
          variants={fadeInUp}
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredFrameworks.length} Frameworks Found
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Filter className="h-4 w-4" />
            Sorted by {sortBy === 'popularity' ? 'popularity' : sortBy === 'name' ? 'name' : 'duration'}
          </div>
        </motion.div>

        {/* Frameworks Grid/List */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            className={viewMode === 'grid' ?
              'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' :
              'space-y-4'
            }
            variants={stagger}
          >
            {filteredFrameworks.map((framework, index) => {
              const getComplexityColor = (complexity: string) => {
                switch (complexity) {
                  case 'Beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  case 'Intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  case 'Advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                }
              }

              return (
                <motion.div
                  key={framework.id}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  whileHover={{ scale: viewMode === 'grid' ? 1.03 : 1.01, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link href={`/analysis-frameworks/${framework.id === 'swot' ? 'swot-dashboard' : framework.id === 'ach' ? 'ach-dashboard' : framework.id}/create`}>
                    {viewMode === 'grid' ? (
                      <Card className="h-full hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden bg-white dark:bg-gray-800">
                        <div className={`h-2 bg-gradient-to-r ${framework.gradient}`} />
                        <CardHeader>
                          <div className="flex items-start justify-between mb-3">
                            <motion.div
                              className={`w-14 h-14 rounded-xl bg-gradient-to-r ${framework.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                              animate={{ rotate: [0, 5, -5, 0] }}
                              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
                            >
                              <framework.icon className="h-7 w-7 text-white" />
                            </motion.div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">{framework.popularity}%</span>
                            </div>
                          </div>
                          <CardTitle className="text-lg font-bold">{framework.title}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2 mt-2">
                            {framework.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                {framework.category}
                              </Badge>
                              <Badge className={`text-xs ${getComplexityColor(framework.complexity)}`}>
                                {framework.complexity}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <Clock className="h-4 w-4" />
                              <span>{framework.estimatedTime}</span>
                            </div>

                            <Button className={`w-full bg-gradient-to-r ${framework.gradient} hover:opacity-90 text-white shadow-md hover:shadow-lg transition-all`}>
                              Start Analysis
                              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group bg-white dark:bg-gray-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-6">
                            <motion.div
                              className={`w-16 h-16 rounded-xl bg-gradient-to-r ${framework.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                              whileHover={{ rotate: 360 }}
                              transition={{ duration: 0.5 }}
                            >
                              <framework.icon className="h-8 w-8 text-white" />
                            </motion.div>

                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{framework.title}</h3>
                                <Badge variant="outline">{framework.category}</Badge>
                                <Badge className={getComplexityColor(framework.complexity)}>
                                  {framework.complexity}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  <span className="text-sm font-medium">{framework.popularity}%</span>
                                </div>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 mb-3">{framework.description}</p>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <Clock className="h-4 w-4" />
                                  <span>{framework.estimatedTime}</span>
                                </div>
                                <Button size="sm" className={`bg-gradient-to-r ${framework.gradient} hover:opacity-90 text-white`}>
                                  Start Analysis
                                  <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>

        {/* Empty State */}
        {filteredFrameworks.length === 0 && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No frameworks found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('All')
                setSelectedComplexity('All')
              }}
            >
              Clear all filters
            </Button>
          </motion.div>
        )}

        {/* Help Section */}
        <motion.div
          className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-xl p-6 text-center"
          variants={fadeInUp}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Need help choosing a framework?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Our AI assistant can recommend the best framework based on your specific needs
          </p>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            Get AI Recommendations
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}