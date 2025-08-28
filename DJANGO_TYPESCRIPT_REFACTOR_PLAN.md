# Django + TypeScript Refactoring Plan

## Executive Summary

This document outlines the comprehensive refactoring plan to migrate the Research Tools platform from Streamlit to a modern Django backend with TypeScript/React frontend. The current application is a research analysis platform featuring multiple analytical frameworks and data transformation tools.

## Current Architecture Analysis

### Streamlit Application Overview
- **Main Entry Point**: `app.py` - Homepage with navigation to frameworks and tools
- **Core Pages**: 
  - `pages/Frameworks.py` - Dynamic framework loader using importlib
  - `pages/Transformers.py` - Data transformation tools
  - `pages/Tools.py` - Additional utilities
- **Framework System**: Modular analytical frameworks (SWOT, COG, ACH, DIME, PMESII-PT, etc.)
- **Base Classes**: `frameworks/base_framework.py` - Abstract base for all frameworks
- **Utilities**: Data conversion, AI query generation, web scraping, social media tools

### Key Features Identified
1. **Analysis Frameworks** (10+ frameworks including SWOT, COG, ACH, DIME, PMESII-PT, DOTMLPF, Starbursting, Deception Detection, Behavioral Analysis, CauseWay)
2. **Data Transformation Tools** (CSV/JSON conversion, URL processing, image hashing)
3. **AI Integration** (OpenAI GPT for query generation and suggestions)
4. **Export Capabilities** (JSON, Word documents, PDF)
5. **Web Scraping & Data Collection** (Social media, Wayback Machine, Wikipedia)
6. **Session Management** (Framework state persistence)
7. **Dynamic Module Loading** (Framework discovery and routing)

### Technology Stack (Current)
- **Frontend**: Streamlit (Python-based UI)
- **Backend Logic**: Python with various libraries
- **Data Processing**: Pandas, NetworkX for graph analysis
- **AI Services**: OpenAI API integration
- **Document Export**: python-docx, xhtml2pdf, pdfkit
- **Web Scraping**: BeautifulSoup, Playwright, Selenium
- **Social Media**: yt-dlp, instaloader, praw, tweepy

## Target Architecture

### Django Backend
```
research_tools_project/
├── manage.py
├── requirements.txt
├── research_tools/                    # Main Django project
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── development.py
│   │   ├── production.py
│   │   └── testing.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── core/                          # Core utilities and base classes
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── base_framework.py
│   ├── frameworks/                    # Framework management
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── framework_registry.py
│   │   └── implementations/
│   │       ├── swot.py
│   │       ├── cog.py
│   │       ├── ach.py
│   │       └── ...
│   ├── transformers/                  # Data transformation tools
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── services/
│   ├── ai_services/                   # AI integration
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── openai_client.py
│   │   └── query_generator.py
│   ├── exports/                       # Document export services
│   │   ├── models.py
│   │   ├── views.py
│   │   └── exporters/
│   ├── scrapers/                      # Web scraping services
│   │   ├── models.py
│   │   ├── views.py
│   │   └── services/
│   └── accounts/                      # User management
│       ├── models.py
│       ├── views.py
│       └── serializers.py
└── static/
    └── admin/
```

### TypeScript/React Frontend
```
frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── frameworks/
│   │   │   ├── FrameworkCard.tsx
│   │   │   ├── FrameworkSelector.tsx
│   │   │   ├── FrameworkRenderer.tsx
│   │   │   └── implementations/
│   │   │       ├── SwotFramework.tsx
│   │   │       ├── CogFramework.tsx
│   │   │       └── ...
│   │   ├── transformers/
│   │   │   ├── DataConverter.tsx
│   │   │   ├── QueryGenerator.tsx
│   │   │   └── UrlProcessor.tsx
│   │   └── forms/
│   │       ├── DynamicForm.tsx
│   │       └── FormField.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── FrameworksPage.tsx
│   │   ├── TransformersPage.tsx
│   │   └── ToolsPage.tsx
│   ├── hooks/
│   │   ├── useFramework.ts
│   │   ├── useApi.ts
│   │   └── useLocalStorage.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── frameworkService.ts
│   │   └── exportService.ts
│   ├── types/
│   │   ├── framework.ts
│   │   ├── api.ts
│   │   └── common.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── frameworkSlice.ts
│   │   └── uiSlice.ts
│   └── utils/
│       ├── validation.ts
│       ├── formatting.ts
│       └── constants.ts
```

## Migration Strategy

### Phase 1: Backend Foundation (Weeks 1-3)
1. **Django Project Setup**
   - Initialize Django project with proper settings structure
   - Configure Django REST Framework
   - Set up database models for frameworks, sessions, and user data
   - Implement authentication and authorization

2. **Core Framework System**
   - Port `base_framework.py` to Django abstract model
   - Create framework registry system
   - Implement dynamic framework loading mechanism
   - Create REST API endpoints for framework operations

3. **Database Design**
   ```sql
   -- Framework Sessions
   CREATE TABLE framework_sessions (
       id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES auth_user(id),
       framework_type VARCHAR(50),
       session_data JSONB,
       created_at TIMESTAMP,
       updated_at TIMESTAMP
   );
   
   -- Framework Responses
   CREATE TABLE framework_responses (
       id SERIAL PRIMARY KEY,
       session_id INTEGER REFERENCES framework_sessions(id),
       component VARCHAR(100),
       response_data JSONB,
       created_at TIMESTAMP
   );
   ```

### Phase 2: Framework Migration (Weeks 4-6)
1. **Framework Implementation**
   - Port each framework from Streamlit to Django views/serializers
   - Implement framework-specific business logic
   - Create API endpoints for each framework type
   - Test framework functionality with API clients

2. **AI Services Integration**
   - Port OpenAI integration to Django service layer
   - Implement query generation endpoints
   - Add AI suggestion services for frameworks
   - Handle API key management and rate limiting

### Phase 3: Frontend Development (Weeks 7-10)
1. **React/TypeScript Setup**
   - Initialize Vite project with TypeScript
   - Set up Redux Toolkit for state management
   - Configure routing with React Router
   - Implement responsive design system

2. **Core Components**
   - Create reusable form components
   - Implement framework rendering system
   - Build data visualization components
   - Develop export functionality UI

3. **Framework UI Implementation**
   - Port each framework's Streamlit UI to React components
   - Implement dynamic form generation
   - Add real-time data persistence
   - Create framework-specific visualizations

### Phase 4: Advanced Features (Weeks 11-12)
1. **Data Transformation Tools**
   - Port CSV/JSON conversion utilities
   - Implement URL processing tools
   - Add image hashing capabilities
   - Create social media download interfaces

2. **Export System**
   - Implement PDF/Word document generation
   - Add JSON export functionality
   - Create email/sharing capabilities
   - Build report templates

### Phase 5: Testing & Deployment (Weeks 13-14)
1. **Testing**
   - Unit tests for Django models and views
   - API endpoint testing
   - Frontend component testing
   - End-to-end testing for critical workflows

2. **Deployment**
   - Docker containerization
   - CI/CD pipeline setup
   - Production environment configuration
   - Performance optimization

## Technical Implementation Details

### Django Models Structure

```python
# apps/core/models.py
class BaseFramework(models.Model):
    name = models.CharField(max_length=100)
    version = models.CharField(max_length=20, default="1.0")
    components = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        abstract = True

# apps/frameworks/models.py
class FrameworkSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    framework_type = models.CharField(max_length=50)
    title = models.CharField(max_length=200)
    session_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class FrameworkResponse(models.Model):
    session = models.ForeignKey(FrameworkSession, on_delete=models.CASCADE)
    component = models.CharField(max_length=100)
    response_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### API Endpoints

```python
# Framework Management
GET    /api/frameworks/                    # List available frameworks
POST   /api/frameworks/sessions/          # Create new session
GET    /api/frameworks/sessions/{id}/     # Get session details
PUT    /api/frameworks/sessions/{id}/     # Update session
DELETE /api/frameworks/sessions/{id}/     # Delete session

# Framework Operations
POST   /api/frameworks/{type}/generate/   # Generate framework questions
POST   /api/frameworks/{type}/analyze/    # Analyze framework data
GET    /api/frameworks/{type}/export/     # Export framework results

# AI Services
POST   /api/ai/generate-query/           # Generate advanced queries
POST   /api/ai/suggest/                  # Get AI suggestions

# Data Transformation
POST   /api/transform/csv-json/          # Convert CSV to JSON
POST   /api/transform/url-process/       # Process URLs
POST   /api/transform/image-hash/        # Generate image hashes
```

### TypeScript Type Definitions

```typescript
// types/framework.ts
interface Framework {
  id: string;
  name: string;
  description: string;
  components: string[];
  version: string;
}

interface FrameworkSession {
  id: number;
  frameworkType: string;
  title: string;
  sessionData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface FrameworkResponse {
  component: string;
  responseData: any;
  createdAt: string;
}

// types/api.ts
interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count: number;
  next?: string;
  previous?: string;
}
```

### State Management with Redux Toolkit

```typescript
// store/frameworkSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchFrameworks = createAsyncThunk(
  'frameworks/fetchFrameworks',
  async () => {
    const response = await frameworkService.getFrameworks();
    return response.data;
  }
);

const frameworkSlice = createSlice({
  name: 'frameworks',
  initialState: {
    frameworks: [],
    currentSession: null,
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentSession: (state, action) => {
      state.currentSession = action.payload;
    },
    updateSessionData: (state, action) => {
      if (state.currentSession) {
        state.currentSession.sessionData = {
          ...state.currentSession.sessionData,
          ...action.payload,
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFrameworks.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFrameworks.fulfilled, (state, action) => {
        state.frameworks = action.payload;
        state.loading = false;
      })
      .addCase(fetchFrameworks.rejected, (state, action) => {
        state.error = action.error.message;
        state.loading = false;
      });
  },
});
```

## Migration Challenges & Solutions

### 1. State Management Migration
**Challenge**: Streamlit's session state is different from React state management
**Solution**: Use Redux Toolkit with persistence middleware to maintain framework state across sessions

### 2. Dynamic Component Loading
**Challenge**: Streamlit's dynamic module imports need React equivalent
**Solution**: Implement dynamic component loading with React.lazy() and framework registry

### 3. Form Handling
**Challenge**: Streamlit's form widgets vs React form libraries
**Solution**: Create wrapper components that mimic Streamlit's form API using React Hook Form

### 4. Real-time Updates
**Challenge**: Streamlit's automatic rerun vs React's controlled updates
**Solution**: Implement WebSocket connections for real-time collaboration features

### 5. File Handling
**Challenge**: Streamlit's built-in file upload vs custom implementation
**Solution**: Use Django's file handling with React dropzone components

## Performance Considerations

1. **API Optimization**
   - Implement caching with Redis for frequently accessed framework data
   - Use database indexing for framework sessions and responses
   - Implement pagination for large datasets

2. **Frontend Optimization**
   - Code splitting for framework components
   - Lazy loading of framework implementations
   - Memoization of expensive calculations

3. **Asset Management**
   - CDN for static assets
   - Image optimization for framework diagrams
   - Bundle size optimization

## Security Considerations

1. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control for frameworks
   - API rate limiting

2. **Data Protection**
   - Encrypt sensitive framework data
   - Secure API key storage
   - Input validation and sanitization

3. **API Security**
   - CORS configuration
   - CSRF protection
   - SQL injection prevention

## Testing Strategy

1. **Backend Testing**
   - Unit tests for models and serializers
   - Integration tests for API endpoints
   - Performance tests for framework operations

2. **Frontend Testing**
   - Component unit tests with Jest and React Testing Library
   - Integration tests for framework workflows
   - E2E tests with Playwright

3. **API Testing**
   - OpenAPI specification generation
   - Automated API testing with Postman/Newman
   - Load testing for concurrent framework sessions

## Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │  Django API     │    │   PostgreSQL    │
│   (Nginx)       │◄──►│  (Gunicorn)     │◄──►│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      CDN        │    │     Redis       │    │   File Storage  │
│   (Static)      │    │   (Cache)       │    │    (S3/Local)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Timeline & Milestones

**Week 1-2**: Django setup, core models, authentication
**Week 3-4**: Framework system migration, API development
**Week 5-6**: AI services integration, export system
**Week 7-8**: React setup, core components, routing
**Week 9-10**: Framework UI implementation, state management
**Week 11-12**: Data transformation tools, advanced features
**Week 13**: Testing, performance optimization
**Week 14**: Deployment, documentation, training

## Risk Mitigation

1. **Technical Risks**
   - Keep Streamlit version running in parallel during migration
   - Implement feature flags for gradual rollout
   - Create comprehensive backup procedures

2. **User Experience Risks**
   - Maintain familiar UI patterns where possible
   - Provide migration guides and training materials
   - Implement user feedback collection system

3. **Data Migration Risks**
   - Create data export/import utilities
   - Implement backward compatibility for framework sessions
   - Test data migration thoroughly in staging environment

## Post-Migration Benefits

1. **Scalability**: Better handling of concurrent users and large datasets
2. **Performance**: Faster load times and more responsive UI
3. **Maintainability**: Cleaner separation of concerns and modern development practices
4. **Extensibility**: Easier to add new frameworks and features
5. **User Experience**: More polished and professional interface
6. **Mobile Support**: Responsive design for tablet and mobile access
7. **Collaboration**: Multi-user support for framework sessions
8. **Integration**: Better API support for third-party integrations

## Conclusion

This refactoring plan provides a comprehensive roadmap for migrating from Streamlit to a modern Django + TypeScript stack. The phased approach minimizes risk while ensuring all current functionality is preserved and enhanced. The new architecture will provide better scalability, performance, and user experience while maintaining the analytical power that makes the Research Tools platform valuable.

The estimated timeline is 14 weeks with proper resource allocation. Success depends on thorough testing, user feedback incorporation, and careful attention to maintaining the analytical workflows that users depend on.