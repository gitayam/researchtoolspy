#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const frameworks = [
  {
    name: 'swot',
    title: 'SWOT Analysis',
    description: 'Analyze Strengths, Weaknesses, Opportunities, and Threats',
    fields: ['strengths', 'weaknesses', 'opportunities', 'threats']
  },
  {
    name: 'pmesii-pt',
    title: 'PMESII-PT',
    description: 'Political, Military, Economic, Social, Information, Infrastructure, Physical, Time analysis',
    fields: ['political', 'military', 'economic', 'social', 'information', 'infrastructure', 'physical', 'time']
  },
  {
    name: 'dotmlpf',
    title: 'DOTMLPF',
    description: 'Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities analysis',
    fields: ['doctrine', 'organization', 'training', 'materiel', 'leadership', 'personnel', 'facilities']
  },
  {
    name: 'pest',
    title: 'PEST Analysis',
    description: 'Political, Economic, Social, Technological analysis',
    fields: ['political', 'economic', 'social', 'technological']
  },
  {
    name: 'vrio',
    title: 'VRIO Framework',
    description: 'Value, Rarity, Imitability, Organization resource analysis',
    fields: ['value', 'rarity', 'imitability', 'organization']
  },
  {
    name: 'trend',
    title: 'Trend Analysis',
    description: 'Identify and analyze trends over time',
    fields: ['trends', 'drivers', 'implications', 'uncertainties']
  },
  {
    name: 'dime',
    title: 'DIME Framework',
    description: 'Diplomatic, Information, Military, Economic power analysis',
    fields: ['diplomatic', 'information', 'military', 'economic']
  },
  {
    name: 'cog',
    title: 'Center of Gravity Analysis',
    description: 'Identify critical capabilities, requirements, and vulnerabilities',
    fields: ['centers_of_gravity', 'critical_capabilities', 'critical_requirements', 'critical_vulnerabilities']
  },
  {
    name: 'stakeholder',
    title: 'Stakeholder Analysis',
    description: 'Map and analyze key stakeholders and their interests',
    fields: ['stakeholders', 'interests', 'influence', 'relationships']
  },
  {
    name: 'starbursting',
    title: 'Starbursting',
    description: 'Generate comprehensive questions about a topic',
    fields: ['who', 'what', 'where', 'when', 'why', 'how']
  },
  {
    name: 'fundamental-flow',
    title: 'Fundamental Flow Analysis',
    description: 'Analyze flows and relationships in systems',
    fields: ['inputs', 'processes', 'outputs', 'feedback']
  },
  {
    name: 'behavior',
    title: 'Behavior Analysis',
    description: 'Analyze patterns and drivers of behavior',
    fields: ['behaviors', 'motivations', 'constraints', 'patterns']
  },
  {
    name: 'causeway',
    title: 'Causeway Analysis',
    description: 'Map cause and effect relationships',
    fields: ['causes', 'effects', 'relationships', 'interventions']
  },
  {
    name: 'surveillance',
    title: 'Surveillance Framework',
    description: 'Monitor and track key indicators',
    fields: ['indicators', 'thresholds', 'trends', 'alerts']
  }
];

function generateListPage(framework) {
  const componentName = framework.name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');

  return `import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, BarChart3, Edit, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface ${componentName}Session {
  id: string;
  title: string;
  description?: string;
  framework_type: '${framework.name}';
  status: 'draft' | 'in_progress' | 'completed';
  data: any;
  created_at: string;
  updated_at: string;
}

export default function ${componentName}ListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<${componentName}Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await apiClient.get<${componentName}Session[]>('/analysis-frameworks?type=${framework.name}');
        setSessions(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load ${framework.title} sessions',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [toast]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return;

    try {
      await apiClient.delete(\`/analysis-frameworks/\${id}\`);
      setSessions(sessions.filter(s => s.id !== id));
      toast({
        title: 'Success',
        description: 'Analysis deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete analysis',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading ${framework.title} analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">${framework.title}</h1>
        <p className="text-gray-600 dark:text-gray-400">
          ${framework.description}
        </p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search analyses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => navigate('/frameworks/${framework.name}/create')}>
          <Plus className="h-4 w-4 mr-2" />
          New ${framework.title}
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No ${framework.title} analyses yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first ${framework.title} analysis
            </p>
            <Button onClick={() => navigate('/frameworks/${framework.name}/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create ${framework.title}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{session.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {session.description || 'No description'}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusBadgeColor(session.status)}>
                    {session.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatRelativeTime(session.updated_at)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(\`/frameworks/${framework.name}/\${session.id}\`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(\`/frameworks/${framework.name}/create?edit=\${session.id}\`)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}`;
}

// Generate files for each framework
frameworks.forEach(framework => {
  const dirName = framework.name.toLowerCase();
  const dirPath = path.join(__dirname, '..', 'src', 'pages', 'frameworks', dirName);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Generate ListPage
  const listPageContent = generateListPage(framework);
  const componentName = framework.name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
  const listPagePath = path.join(dirPath, `${componentName}ListPage.tsx`);

  // Only write if file doesn't exist or is a placeholder
  if (!fs.existsSync(listPagePath) || fs.readFileSync(listPagePath, 'utf8').includes('coming soon')) {
    fs.writeFileSync(listPagePath, listPageContent);
    console.log(`✓ Generated ${listPagePath}`);
  }
});

console.log('\n✨ Framework generation complete!');