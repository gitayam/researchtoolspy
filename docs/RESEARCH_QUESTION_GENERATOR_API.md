# Research Question Generator API Documentation

## Overview

The Research Question Generator uses AI (GPT-4o) to help researchers formulate high-quality, measurable research questions. It applies academic criteria (SMART and FINER) to generate questions that are specific, feasible, and rigorous.

## Endpoint

**POST** `/api/research/generate-question`

### Authentication

Requires a valid Bearer token (JWT or Hash).

```http
Authorization: Bearer <your_token>
```

### Request Body

```json
{
  "topic": "The impact of remote work on employee productivity",
  "purpose": ["descriptive", "correlational"],
  "projectType": "Academic thesis",
  
  "who": {
    "population": "Tech workers in the US",
    "subgroups": "Comparing junior vs senior developers"
  },
  "what": {
    "variables": "Productivity metrics, job satisfaction",
    "expectedOutcome": "Positive correlation with flexibility"
  },
  "where": {
    "location": "United States",
    "specificSettings": "Startups and large enterprises"
  },
  "when": {
    "timePeriod": "2020-2024",
    "studyType": "longitudinal"
  },
  "why": {
    "importance": "To inform future HR policies",
    "beneficiaries": "HR departments, remote workers"
  },

  "duration": "6 months",
  "resources": ["Access to survey data", "Statistical software"],
  "experienceLevel": "Graduate student",
  "constraints": "Limited budget for incentives",
  "ethicalConsiderations": "Anonymity of respondents",
  
  "saveToDatabase": true
}
```

### Response

The API returns 3 distinct questions ranging from broad to narrow scope.

```json
{
  "success": true,
  "id": "rq-1234-5678", // ID if saved to DB
  "questions": [
    {
      "question": "How does the frequency of remote work days correlate with self-reported productivity among junior versus senior software developers in US tech startups?",
      "overallScore": 92,
      "smartAssessment": {
        "specific": { "passed": true, "explanation": "Clearly defines population and variables..." },
        "measurable": { "passed": true, "explanation": "Uses self-reported metrics..." },
        "achievable": { "passed": true, "explanation": "..." },
        "relevant": { "passed": true, "explanation": "..." },
        "timeBound": { "passed": true, "explanation": "..." }
      },
      "finerAssessment": {
        "feasible": { "passed": true, "explanation": "..." },
        "interesting": { "passed": true, "explanation": "..." },
        "novel": { "passed": true, "explanation": "..." },
        "ethical": { "passed": true, "explanation": "..." },
        "relevant": { "passed": true, "explanation": "..." }
      },
      "nullHypothesis": "H₀: There is no significant difference in productivity correlation between junior and senior developers.",
      "alternativeHypothesis": "H₁: Senior developers show a stronger positive correlation between remote work and productivity.",
      "keyVariables": ["Remote work frequency", "Self-reported productivity", "Job role level"],
      "dataCollectionMethods": ["Online survey", "Likert scale questionnaires"],
      "potentialChallenges": ["Response bias", "Defining 'productivity' consistently"]
    },
    // ... Question 2 and Question 3
  ]
}
```

## Error Handling

Standard error format:

```json
{
  "error": "Failed to generate research questions",
  "details": "Missing required fields: topic"
}
```

## Frontend Integration

Example using `fetch`:

```javascript
const generateQuestions = async (data) => {
  const response = await fetch('/api/research/generate-question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error('Generation failed');
  return await response.json();
};
```
