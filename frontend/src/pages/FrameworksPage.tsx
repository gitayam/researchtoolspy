import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  AppBar,
  Toolbar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`framework-tabpanel-${index}`}
      aria-labelledby={`framework-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const FrameworksPage: React.FC = () => {
  const [value, setValue] = useState(0);
  const [swotInput, setSwotInput] = useState('Analyze the competitive position of a new electric vehicle startup entering the market.');
  const [achInput, setAchInput] = useState('Intelligence suggests that a foreign government may be planning cyber attacks on critical infrastructure.');
  const [cogInput, setCogInput] = useState('Military operation planning for humanitarian aid distribution in disaster-affected regions.');
  const navigate = useNavigate();

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  const runSwotAnalysis = () => {
    // Mock SWOT analysis results
    alert('SWOT Analysis Complete!\n\nStrengths:\n• Innovative technology\n• Strong funding\n• Experienced team\n\nWeaknesses:\n• Limited brand recognition\n• High production costs\n• Regulatory challenges\n\nOpportunities:\n• Growing EV market\n• Government incentives\n• Environmental awareness\n\nThreats:\n• Established competitors\n• Supply chain issues\n• Economic uncertainty');
  };

  const runAchAnalysis = () => {
    // Mock ACH analysis results
    alert('Analysis of Competing Hypotheses Complete!\n\nHypothesis 1: State-sponsored cyber attacks (75% likelihood)\n• Evidence: Previous attack patterns\n• Evidence: Geopolitical tensions\n\nHypothesis 2: Criminal hackers (20% likelihood)\n• Evidence: Financial motivation\n• Counter-evidence: High sophistication\n\nHypothesis 3: False intelligence (5% likelihood)\n• Counter-evidence: Multiple sources\n• Counter-evidence: Technical indicators');
  };

  const runCogAnalysis = () => {
    // Mock COG analysis results
    alert('Center of Gravity Analysis Complete!\n\nFriendly COG:\n• Logistics capabilities\n• International cooperation\n• Public support\n\nAdversary COG:\n• Infrastructure damage\n• Communication networks\n• Local population needs\n\nCritical Vulnerabilities:\n• Supply chain bottlenecks\n• Weather dependencies\n• Security concerns');
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Framework Analysis Tools
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
          Analysis Frameworks
        </Typography>
        
        <Paper sx={{ width: '100%', mb: 2 }}>
          <Tabs value={value} onChange={handleChange} aria-label="framework tabs">
            <Tab label="SWOT Analysis" />
            <Tab label="ACH Analysis" />
            <Tab label="COG Analysis" />
          </Tabs>
          
          <TabPanel value={value} index={0}>
            <Typography variant="h6" gutterBottom>
              SWOT Analysis
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Analyze Strengths, Weaknesses, Opportunities, and Threats
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Situation to analyze"
              value={swotInput}
              onChange={(e) => setSwotInput(e.target.value)}
              margin="normal"
            />
            
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={runSwotAnalysis}
                disabled={!swotInput.trim()}
              >
                Run SWOT Analysis
              </Button>
            </Box>
          </TabPanel>
          
          <TabPanel value={value} index={1}>
            <Typography variant="h6" gutterBottom>
              Analysis of Competing Hypotheses (ACH)
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Evaluate multiple hypotheses against available evidence
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Intelligence scenario"
              value={achInput}
              onChange={(e) => setAchInput(e.target.value)}
              margin="normal"
            />
            
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={runAchAnalysis}
                disabled={!achInput.trim()}
              >
                Run ACH Analysis
              </Button>
            </Box>
          </TabPanel>
          
          <TabPanel value={value} index={2}>
            <Typography variant="h6" gutterBottom>
              Center of Gravity (COG) Analysis
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Identify critical capabilities and vulnerabilities
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Operational scenario"
              value={cogInput}
              onChange={(e) => setCogInput(e.target.value)}
              margin="normal"
            />
            
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={runCogAnalysis}
                disabled={!cogInput.trim()}
              >
                Run COG Analysis
              </Button>
            </Box>
          </TabPanel>
        </Paper>
        
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Analyses
            </Typography>
            <List>
              <ListItem>
                <ListItemText 
                  primary="Market Entry Strategy Analysis" 
                  secondary="SWOT • 2 hours ago" 
                />
                <Chip label="Completed" color="success" size="small" />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Threat Assessment Report" 
                  secondary="ACH • 1 day ago" 
                />
                <Chip label="Completed" color="success" size="small" />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Operational Planning Study" 
                  secondary="COG • 3 days ago" 
                />
                <Chip label="Completed" color="success" size="small" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

export default FrameworksPage;