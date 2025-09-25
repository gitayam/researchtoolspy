import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';

interface Hypothesis {
  id: string;
  text: string;
}

interface Evidence {
  id: string;
  text: string;
  hypotheses_scores: Record<string, string>;
}

export default function AchCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  const addHypothesis = () => {
    const newHypothesis: Hypothesis = {
      id: Date.now().toString(),
      text: ''
    };
    setHypotheses([...hypotheses, newHypothesis]);
  };

  const updateHypothesis = (id: string, text: string) => {
    setHypotheses(hypotheses.map(h => h.id === id ? { ...h, text } : h));
  };

  const removeHypothesis = (id: string) => {
    setHypotheses(hypotheses.filter(h => h.id !== id));
    // Remove scores for this hypothesis from all evidence
    setEvidence(evidence.map(e => {
      const newScores = { ...e.hypotheses_scores };
      delete newScores[id];
      return { ...e, hypotheses_scores: newScores };
    }));
  };

  const addEvidence = () => {
    const newEvidence: Evidence = {
      id: Date.now().toString(),
      text: '',
      hypotheses_scores: {}
    };
    // Initialize scores for all hypotheses
    hypotheses.forEach(h => {
      newEvidence.hypotheses_scores[h.id] = 'neutral';
    });
    setEvidence([...evidence, newEvidence]);
  };

  const updateEvidence = (id: string, text: string) => {
    setEvidence(evidence.map(e => e.id === id ? { ...e, text } : e));
  };

  const updateScore = (evidenceId: string, hypothesisId: string, score: string) => {
    setEvidence(evidence.map(e =>
      e.id === evidenceId
        ? { ...e, hypotheses_scores: { ...e.hypotheses_scores, [hypothesisId]: score } }
        : e
    ));
  };

  const removeEvidence = (id: string) => {
    setEvidence(evidence.filter(e => e.id !== id));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a title for your ACH analysis',
        variant: 'destructive'
      });
      return;
    }

    if (hypotheses.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least 2 hypotheses',
        variant: 'destructive'
      });
      return;
    }

    if (evidence.length < 1) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least 1 piece of evidence',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        framework_type: 'ach',
        status: 'draft',
        data: {
          hypotheses: hypotheses.filter(h => h.text.trim()),
          evidence: evidence.filter(e => e.text.trim()),
          scaleType: 'logarithmic'
        }
      };

      const response = await apiClient.post<{ id: string }>('/analysis-frameworks', payload);

      toast({
        title: 'Success',
        description: 'ACH analysis saved successfully'
      });

      navigate(`/frameworks/ach/${response.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save ACH analysis',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create ACH Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Systematically evaluate competing hypotheses against evidence
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                placeholder="Enter analysis title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                placeholder="Describe your analysis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hypotheses</CardTitle>
            <CardDescription>Add competing hypotheses to evaluate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hypotheses.map((hypothesis) => (
              <div key={hypothesis.id} className="flex gap-2">
                <Input
                  placeholder="Enter hypothesis..."
                  value={hypothesis.text}
                  onChange={(e) => updateHypothesis(hypothesis.id, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeHypothesis(hypothesis.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addHypothesis} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Hypothesis
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>Add evidence and score against each hypothesis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evidence.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter evidence..."
                    value={item.text}
                    onChange={(e) => updateEvidence(item.id, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeEvidence(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {hypotheses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Score against hypotheses:</p>
                    {hypotheses.map((hypothesis) => (
                      <div key={hypothesis.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1">{hypothesis.text || 'Unnamed hypothesis'}</span>
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={item.hypotheses_scores[hypothesis.id] || 'neutral'}
                          onChange={(e) => updateScore(item.id, hypothesis.id, e.target.value)}
                        >
                          <option value="supports">Supports</option>
                          <option value="contradicts">Contradicts</option>
                          <option value="neutral">Neutral</option>
                          <option value="not_applicable">N/A</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button onClick={addEvidence} variant="outline" disabled={hypotheses.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add Evidence
            </Button>
            {hypotheses.length === 0 && (
              <p className="text-sm text-muted-foreground">Add hypotheses first before adding evidence</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/frameworks/ach')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Analysis'}
          </Button>
        </div>
      </div>
    </div>
  );
}