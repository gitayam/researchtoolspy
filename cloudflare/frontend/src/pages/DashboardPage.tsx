import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Target,
  Brain,
  TrendingUp,
  Users,
  Shield,
  Search,
  Clock,
  Plus
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface DashboardStats {
  totalAnalyses: number;
  completedThisWeek: number;
  activeProjects: number;
  reportsGenerated: number;
}

interface RecentActivity {
  id: string;
  type: 'analysis' | 'report' | 'framework';
  title: string;
  timestamp: string;
  framework?: string;
  status: 'completed' | 'in_progress' | 'draft';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnalyses: 0,
    completedThisWeek: 0,
    activeProjects: 0,
    reportsGenerated: 0,
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual API calls
    setTimeout(() => {
      setStats({
        totalAnalyses: 24,
        completedThisWeek: 7,
        activeProjects: 3,
        reportsGenerated: 12,
      });

      setRecentActivities([
        {
          id: '1',
          type: 'analysis',
          title: 'Market Competition Analysis',
          timestamp: '2024-09-24T10:30:00Z',
          framework: 'SWOT',
          status: 'completed',
        },
        {
          id: '2',
          type: 'framework',
          title: 'Intelligence Assessment',
          timestamp: '2024-09-24T09:15:00Z',
          framework: 'ACH',
          status: 'in_progress',
        },
        {
          id: '3',
          type: 'report',
          title: 'Q3 Strategic Review',
          timestamp: '2024-09-23T16:45:00Z',
          status: 'draft',
        },
        {
          id: '4',
          type: 'analysis',
          title: 'Regional Security Assessment',
          timestamp: '2024-09-23T14:20:00Z',
          framework: 'PMESII-PT',
          status: 'completed',
        },
        {
          id: '5',
          type: 'analysis',
          title: 'Behavioral Pattern Analysis',
          timestamp: '2024-09-23T11:30:00Z',
          framework: 'Behavior',
          status: 'completed',
        },
      ]);

      setIsLoading(false);
    }, 1000);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getActivityIcon = (type: string, framework?: string) => {
    if (type === 'report') return <FileText className="h-4 w-4" />;

    switch (framework) {
      case 'SWOT': return <Target className="h-4 w-4 text-blue-600" />;
      case 'ACH': return <Brain className="h-4 w-4 text-purple-600" />;
      case 'PMESII-PT': return <Users className="h-4 w-4 text-green-600" />;
      case 'DOTMLPF': return <Shield className="h-4 w-4 text-red-600" />;
      case 'Behavior': return <Users className="h-4 w-4 text-indigo-600" />;
      case 'Deception': return <Search className="h-4 w-4 text-orange-600" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'draft': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/frameworks"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Analysis
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Analyses</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAnalyses}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedThisWeek}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reports</p>
              <p className="text-2xl font-bold text-gray-900">{stats.reportsGenerated}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              <Link
                to="/reports"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity.type, activity.framework)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.title}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {activity.framework && (
                        <span className="text-xs text-gray-500">
                          {activity.framework}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        activity.status
                      )}`}
                    >
                      {activity.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/frameworks/swot/create"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Target className="h-5 w-5 text-blue-600 mr-3" />
                New SWOT Analysis
              </Link>
              <Link
                to="/frameworks/ach/create"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Brain className="h-5 w-5 text-purple-600 mr-3" />
                New ACH Analysis
              </Link>
              <Link
                to="/frameworks/pmesii-pt/create"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Users className="h-5 w-5 text-green-600 mr-3" />
                New PMESII-PT
              </Link>
              <Link
                to="/reports"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-gray-600 mr-3" />
                View Reports
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Frameworks</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">SWOT Analysis</span>
                <span className="text-sm font-medium text-gray-900">8 uses</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ACH Analysis</span>
                <span className="text-sm font-medium text-gray-900">6 uses</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">PMESII-PT</span>
                <span className="text-sm font-medium text-gray-900">4 uses</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">DOTMLPF-P</span>
                <span className="text-sm font-medium text-gray-900">3 uses</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}