'use client'

// Force dynamic rendering to avoid useSearchParams build issues
export const dynamic = 'force-dynamic'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Brain,
  FileText,
  Plus,
  Search,
  Target,
  Users,
  Activity,
  Clock,
  TrendingUp,
  Shield,
  Zap,
  Sparkles,
  ChevronRight,
  Calendar,
  Star,
  Award,
  ArrowUpRight,
  Layers,
  Database,
  Globe,
  Rocket
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRecentSessions, useFrameworkSessions, useFrameworkLoading, useFrameworkStore } from '@/stores/frameworks'
import { formatRelativeTime } from '@/lib/utils'

export default function DashboardPage() {
  const recentSessions = useRecentSessions()
  const allSessions = useFrameworkSessions()
  const isLoading = useFrameworkLoading()

  // Use the store directly to get stable function references
  const fetchSessions = useFrameworkStore((state) => state.fetchSessions)
  const fetchRecentSessions = useFrameworkStore((state) => state.fetchRecentSessions)

  // Fetch data when component mounts
  useEffect(() => {
    fetchSessions()
    fetchRecentSessions()
  }, []) // Empty dependency array - only run once on mount

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const stagger = {
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  // Calculate framework stats from real data
  const frameworkStats = useMemo(() => {
    const swotCount = allSessions.filter(s => s.framework_type === 'swot').length
    const cogCount = allSessions.filter(s => s.framework_type === 'cog').length
    const pmesiiCount = allSessions.filter(s => s.framework_type === 'pmesii-pt').length
    const achCount = allSessions.filter(s => s.framework_type === 'ach').length

    return [
      {
        name: 'SWOT Analysis',
        count: swotCount,
        trend: swotCount > 0 ? `${swotCount} analyses` : 'No analyses yet',
        icon: Target,
        color: 'bg-blue-500',
        gradient: 'from-blue-500 to-blue-600'
      },
      {
        name: 'COG Analysis',
        count: cogCount,
        trend: cogCount > 0 ? `${cogCount} analyses` : 'No analyses yet',
        icon: Brain,
        color: 'bg-green-500',
        gradient: 'from-green-500 to-green-600'
      },
      {
        name: 'PMESII-PT',
        count: pmesiiCount,
        trend: pmesiiCount > 0 ? `${pmesiiCount} analyses` : 'No analyses yet',
        icon: BarChart3,
        color: 'bg-purple-500',
        gradient: 'from-purple-500 to-purple-600'
      },
      {
        name: 'ACH Analysis',
        count: achCount,
        trend: achCount > 0 ? `${achCount} analyses` : 'No analyses yet',
        icon: Search,
        color: 'bg-orange-500',
        gradient: 'from-orange-500 to-orange-600'
      },
    ]
  }, [allSessions])

  // Calculate overall stats
  const totalAnalyses = allSessions.length
  const activeSessions = allSessions.filter(s => s.status === 'in_progress').length
  const completedAnalyses = allSessions.filter(s => s.status === 'completed').length

  const quickActions = [
    {
      title: 'New SWOT Analysis',
      description: 'Strategic planning analysis',
      href: '/frameworks/swot/create',
      icon: Target,
      color: 'bg-blue-500 hover:bg-blue-600',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      title: 'COG Analysis',
      description: 'Center of gravity assessment',
      href: '/frameworks/cog/create',
      icon: Brain,
      color: 'bg-green-500 hover:bg-green-600',
      gradient: 'from-green-500 to-green-600'
    },
    {
      title: 'Research Tools',
      description: 'URL processing & citations',
      href: '/tools',
      icon: Search,
      color: 'bg-purple-500 hover:bg-purple-600',
      gradient: 'from-purple-500 to-purple-600'
    },
    {
      title: 'View Reports',
      description: 'Export and share analyses',
      href: '/reports',
      icon: FileText,
      color: 'bg-orange-500 hover:bg-orange-600',
      gradient: 'from-orange-500 to-orange-600'
    },
  ]

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/10"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      <div className="space-y-8 p-6">
        {/* Hero Welcome Section */}
        <motion.div
          className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-2xl"
          variants={fadeInUp}
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />

          <div className="relative z-10">
            <motion.div
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Intelligence Command Center</span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              Welcome to Research Analysis Tools
            </h1>
            <p className="text-xl text-white/90 mb-6">
              Transform data into actionable intelligence with advanced analytical frameworks
            </p>

            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {activeSessions} Active Sessions
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Edge-Native Performance
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview with animations */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={stagger}
        >
          <motion.div variants={fadeInUp} whileHover={{ scale: 1.05, y: -5 }}>
            <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Analyses</CardTitle>
                <motion.div
                  className="p-2 bg-blue-600 rounded-lg"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Activity className="h-4 w-4 text-white" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-3xl font-bold text-gray-900 dark:text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isLoading ? '...' : totalAnalyses}
                </motion.div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-green-600 font-medium">+12% from last month</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} whileHover={{ scale: 1.05, y: -5 }}>
            <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800 shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Active Sessions</CardTitle>
                <div className="p-2 bg-green-600 rounded-lg animate-pulse">
                  <Clock className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-3xl font-bold text-gray-900 dark:text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isLoading ? '...' : activeSessions}
                </motion.div>
                <div className="flex items-center gap-1 mt-2">
                  <Zap className="h-3 w-3 text-yellow-600" />
                  <p className="text-xs text-yellow-600 font-medium">Live now</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} whileHover={{ scale: 1.05, y: -5 }}>
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Completed</CardTitle>
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Award className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-3xl font-bold text-gray-900 dark:text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {isLoading ? '...' : completedAnalyses}
                </motion.div>
                <div className="flex items-center gap-1 mt-2">
                  <Star className="h-3 w-3 text-purple-600" />
                  <p className="text-xs text-purple-600 font-medium">Great progress!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} whileHover={{ scale: 1.05, y: -5 }}>
            <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800 shadow-lg hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Team Members</CardTitle>
                <div className="p-2 bg-orange-600 rounded-lg">
                  <Users className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-3xl font-bold text-gray-900 dark:text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  12
                </motion.div>
                <div className="flex items-center gap-1 mt-2">
                  <Shield className="h-3 w-3 text-orange-600" />
                  <p className="text-xs text-orange-600 font-medium">Secure collaboration</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Quick Actions with hover animations */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Rocket className="h-6 w-6 text-yellow-500" />
              Quick Actions
            </h2>
            <Link href="/frameworks">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
                View all frameworks
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={stagger}
          >
            {quickActions.map((action, index) => (
              <motion.div
                key={action.title}
                variants={fadeInUp}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link href={action.href}>
                  <Card className="h-full hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden group">
                    <div className={`h-1 bg-gradient-to-r ${action.gradient}`} />
                    <CardHeader>
                      <motion.div
                        className={`w-12 h-12 bg-gradient-to-r ${action.gradient} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg`}
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      >
                        <action.icon className="h-6 w-6 text-white" />
                      </motion.div>
                      <CardTitle className="text-lg font-bold">{action.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {action.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                        Start now
                        <ArrowUpRight className="ml-1 h-3 w-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity with animations */}
          <motion.div variants={fadeInUp}>
            <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentSessions.length > 0 ? (
                  <motion.div className="space-y-3" variants={stagger}>
                    {recentSessions.slice(0, 5).map((session, index) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 5 }}
                      >
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                          <motion.div
                            className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-md"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                          >
                            <Brain className="h-5 w-5 text-white" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/frameworks/${session.framework_type}/${session.id}`}
                              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
                            >
                              {session.title}
                            </Link>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {session.framework_type.toUpperCase()} • {formatRelativeTime(session.updated_at)}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            session.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            session.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                          }`}>
                            {session.status.replace('_', ' ')}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    className="text-center py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Brain className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                    </motion.div>
                    <p className="text-sm text-gray-500 font-medium">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">Start a new analysis to see it here</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Framework Usage with progress bars */}
          <motion.div variants={fadeInUp}>
            <Card className="hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Framework Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div className="space-y-4" variants={stagger}>
                  {frameworkStats.map((framework, index) => (
                    <motion.div
                      key={framework.name}
                      variants={fadeInUp}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <motion.div
                          className={`w-10 h-10 bg-gradient-to-r ${framework.gradient} rounded-full flex items-center justify-center shadow-md`}
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                        >
                          <framework.icon className="h-5 w-5 text-white" />
                        </motion.div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{framework.name}</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">{framework.count}</span>
                          </div>
                          <p className="text-xs text-gray-500">{framework.trend}</p>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${framework.gradient}`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${(framework.count / Math.max(...frameworkStats.map(f => f.count), 1)) * 100}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Call to Action with animation */}
        <motion.div variants={fadeInUp} whileHover={{ scale: 1.02 }}>
          <Card className="relative overflow-hidden border-dashed border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/10 dark:via-purple-900/10 dark:to-pink-900/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
            <CardContent className="relative z-10 flex flex-col items-center justify-center py-12">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              >
                <Plus className="h-16 w-16 text-blue-500 mb-4" />
              </motion.div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">Start a New Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-6 max-w-md">
                Choose from 16+ research analysis frameworks powered by edge computing for instant insights
              </p>
              <Link href="/frameworks">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Analysis
                  <Sparkles className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}