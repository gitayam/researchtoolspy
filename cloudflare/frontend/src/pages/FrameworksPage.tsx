import { Link } from 'react-router-dom';
import {
  Brain,
  Target,
  Search,
  Users,
  Shield,
  TrendingUp,
  Zap,
  Eye,
  Star,
  Globe,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { Card } from '@/components/ui/card';

const frameworks = [
  {
    id: 'swot',
    title: 'SWOT Analysis',
    path: '/frameworks/swot',
    icon: <Target className="h-8 w-8 text-blue-600" />,
    description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats systematically.',
    category: 'Strategic Analysis',
    difficulty: 'Beginner',
    time: '15-30 mins',
  },
  {
    id: 'ach',
    title: 'ACH Analysis',
    path: '/frameworks/ach',
    icon: <Brain className="h-8 w-8 text-purple-600" />,
    description: 'Analysis of Competing Hypotheses for complex intelligence problems.',
    category: 'Intelligence Analysis',
    difficulty: 'Advanced',
    time: '45-90 mins',
  },
  {
    id: 'pmesii-pt',
    title: 'PMESII-PT',
    path: '/frameworks/pmesii-pt',
    icon: <Users className="h-8 w-8 text-green-600" />,
    description: 'Political, Military, Economic, Social, Information, Infrastructure analysis.',
    category: 'Environmental Analysis',
    difficulty: 'Intermediate',
    time: '30-60 mins',
  },
  {
    id: 'dotmlpf',
    title: 'DOTMLPF-P',
    path: '/frameworks/dotmlpf',
    icon: <Shield className="h-8 w-8 text-red-600" />,
    description: 'Doctrine, Organization, Training, Materiel, Leadership assessment.',
    category: 'Capability Analysis',
    difficulty: 'Advanced',
    time: '60-120 mins',
  },
  {
    id: 'pest',
    title: 'PEST Analysis',
    path: '/frameworks/pest',
    icon: <Globe className="h-8 w-8 text-orange-600" />,
    description: 'Political, Economic, Social, and Technological environmental analysis.',
    category: 'Environmental Analysis',
    difficulty: 'Beginner',
    time: '20-40 mins',
  },
  {
    id: 'vrio',
    title: 'VRIO Framework',
    path: '/frameworks/vrio',
    icon: <Star className="h-8 w-8 text-yellow-600" />,
    description: 'Value, Rarity, Imitability, and Organization resource analysis.',
    category: 'Resource Analysis',
    difficulty: 'Intermediate',
    time: '30-45 mins',
  },
  {
    id: 'trend',
    title: 'Trend Analysis',
    path: '/frameworks/trend',
    icon: <TrendingUp className="h-8 w-8 text-teal-600" />,
    description: 'Systematic analysis of patterns and trends over time.',
    category: 'Trend Analysis',
    difficulty: 'Intermediate',
    time: '45-75 mins',
  },
  {
    id: 'dime',
    title: 'DIME Analysis',
    path: '/frameworks/dime',
    icon: <Zap className="h-8 w-8 text-indigo-600" />,
    description: 'Diplomatic, Information, Military, Economic power analysis.',
    category: 'Power Analysis',
    difficulty: 'Advanced',
    time: '60-90 mins',
  },
  {
    id: 'cog',
    title: 'Center of Gravity',
    path: '/frameworks/cog',
    icon: <Target className="h-8 w-8 text-pink-600" />,
    description: 'Identify critical vulnerabilities and decisive points.',
    category: 'Strategic Analysis',
    difficulty: 'Advanced',
    time: '45-75 mins',
  },
  {
    id: 'stakeholder',
    title: 'Stakeholder Analysis',
    path: '/frameworks/stakeholder',
    icon: <Users className="h-8 w-8 text-emerald-600" />,
    description: 'Map and analyze stakeholder influence and interests.',
    category: 'Stakeholder Analysis',
    difficulty: 'Intermediate',
    time: '30-60 mins',
  },
  {
    id: 'starbursting',
    title: 'Starbursting',
    path: '/frameworks/starbursting',
    icon: <Star className="h-8 w-8 text-cyan-600" />,
    description: 'Question-based brainstorming technique for problem exploration.',
    category: 'Problem Analysis',
    difficulty: 'Beginner',
    time: '20-40 mins',
  },
  {
    id: 'fundamental-flow',
    title: 'Fundamental Flow',
    path: '/frameworks/fundamental-flow',
    icon: <Activity className="h-8 w-8 text-violet-600" />,
    description: 'Analyze fundamental flows and dependencies in systems.',
    category: 'Systems Analysis',
    difficulty: 'Intermediate',
    time: '45-60 mins',
  },
  {
    id: 'behavior',
    title: 'Behavioral Analysis',
    path: '/frameworks/behavior',
    icon: <Brain className="h-8 w-8 text-rose-600" />,
    description: 'COM-B model for behavior change and influence analysis.',
    category: 'Behavioral Analysis',
    difficulty: 'Intermediate',
    time: '30-50 mins',
  },
  {
    id: 'causeway',
    title: 'Causeway Analysis',
    path: '/frameworks/causeway',
    icon: <AlertTriangle className="h-8 w-8 text-amber-600" />,
    description: 'Systematic threat and vulnerability assessment methodology.',
    category: 'Threat Analysis',
    difficulty: 'Advanced',
    time: '60-90 mins',
  },
  {
    id: 'surveillance',
    title: 'Surveillance Analysis',
    path: '/frameworks/surveillance',
    icon: <Eye className="h-8 w-8 text-slate-600" />,
    description: 'Systematic surveillance planning and analysis framework.',
    category: 'Intelligence Analysis',
    difficulty: 'Advanced',
    time: '45-75 mins',
  },
  {
    id: 'deception',
    title: 'Deception Detection',
    path: '/frameworks/deception',
    icon: <Search className="h-8 w-8 text-orange-600" />,
    description: 'SAT methodology for detecting deception in statements.',
    category: 'Analysis & Detection',
    difficulty: 'Advanced',
    time: '30-60 mins',
  },
];

const categories = Array.from(new Set(frameworks.map(f => f.category)));

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner': return 'text-green-600 bg-green-50 border-green-200';
    case 'Intermediate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'Advanced': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export default function FrameworksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Analysis Frameworks</h1>
        <p className="text-lg text-gray-600">
          Choose from our comprehensive collection of professional analysis frameworks
          designed for intelligence analysis, strategic planning, and decision-making.
        </p>
      </div>

      {/* Framework Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {frameworks.map((framework) => (
          <Link key={framework.id} to={framework.path}>
            <Card className="h-full p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  {framework.icon}
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {framework.title}
                    </h3>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                {framework.description}
              </p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-700">{framework.category}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium text-gray-700">{framework.time}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(
                    framework.difficulty
                  )}`}
                >
                  {framework.difficulty}
                </span>
                <span className="text-sm text-blue-600 font-medium">
                  Get Started →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Categories Overview */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Framework Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((category) => {
            const count = frameworks.filter(f => f.category === category).length;
            return (
              <Card key={category} className="p-4 text-center">
                <h3 className="font-medium text-gray-900 mb-1">{category}</h3>
                <p className="text-sm text-gray-500">{count} framework{count !== 1 ? 's' : ''}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}