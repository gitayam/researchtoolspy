import { Link } from 'react-router-dom';
import { Brain, Target, Search, FileText, Users, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              Intelligence Analysis Platform
            </h1>
            <p className="text-xl mb-8">
              Professional tools for structured analysis, research, and decision-making
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                to="/frameworks"
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
              >
                Explore Frameworks
              </Link>
              <button className="border border-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600">
                Start Anonymous Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-12">Analysis Frameworks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {frameworks.map((framework) => (
            <Link
              key={framework.id}
              to={framework.path}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center mb-4">
                {framework.icon}
                <h3 className="text-xl font-semibold ml-3">{framework.title}</h3>
              </div>
              <p className="text-gray-600">{framework.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Research Tools Section */}
      <div className="bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Research Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tools.map((tool) => (
              <div key={tool.id} className="bg-white rounded-lg p-6 text-center">
                <div className="text-blue-600 mb-3">{tool.icon}</div>
                <h3 className="font-semibold mb-2">{tool.title}</h3>
                <p className="text-sm text-gray-600">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const frameworks = [
  {
    id: 'swot',
    title: 'SWOT Analysis',
    path: '/frameworks/swot',
    icon: <Target className="h-8 w-8 text-blue-600" />,
    description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats systematically.',
  },
  {
    id: 'ach',
    title: 'ACH Analysis',
    path: '/frameworks/ach',
    icon: <Brain className="h-8 w-8 text-purple-600" />,
    description: 'Analysis of Competing Hypotheses for complex intelligence problems.',
  },
  {
    id: 'pmesii',
    title: 'PMESII-PT',
    path: '/frameworks/pmesii',
    icon: <Users className="h-8 w-8 text-green-600" />,
    description: 'Political, Military, Economic, Social, Information, Infrastructure analysis.',
  },
  {
    id: 'dotmlpf',
    title: 'DOTMLPF-P',
    path: '/frameworks/dotmlpf',
    icon: <Shield className="h-8 w-8 text-red-600" />,
    description: 'Doctrine, Organization, Training, Materiel, Leadership assessment.',
  },
  {
    id: 'behavioral',
    title: 'Behavioral Analysis',
    path: '/frameworks/behavioral',
    icon: <Users className="h-8 w-8 text-indigo-600" />,
    description: 'COM-B model for behavior change and influence analysis.',
  },
  {
    id: 'deception',
    title: 'Deception Detection',
    path: '/frameworks/deception',
    icon: <Search className="h-8 w-8 text-orange-600" />,
    description: 'SAT methodology for detecting deception in statements.',
  },
];

const tools = [
  {
    id: 'scraping',
    title: 'Web Scraping',
    icon: <Search className="h-10 w-10 mx-auto" />,
    description: 'Extract data from websites',
  },
  {
    id: 'social',
    title: 'Social Media',
    icon: <Users className="h-10 w-10 mx-auto" />,
    description: 'Analyze social media data',
  },
  {
    id: 'documents',
    title: 'Documents',
    icon: <FileText className="h-10 w-10 mx-auto" />,
    description: 'Process and analyze documents',
  },
  {
    id: 'citations',
    title: 'Citations',
    icon: <FileText className="h-10 w-10 mx-auto" />,
    description: 'Generate proper citations',
  },
];