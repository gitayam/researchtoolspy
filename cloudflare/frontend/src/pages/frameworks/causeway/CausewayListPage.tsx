import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Calendar, BarChart3, Edit, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface CausewaySession {
  id: string;
  title: string;
  description?: string;
  framework_type: 'causeway';
  status: 'draft' | 'in_progress' | 'completed';
  data: any;
  created_at: string;
  updated_at: string;
}

export default function CausewayListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<CausewaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await apiClient.get<CausewaySession[]>('/analysis-frameworks?type=causeway');
        setSessions(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load Causeway Analysis sessions',
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
      await apiClient.delete(`/analysis-frameworks/${id}`);
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
          <p className="text-gray-500">Loading Causeway Analysis analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Causeway Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Map cause and effect relationships
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
        <Button onClick={() => navigate('/frameworks/causeway/create')}>
          <Plus className="h-4 w-4 mr-2" />
          New Causeway Analysis
        </Button>
      </div>

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No Causeway Analysis analyses yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first Causeway Analysis analysis
            </p>
            <Button onClick={() => navigate('/frameworks/causeway/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Causeway Analysis
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
                    onClick={() => navigate(`/frameworks/causeway/${session.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/frameworks/causeway/create?edit=${session.id}`)}
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
}