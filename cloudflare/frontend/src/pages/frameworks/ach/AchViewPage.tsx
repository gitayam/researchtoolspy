import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Download, Share2, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

interface ACHSession {
  id: string;
  title: string;
  description?: string;
  framework_type: 'ach';
  status: 'draft' | 'in_progress' | 'completed';
  data: {
    hypotheses: Array<{ id: string; text: string }>;
    evidence: Array<{
      id: string;
      text: string;
      hypotheses_scores: { [hypothesisId: string]: string };
    }>;
    scaleType?: string;
  };
  created_at: string;
  updated_at: string;
}

export default function AchViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<ACHSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await apiClient.get<ACHSession>(`/analysis-frameworks/${id}`);
        setSession(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load ACH analysis',
          variant: 'destructive'
        });
        navigate('/frameworks/ach');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSession();
    }
  }, [id, navigate, toast]);

  const handleEdit = () => {
    navigate(`/frameworks/ach/create?edit=${id}`);
  };

  const handleExport = async () => {
    toast({
      title: 'Export',
      description: 'Export functionality coming soon'
    });
  };

  const handleShare = () => {
    toast({
      title: 'Share',
      description: 'Share functionality coming soon'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading ACH analysis...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getScoreIcon = (score: string) => {
    switch (score) {
      case 'supports':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'contradicts':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'neutral':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'not_applicable':
        return <X className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'supports':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'contradicts':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'neutral':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'not_applicable':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const calculateHypothesisScore = (hypothesisId: string) => {
    const scores = session.data.evidence
      .map(e => e.hypotheses_scores[hypothesisId])
      .filter(Boolean);

    if (scores.length === 0) return { supports: 0, contradicts: 0, neutral: 0, not_applicable: 0 };

    return {
      supports: scores.filter(s => s === 'supports').length,
      contradicts: scores.filter(s => s === 'contradicts').length,
      neutral: scores.filter(s => s === 'neutral').length,
      not_applicable: scores.filter(s => s === 'not_applicable').length
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{session.title}</h1>
            {session.description && (
              <p className="text-gray-600 dark:text-gray-400">{session.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4">
              <Badge className={
                session.status === 'completed' ? 'bg-green-100 text-green-800' :
                session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }>
                {session.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-gray-500">
                Updated {formatRelativeTime(session.updated_at)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Hypothesis Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Hypothesis Summary</CardTitle>
            <CardDescription>Overview of evidence support for each hypothesis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {session.data.hypotheses.map((hypothesis) => {
                const score = calculateHypothesisScore(hypothesis.id);
                const total = score.supports + score.contradicts + score.neutral + score.not_applicable;
                const netScore = score.supports - score.contradicts;

                return (
                  <div key={hypothesis.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{hypothesis.text}</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {score.supports} supports
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        {score.contradicts} contradicts
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        {score.neutral} neutral
                      </span>
                      <span className="flex items-center gap-1">
                        <X className="h-4 w-4 text-gray-400" />
                        {score.not_applicable} N/A
                      </span>
                      <span className="ml-auto font-semibold">
                        Net Score: <span className={netScore > 0 ? 'text-green-600' : netScore < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {netScore > 0 ? '+' : ''}{netScore}
                        </span>
                      </span>
                    </div>
                    {total > 0 && (
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div
                          className="bg-green-500"
                          style={{ width: `${(score.supports / total) * 100}%` }}
                        />
                        <div
                          className="bg-red-500"
                          style={{ width: `${(score.contradicts / total) * 100}%` }}
                        />
                        <div
                          className="bg-yellow-500"
                          style={{ width: `${(score.neutral / total) * 100}%` }}
                        />
                        <div
                          className="bg-gray-400"
                          style={{ width: `${(score.not_applicable / total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Evidence Matrix */}
        <Card>
          <CardHeader>
            <CardTitle>Evidence Matrix</CardTitle>
            <CardDescription>How each piece of evidence relates to each hypothesis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b">Evidence</th>
                    {session.data.hypotheses.map((hypothesis) => (
                      <th key={hypothesis.id} className="text-left p-2 border-b min-w-[100px]">
                        {hypothesis.text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {session.data.evidence.map((evidence) => (
                    <tr key={evidence.id}>
                      <td className="p-2 border-b">{evidence.text}</td>
                      {session.data.hypotheses.map((hypothesis) => {
                        const score = evidence.hypotheses_scores[hypothesis.id];
                        return (
                          <td key={hypothesis.id} className="p-2 border-b">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${getScoreColor(score)}`}>
                              {getScoreIcon(score)}
                              <span className="text-xs capitalize">{score?.replace('_', ' ')}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}