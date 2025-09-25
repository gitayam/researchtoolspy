import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Search,
  Filter,
  Calendar,
  MoreHorizontal,
  Eye,
  Share2,
  Trash2,
  Plus
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Report {
  id: string;
  title: string;
  framework: string;
  status: 'draft' | 'completed' | 'shared';
  created_at: string;
  updated_at: string;
  author: string;
  type: 'analysis' | 'summary' | 'export';
  size?: string;
  tags?: string[];
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');

  useEffect(() => {
    // Mock data - replace with actual API calls
    setTimeout(() => {
      setReports([
        {
          id: '1',
          title: 'Q3 2024 Market Competition Analysis',
          framework: 'SWOT',
          status: 'completed',
          created_at: '2024-09-20T10:30:00Z',
          updated_at: '2024-09-24T10:30:00Z',
          author: 'Research Analyst',
          type: 'analysis',
          size: '2.3 MB',
          tags: ['market', 'competition', 'quarterly'],
        },
        {
          id: '2',
          title: 'Intelligence Assessment - Project Alpha',
          framework: 'ACH',
          status: 'completed',
          created_at: '2024-09-18T14:15:00Z',
          updated_at: '2024-09-23T16:45:00Z',
          author: 'Research Analyst',
          type: 'analysis',
          size: '1.8 MB',
          tags: ['intelligence', 'alpha', 'assessment'],
        },
        {
          id: '3',
          title: 'Regional Security Assessment Draft',
          framework: 'PMESII-PT',
          status: 'draft',
          created_at: '2024-09-22T09:20:00Z',
          updated_at: '2024-09-23T14:20:00Z',
          author: 'Research Analyst',
          type: 'analysis',
          size: '0.9 MB',
          tags: ['security', 'regional', 'assessment'],
        },
        {
          id: '4',
          title: 'Behavioral Pattern Analysis Summary',
          framework: 'Behavior',
          status: 'shared',
          created_at: '2024-09-15T11:30:00Z',
          updated_at: '2024-09-23T11:30:00Z',
          author: 'Research Analyst',
          type: 'summary',
          size: '1.2 MB',
          tags: ['behavior', 'patterns', 'summary'],
        },
        {
          id: '5',
          title: 'DOTMLPF Analysis - Training Program',
          framework: 'DOTMLPF',
          status: 'completed',
          created_at: '2024-09-10T16:45:00Z',
          updated_at: '2024-09-19T12:15:00Z',
          author: 'Research Analyst',
          type: 'analysis',
          size: '3.1 MB',
          tags: ['training', 'program', 'capability'],
        },
        {
          id: '6',
          title: 'PEST Environmental Scan',
          framework: 'PEST',
          status: 'completed',
          created_at: '2024-09-05T13:20:00Z',
          updated_at: '2024-09-18T09:30:00Z',
          author: 'Research Analyst',
          type: 'export',
          size: '0.7 MB',
          tags: ['environment', 'scan', 'external'],
        },
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.framework.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesFilter =
      filterBy === 'all' ||
      report.status === filterBy ||
      report.framework.toLowerCase() === filterBy.toLowerCase();

    return matchesSearch && matchesFilter;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'updated_at':
      default:
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'shared': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'draft': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getFrameworkColor = (framework: string) => {
    switch (framework.toLowerCase()) {
      case 'swot': return 'text-blue-700 bg-blue-100';
      case 'ach': return 'text-purple-700 bg-purple-100';
      case 'pmesii-pt': return 'text-green-700 bg-green-100';
      case 'dotmlpf': return 'text-red-700 bg-red-100';
      case 'behavior': return 'text-indigo-700 bg-indigo-100';
      case 'pest': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <Link
          to="/frameworks"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Report
        </Link>
      </div>

      {/* Filters and Search */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex flex-1 items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Reports</option>
                <option value="completed">Completed</option>
                <option value="draft">Drafts</option>
                <option value="shared">Shared</option>
                <option value="swot">SWOT</option>
                <option value="ach">ACH</option>
                <option value="pmesii-pt">PMESII-PT</option>
                <option value="dotmlpf">DOTMLPF</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="updated_at">Recently Updated</option>
                <option value="created_at">Recently Created</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Reports List */}
      {sortedReports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterBy !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first analysis report.'}
          </p>
          <Link
            to="/frameworks"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Report
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedReports.map((report) => (
            <Card key={report.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {report.title}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                        report.status
                      )}`}
                    >
                      {report.status}
                    </span>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getFrameworkColor(
                        report.framework
                      )}`}
                    >
                      {report.framework}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <span>By {report.author}</span>
                    <span>•</span>
                    <span>Created {formatDate(report.created_at)}</span>
                    <span>•</span>
                    <span>Updated {formatDate(report.updated_at)}</span>
                    {report.size && (
                      <>
                        <span>•</span>
                        <span>{report.size}</span>
                      </>
                    )}
                  </div>

                  {report.tags && report.tags.length > 0 && (
                    <div className="flex items-center space-x-2">
                      {report.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Download className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {sortedReports.length > 0 && (
        <div className="mt-8 text-center text-sm text-gray-500">
          Showing {sortedReports.length} of {reports.length} reports
        </div>
      )}
    </div>
  );
}