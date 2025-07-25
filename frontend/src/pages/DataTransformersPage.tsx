import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Paper,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  AppBar,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const DataTransformersPage: React.FC = () => {
  const [inputFormat, setInputFormat] = useState('csv');
  const [outputFormat, setOutputFormat] = useState('json');
  const [inputData, setInputData] = useState('name,age,city\nJohn,25,New York\nJane,30,London\nBob,35,Paris');
  const [outputData, setOutputData] = useState('');
  const [showResult, setShowResult] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    navigate('/login');
  };

  const transformData = () => {
    let result = '';
    
    if (inputFormat === 'csv' && outputFormat === 'json') {
      // Mock CSV to JSON conversion
      const lines = inputData.trim().split('\n');
      const headers = lines[0].split(',');
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || '';
        });
        return obj;
      });
      result = JSON.stringify(data, null, 2);
    } else if (inputFormat === 'json' && outputFormat === 'csv') {
      // Mock JSON to CSV conversion
      try {
        const data = JSON.parse(inputData);
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]);
          const csvLines = [headers.join(',')];
          data.forEach(item => {
            const values = headers.map(header => item[header] || '');
            csvLines.push(values.join(','));
          });
          result = csvLines.join('\n');
        }
      } catch (e) {
        result = 'Error: Invalid JSON format';
      }
    } else if (inputFormat === 'csv' && outputFormat === 'xml') {
      // Mock CSV to XML conversion
      const lines = inputData.trim().split('\n');
      const headers = lines[0].split(',');
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
      lines.slice(1).forEach((line, index) => {
        const values = line.split(',');
        xml += `  <record id="${index + 1}">\n`;
        headers.forEach((header, headerIndex) => {
          xml += `    <${header.trim()}>${values[headerIndex]?.trim() || ''}</${header.trim()}>\n`;
        });
        xml += '  </record>\n';
      });
      xml += '</data>';
      result = xml;
    } else {
      result = 'Transformation completed. Original data processed.';
    }
    
    setOutputData(result);
    setShowResult(true);
  };

  const sampleData = {
    csv: 'name,age,city,department\nAlice,28,Boston,Engineering\nCharlie,32,Seattle,Marketing\nDiana,27,Austin,Design',
    json: `[
  {"name": "Alice", "age": 28, "city": "Boston", "department": "Engineering"},
  {"name": "Charlie", "age": 32, "city": "Seattle", "department": "Marketing"},
  {"name": "Diana", "age": 27, "city": "Austin", "department": "Design"}
]`,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<employees>
  <employee id="1">
    <name>Alice</name>
    <age>28</age>
    <city>Boston</city>
  </employee>
</employees>`
  };

  const loadSampleData = () => {
    setInputData(sampleData[inputFormat as keyof typeof sampleData] || '');
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Data Transformation Tools
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
          Data Format Converters
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Input Data
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>From Format</InputLabel>
                  <Select
                    value={inputFormat}
                    label="From Format"
                    onChange={(e) => setInputFormat(e.target.value)}
                  >
                    <MenuItem value="csv">CSV</MenuItem>
                    <MenuItem value="json">JSON</MenuItem>
                    <MenuItem value="xml">XML</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>To Format</InputLabel>
                  <Select
                    value={outputFormat}
                    label="To Format"
                    onChange={(e) => setOutputFormat(e.target.value)}
                  >
                    <MenuItem value="csv">CSV</MenuItem>
                    <MenuItem value="json">JSON</MenuItem>
                    <MenuItem value="xml">XML</MenuItem>
                  </Select>
                </FormControl>
                
                <Button variant="outlined" onClick={loadSampleData}>
                  Load Sample
                </Button>
              </Box>
              
              <TextField
                fullWidth
                multiline
                rows={12}
                label={`Enter ${inputFormat.toUpperCase()} data`}
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                margin="normal"
                sx={{ fontFamily: 'monospace' }}
              />
              
              <Box sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={transformData}
                  disabled={!inputData.trim()}
                  fullWidth
                >
                  Transform Data ({inputFormat.toUpperCase()} → {outputFormat.toUpperCase()})
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Output Data
              </Typography>
              
              {showResult && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Data transformation completed successfully!
                </Alert>
              )}
              
              <TextField
                fullWidth
                multiline
                rows={12}
                label={`Converted ${outputFormat.toUpperCase()} data`}
                value={outputData}
                margin="normal"
                InputProps={{
                  readOnly: true,
                }}
                sx={{ fontFamily: 'monospace' }}
              />
              
              {outputData && (
                <Box sx={{ mt: 2 }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => navigator.clipboard.writeText(outputData)}
                    fullWidth
                  >
                    Copy to Clipboard
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Supported Transformations
                </Typography>
                
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>From</strong></TableCell>
                        <TableCell><strong>To</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell><strong>Use Cases</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>CSV</TableCell>
                        <TableCell>JSON</TableCell>
                        <TableCell>Convert tabular data to JSON objects</TableCell>
                        <TableCell>API integration, web applications</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>JSON</TableCell>
                        <TableCell>CSV</TableCell>
                        <TableCell>Convert JSON arrays to CSV format</TableCell>
                        <TableCell>Excel export, data analysis</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>CSV</TableCell>
                        <TableCell>XML</TableCell>
                        <TableCell>Convert CSV to structured XML</TableCell>
                        <TableCell>Legacy system integration</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>XML</TableCell>
                        <TableCell>JSON</TableCell>
                        <TableCell>Convert XML to JSON format</TableCell>
                        <TableCell>Modern API development</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default DataTransformersPage;