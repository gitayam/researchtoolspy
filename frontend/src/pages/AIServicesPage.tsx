import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Paper,
  Grid,
  Chip,
  AppBar,
  Toolbar,
  CircularProgress,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const AIServicesPage: React.FC = () => {
  const [textInput, setTextInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState('');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  const runTextAnalysis = async (type: string) => {
    if (!textInput.trim()) return;
    
    setLoading(true);
    setAnalysisType(type);
    
    // Simulate API call delay
    setTimeout(() => {
      let result = '';
      
      switch (type) {
        case 'sentiment':
          result = `Sentiment Analysis Results:
          
Overall Sentiment: Positive (85% confidence)
Emotional Tone: Professional, Optimistic
Key Phrases: "innovative solution", "significant impact", "positive outcomes"
Sentiment Score: +0.72 (Range: -1 to +1)

Breakdown:
• Positive indicators: 12 phrases
• Negative indicators: 2 phrases  
• Neutral indicators: 8 phrases`;
          break;
          
        case 'summary':
          result = `Text Summary:
          
Key Points:
• The document discusses implementation of new technology solutions
• Focus on improving operational efficiency and user experience
• Timeline spans 6-12 months with phased rollout approach
• Budget considerations include infrastructure and training costs
• Risk mitigation strategies are outlined for potential challenges

Executive Summary:
The proposed initiative aims to modernize current systems through strategic technology adoption, with emphasis on measurable outcomes and stakeholder engagement throughout the implementation process.`;
          break;
          
        case 'keywords':
          result = `Keyword Extraction Results:
          
Primary Keywords (High relevance):
• Technology implementation
• Operational efficiency  
• Strategic planning
• User experience
• Risk management

Secondary Keywords (Medium relevance):
• Cost analysis
• Timeline management
• Stakeholder engagement
• Performance metrics
• Quality assurance

Emerging Themes:
• Digital transformation
• Process optimization
• Change management`;
          break;
          
        default:
          result = 'Analysis completed successfully.';
      }
      
      setAnalysisResult(result);
      setLoading(false);
    }, 2000);
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI Services Platform
          </Typography>
          <Button color="inherit" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          AI-Powered Analysis Tools
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Text Input
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={8}
                label="Enter text to analyze"
                placeholder="Paste your document, email, report, or any text content here for AI analysis..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                margin="normal"
              />
              
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button 
                  variant="contained" 
                  onClick={() => runTextAnalysis('sentiment')}
                  disabled={!textInput.trim() || loading}
                >
                  Sentiment Analysis
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => runTextAnalysis('summary')}
                  disabled={!textInput.trim() || loading}
                >
                  Summarize
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => runTextAnalysis('keywords')}
                  disabled={!textInput.trim() || loading}
                >
                  Extract Keywords
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              <Typography variant="h6" gutterBottom>
                Analysis Results
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4 }}>
                  <CircularProgress size={24} />
                  <Typography>
                    Running {analysisType} analysis...
                  </Typography>
                </Box>
              ) : analysisResult ? (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Analysis completed successfully!
                  </Alert>
                  <Typography 
                    component="pre" 
                    sx={{ 
                      whiteSpace: 'pre-wrap', 
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.6
                    }}
                  >
                    {analysisResult}
                  </Typography>
                </Box>
              ) : (
                <Typography color="textSecondary" sx={{ mt: 4 }}>
                  Enter text and select an analysis type to see results here.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Document Intelligence
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Extract insights from documents, reports, and unstructured text
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="NLP" size="small" />
                  <Chip label="Entity Recognition" size="small" />
                  <Chip label="Classification" size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Predictive Analytics
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Forecast trends and patterns using machine learning models
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Time Series" size="small" />
                  <Chip label="Regression" size="small" />
                  <Chip label="Clustering" size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Language Translation
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Translate text between multiple languages with high accuracy
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="Multi-language" size="small" />
                  <Chip label="Real-time" size="small" />
                  <Chip label="Context-aware" size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default AIServicesPage;