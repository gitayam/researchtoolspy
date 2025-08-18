# API Documentation

ResearchTools API reference for developers and system integrators.

## 📖 Overview

The ResearchTools API provides endpoints for validating bookmark codes, health checking, and optional backend integration. The API is designed to work with the bookmark authentication system while maintaining privacy.

### Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:6780/api
```

### Authentication
All API endpoints use bookmark-based authentication. Include the bookmark hash in request headers or body as specified.

---

## 🔐 Authentication

### Bookmark Hash Validation

#### POST `/api/auth/validate`

Validates a bookmark hash and establishes session.

**Request:**
```json
{
  "bookmarkHash": "1234567890123456"
}
```

**Headers:**
```http
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Response (Success):**
```json
{
  "success": true,
  "session": {
    "id": "sess_abc123",
    "expires": "2024-12-31T23:59:59Z"
  }
}
```

**Response (Invalid):**
```json
{
  "success": false,
  "error": "INVALID_BOOKMARK",
  "message": "Invalid bookmark hash format or not found"
}
```

**Rate Limiting:**
- 5 attempts per IP per 15 minutes
- Returns 429 when exceeded

**Example:**
```javascript
const response = await fetch('/api/auth/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bookmarkHash: '1234567890123456'
  })
})

const result = await response.json()
if (result.success) {
  console.log('Authentication successful')
}
```

---

## 🏥 Health & Status

### GET `/api/health`

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "frontend": "healthy",
    "storage": "healthy",
    "rate_limiter": "healthy"
  },
  "metrics": {
    "uptime": 86400,
    "memory_usage": "245MB",
    "active_sessions": 42
  }
}
```

**Status Codes:**
- `200`: All systems healthy
- `503`: Service degraded or unhealthy

### GET `/api/metrics`

Prometheus-compatible metrics endpoint.

**Response:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234

# HELP bookmark_validations_total Total bookmark validation attempts
# TYPE bookmark_validations_total counter
bookmark_validations_total{result="success"} 856
bookmark_validations_total{result="failure"} 12

# HELP active_sessions Current active sessions
# TYPE active_sessions gauge
active_sessions 42
```

---

## 💾 Data Management

### Framework Data Storage

All framework data is stored client-side in localStorage. The API provides utilities for data validation and export.

### POST `/api/data/validate`

Validates framework data structure.

**Request:**
```json
{
  "framework": "swot",
  "data": {
    "strengths": ["Strong brand", "Experienced team"],
    "weaknesses": ["Limited budget", "Technical debt"],
    "opportunities": ["Market expansion", "New technology"],
    "threats": ["Competition", "Economic downturn"]
  }
}
```

**Response:**
```json
{
  "valid": true,
  "framework": "swot",
  "structure_version": "1.0",
  "completeness": 0.85,
  "suggestions": [
    "Consider adding more specific strengths",
    "Quantify threats where possible"
  ]
}
```

### POST `/api/export/generate`

Generates export in requested format.

**Request:**
```json
{
  "bookmarkHash": "1234567890123456",
  "framework": "swot",
  "format": "pdf",
  "data": { /* framework data */ },
  "options": {
    "includeCharts": true,
    "includeMetadata": true,
    "template": "professional"
  }
}
```

**Response:**
```json
{
  "success": true,
  "export_id": "exp_xyz789",
  "download_url": "/api/export/download/exp_xyz789",
  "format": "pdf",
  "size_bytes": 245760,
  "expires": "2024-12-15T23:59:59Z"
}
```

**Supported Formats:**
- `pdf`: Professional PDF report
- `docx`: Microsoft Word document
- `pptx`: PowerPoint presentation
- `json`: Raw data export
- `csv`: Tabular data (where applicable)

### GET `/api/export/download/{export_id}`

Downloads generated export file.

**Response:**
- File download with appropriate content-type
- Expires after 24 hours
- Single-use download link

---

## 🔄 Session Management

### GET `/api/session/info`

Returns current session information.

**Headers:**
```http
Authorization: Bookmark 1234567890123456
```

**Response:**
```json
{
  "session": {
    "id": "sess_abc123",
    "bookmark_hash": "123456...3456", // Partial for security
    "created": "2024-12-15T10:00:00Z",
    "last_active": "2024-12-15T10:29:45Z",
    "expires": "2024-12-15T14:00:00Z"
  },
  "storage": {
    "used_mb": 2.4,
    "limit_mb": 10,
    "frameworks": ["swot", "ach", "pmesii-pt"]
  }
}
```

### POST `/api/session/extend`

Extends current session (if enabled).

**Request:**
```json
{
  "duration_hours": 4
}
```

**Response:**
```json
{
  "success": true,
  "new_expires": "2024-12-15T18:00:00Z"
}
```

### DELETE `/api/session/clear`

Clears current session.

**Response:**
```json
{
  "success": true,
  "message": "Session cleared successfully"
}
```

---

## 🚀 Framework-Specific APIs

### SWOT Analysis

#### POST `/api/frameworks/swot/analyze`

Provides SWOT analysis suggestions.

**Request:**
```json
{
  "context": "University online program launch",
  "industry": "education",
  "organization_size": "large",
  "current_data": {
    "strengths": ["Experienced faculty"],
    "weaknesses": ["Limited tech infrastructure"]
  }
}
```

**Response:**
```json
{
  "suggestions": {
    "strengths": [
      "Strong brand recognition in local market",
      "Established alumni network"
    ],
    "opportunities": [
      "Growing demand for online education",
      "Government funding for digital education"
    ]
  },
  "framework_tips": [
    "Consider both internal and external factors",
    "Prioritize items by impact and urgency"
  ]
}
```

### ACH Framework

#### POST `/api/frameworks/ach/matrix`

Generates ACH analysis matrix.

**Request:**
```json
{
  "hypotheses": [
    {"id": "h1", "text": "Product quality issues"},
    {"id": "h2", "text": "Competitor launched better product"}
  ],
  "evidence": [
    {"id": "e1", "text": "Customer complaints increased 40%"},
    {"id": "e2", "text": "Competitor announced new features"}
  ],
  "scores": {
    "h1_e1": {"consistency": 3, "credibility": 2},
    "h2_e2": {"consistency": 2, "credibility": 3}
  }
}
```

**Response:**
```json
{
  "matrix": {
    "h1": {"total_score": 5, "rank": 1},
    "h2": {"total_score": 5, "rank": 2}
  },
  "recommendations": [
    "Consider additional evidence for hypothesis differentiation",
    "Evaluate evidence credibility more carefully"
  ]
}
```

---

## ⚠️ Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error description",
  "details": {
    "field": "specific_error_info"
  },
  "request_id": "req_123456789"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_BOOKMARK` | 401 | Bookmark hash invalid or expired |
| `RATE_LIMITED` | 429 | Too many requests from IP |
| `INVALID_REQUEST` | 400 | Malformed request data |
| `FRAMEWORK_NOT_FOUND` | 404 | Requested framework doesn't exist |
| `EXPORT_FAILED` | 500 | Export generation failed |
| `STORAGE_FULL` | 413 | Storage quota exceeded |
| `SESSION_EXPIRED` | 401 | Session no longer valid |

### Example Error Response

```json
{
  "success": false,
  "error": "RATE_LIMITED",
  "message": "Too many validation attempts. Please try again in 15 minutes.",
  "details": {
    "retry_after": 900,
    "attempts_remaining": 0
  },
  "request_id": "req_789012345"
}
```

---

## 🔐 Security Considerations

### Request Security
- Always use HTTPS in production
- Include `X-Requested-With: XMLHttpRequest` for CSRF protection
- Validate all input on client and server
- Never log complete bookmark hashes

### Rate Limiting Details
```javascript
// Rate limit configuration
const limits = {
  auth_validate: { requests: 5, window: '15m' },
  export_generate: { requests: 10, window: '1h' },
  api_general: { requests: 100, window: '1h' }
}
```

### Headers
Required security headers in responses:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## 🧪 Testing

### Test Environment
```
Base URL: http://localhost:6780/api
Test Bookmark: 1000000000000000
```

### Example Test Requests

#### Authentication Test
```bash
curl -X POST http://localhost:6780/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"bookmarkHash":"1000000000000000"}'
```

#### Health Check Test
```bash
curl http://localhost:6780/api/health
```

#### Export Test
```bash
curl -X POST http://localhost:6780/api/export/generate \
  -H "Content-Type: application/json" \
  -d '{
    "bookmarkHash":"1000000000000000",
    "framework":"swot",
    "format":"pdf",
    "data":{"strengths":["Test"],"weaknesses":[],"opportunities":[],"threats":[]}
  }'
```

---

## 📊 Integration Examples

### JavaScript/TypeScript

```typescript
class ResearchToolsAPI {
  private baseUrl: string
  private bookmarkHash: string

  constructor(baseUrl: string, bookmarkHash: string) {
    this.baseUrl = baseUrl
    this.bookmarkHash = bookmarkHash
  }

  async validateBookmark(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarkHash: this.bookmarkHash })
    })
    
    const result = await response.json()
    return result.success
  }

  async exportAnalysis(framework: string, data: any, format: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/export/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookmarkHash: this.bookmarkHash,
        framework,
        format,
        data
      })
    })

    const result = await response.json()
    if (result.success) {
      return result.download_url
    }
    throw new Error(result.message)
  }
}

// Usage
const api = new ResearchToolsAPI('https://your-domain.com/api', '1234567890123456')
const downloadUrl = await api.exportAnalysis('swot', swotData, 'pdf')
```

### Python

```python
import requests
import json

class ResearchToolsAPI:
    def __init__(self, base_url: str, bookmark_hash: str):
        self.base_url = base_url
        self.bookmark_hash = bookmark_hash
        self.session = requests.Session()
    
    def validate_bookmark(self) -> bool:
        response = self.session.post(
            f"{self.base_url}/auth/validate",
            json={"bookmarkHash": self.bookmark_hash}
        )
        return response.json().get("success", False)
    
    def export_analysis(self, framework: str, data: dict, format: str) -> str:
        response = self.session.post(
            f"{self.base_url}/export/generate",
            json={
                "bookmarkHash": self.bookmark_hash,
                "framework": framework,
                "format": format,
                "data": data
            }
        )
        
        result = response.json()
        if result.get("success"):
            return result.get("download_url")
        else:
            raise Exception(result.get("message", "Export failed"))

# Usage
api = ResearchToolsAPI("https://your-domain.com/api", "1234567890123456")
download_url = api.export_analysis("swot", swot_data, "pdf")
```

### PHP

```php
<?php
class ResearchToolsAPI {
    private $baseUrl;
    private $bookmarkHash;
    
    public function __construct($baseUrl, $bookmarkHash) {
        $this->baseUrl = $baseUrl;
        $this->bookmarkHash = $bookmarkHash;
    }
    
    public function validateBookmark() {
        $data = json_encode(['bookmarkHash' => $this->bookmarkHash]);
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => $data
            ]
        ]);
        
        $response = file_get_contents($this->baseUrl . '/auth/validate', false, $context);
        $result = json_decode($response, true);
        
        return $result['success'] ?? false;
    }
    
    public function exportAnalysis($framework, $data, $format) {
        $payload = json_encode([
            'bookmarkHash' => $this->bookmarkHash,
            'framework' => $framework,
            'format' => $format,
            'data' => $data
        ]);
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => $payload
            ]
        ]);
        
        $response = file_get_contents($this->baseUrl . '/export/generate', false, $context);
        $result = json_decode($response, true);
        
        if ($result['success'] ?? false) {
            return $result['download_url'];
        }
        
        throw new Exception($result['message'] ?? 'Export failed');
    }
}

// Usage
$api = new ResearchToolsAPI('https://your-domain.com/api', '1234567890123456');
$downloadUrl = $api->exportAnalysis('swot', $swotData, 'pdf');
?>
```

---

## 🔄 Webhook Support

### Event Types

If webhook integration is enabled, the following events are available:

```json
{
  "event": "export.completed",
  "data": {
    "export_id": "exp_xyz789",
    "format": "pdf",
    "framework": "swot",
    "created": "2024-12-15T10:30:00Z"
  },
  "bookmark_hash_partial": "1234...3456"
}
```

**Available Events:**
- `export.completed`: Export generation finished
- `export.failed`: Export generation failed
- `session.expired`: User session expired
- `data.validated`: Framework data validated

---

## 📈 API Limits

### Rate Limits
- **Authentication**: 5 requests per 15 minutes per IP
- **General API**: 100 requests per hour per IP
- **Export Generation**: 10 exports per hour per bookmark
- **File Download**: 50 downloads per hour per IP

### Data Limits
- **Request Size**: 10MB maximum
- **Export Size**: 50MB maximum
- **Storage per Bookmark**: 10MB localStorage equivalent
- **Session Duration**: 4 hours maximum

### Quotas
Contact your administrator for increased quotas if needed.

---

## 🆔 Request IDs

All API responses include a unique `request_id` for debugging:

```json
{
  "success": true,
  "data": {},
  "request_id": "req_1234567890"
}
```

Include the request ID when reporting issues.

---

*Last Updated: December 2024*  
*API Documentation Version: 1.0*