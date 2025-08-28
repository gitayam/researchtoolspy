# Phase 4: Modern Frontend Development - Detailed Implementation Plan

## Executive Summary
Transform OmniCore from Streamlit to modern Next.js 14 frontend consuming 80+ FastAPI endpoints. Complete rebuild required - no existing React code to migrate.

## Current State Analysis
- ✅ **Backend**: 80+ API endpoints complete (10 frameworks + research tools)
- ✅ **Authentication**: JWT-based auth with RBAC
- ✅ **Database**: SQLAlchemy models with async support
- ❌ **Frontend**: Streamlit-based, needs complete rebuild
- ❌ **React Code**: Non-existent, clean slate implementation

## Technology Stack Decision

### Core Framework
```typescript
// Framework & Build
Next.js 14.0+ with App Router
TypeScript 5.0+
Turbopack (development)

// Styling & UI
Tailwind CSS 3.4+
Headless UI (accessible components)
Lucide React (icons)
Framer Motion (animations)

// State Management
Zustand (global state)
TanStack Query v5 (server state)
React Hook Form (forms)

// Authentication
NextAuth.js v5 or custom JWT implementation
@next-auth/prisma-adapter or custom

// Data Visualization
D3.js + React
Recharts (charts)
React Flow (network diagrams)
Mermaid.js (flowcharts)

// Development & Testing
Vitest + React Testing Library
Playwright (E2E)
Storybook (component development)
```

## Architecture Decisions

### 1. Project Structure
```
frontend/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Main app layout
│   │   ├── frameworks/           # Framework pages
│   │   │   ├── page.tsx          # Framework selection
│   │   │   ├── [type]/           # Dynamic framework routes
│   │   │   │   ├── page.tsx      # Framework list
│   │   │   │   ├── create/page.tsx
│   │   │   │   └── [id]/         # Session routes
│   │   │   │       ├── page.tsx  # Analysis view
│   │   │   │       └── edit/page.tsx
│   │   │   └── layout.tsx
│   │   ├── tools/                # Research tools
│   │   │   ├── page.tsx
│   │   │   ├── citations/
│   │   │   ├── scraping/
│   │   │   ├── social-media/
│   │   │   └── documents/
│   │   ├── dashboard/page.tsx    # Main dashboard
│   │   └── layout.tsx            # Main layout
│   ├── api/                      # API routes (if needed)
│   ├── globals.css
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/                   # Reusable components
│   ├── ui/                       # Base UI components
│   ├── frameworks/               # Framework-specific components
│   ├── forms/                    # Form components
│   ├── charts/                   # Visualization components
│   └── layout/                   # Layout components
├── lib/                          # Utilities and configurations
│   ├── api.ts                    # API client
│   ├── auth.ts                   # Auth configuration
│   ├── utils.ts                  # Utility functions
│   └── validations.ts            # Zod schemas
├── stores/                       # Zustand stores
├── hooks/                        # Custom React hooks
├── types/                        # TypeScript types
└── styles/                       # Additional styles
```

### 2. API Integration Strategy

#### Authentication Flow
```typescript
// JWT token management
interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

// Auto-refresh implementation
const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

#### API Client Pattern
```typescript
// Centralized API client with error handling
class APIClient {
  async get<T>(endpoint: string): Promise<T>
  async post<T>(endpoint: string, data: any): Promise<T>
  async put<T>(endpoint: string, data: any): Promise<T>
  async delete(endpoint: string): Promise<void>
}

// Framework-specific services
class FrameworkService {
  async createSWOT(data: SWOTCreateRequest): Promise<SWOTSession>
  async getSWOT(id: number): Promise<SWOTSession>
  async updateSWOT(id: number, data: SWOTUpdateRequest): Promise<SWOTSession>
  async getAISuggestions(id: number): Promise<AISuggestions>
  async exportSWOT(id: number, format: ExportFormat): Promise<ExportResponse>
}
```

### 3. State Management Architecture

#### Zustand Stores
```typescript
// Authentication store
interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// Framework store
interface FrameworkStore {
  currentSession: FrameworkSession | null;
  sessions: FrameworkSession[];
  setCurrentSession: (session: FrameworkSession) => void;
  updateSession: (id: number, data: Partial<FrameworkSession>) => void;
}
```

#### TanStack Query Integration
```typescript
// Server state management
const useFrameworkSessions = (type: FrameworkType) => {
  return useQuery({
    queryKey: ['frameworks', type],
    queryFn: () => frameworkService.getSessions(type),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

const useCreateFramework = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: frameworkService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['frameworks']);
    },
  });
};
```

## Implementation Phases

### Phase 4.1: Foundation Setup (Week 1)
**Goal**: Establish Next.js 14 foundation with authentication

#### Tasks:
1. **Project Initialization**
   - [ ] Create Next.js 14 project with TypeScript
   - [ ] Configure Tailwind CSS + Headless UI
   - [ ] Set up ESLint + Prettier configuration
   - [ ] Configure Vitest testing environment

2. **Authentication System**
   - [ ] Implement JWT token management
   - [ ] Create login/register pages
   - [ ] Set up protected route middleware
   - [ ] Implement auto-refresh token logic

3. **API Client Foundation**
   - [ ] Create centralized API client (Axios/Fetch)
   - [ ] Implement request/response interceptors
   - [ ] Add error handling and retry logic
   - [ ] Set up TanStack Query configuration

4. **Base Layout & Navigation**
   - [ ] Create main application layout
   - [ ] Implement responsive sidebar navigation
   - [ ] Add user profile dropdown
   - [ ] Create breadcrumb navigation component

**Deliverables**:
- Working Next.js app with authentication
- Protected dashboard accessible after login
- Basic navigation structure
- API client ready for framework integration

### Phase 4.2: Core Framework Implementation (Weeks 2-3)
**Goal**: Implement 4 primary frameworks with full CRUD operations

#### Priority Frameworks:
1. **SWOT Analysis** (Most used)
2. **COG Analysis** (Complex visualization)
3. **PMESII-PT** (Multi-component)
4. **ACH Analysis** (Matrix-based)

#### Tasks per Framework:
1. **Framework Selection Interface**
   - [ ] Framework cards with descriptions
   - [ ] Quick start templates
   - [ ] Recent analyses list
   - [ ] Framework comparison modal

2. **SWOT Analysis Implementation**
   - [ ] Create SWOT session management
   - [ ] Build 4-quadrant input interface
   - [ ] Implement AI suggestions integration
   - [ ] Add validation and auto-save
   - [ ] Create export functionality (PDF/DOCX)

3. **COG Analysis Implementation**
   - [ ] Entity relationship visualization (React Flow)
   - [ ] Node creation and connection interface
   - [ ] Critical node analysis display
   - [ ] AI normalization integration
   - [ ] GraphML export functionality

4. **PMESII-PT Implementation**
   - [ ] Component-based input system
   - [ ] Interconnection matrix display
   - [ ] AI analysis integration
   - [ ] PowerPoint export capability

5. **ACH Analysis Implementation**
   - [ ] Hypothesis management interface
   - [ ] Evidence input and scoring
   - [ ] Matrix visualization component
   - [ ] Inconsistency highlighting

**Deliverables**:
- 4 fully functional frameworks
- Complete CRUD operations for each
- AI integration working
- Export functionality implemented
- Responsive design for all components

### Phase 4.3: Remaining Frameworks & Advanced Features (Weeks 4-5)
**Goal**: Complete all 10 frameworks and add advanced functionality

#### Remaining Frameworks:
5. **DOTMLPF** (Capability analysis)
6. **Deception Detection** (Reliability assessment)
7. **Behavioral Analysis** (Pattern analysis)
8. **Starbursting** (Question-based)
9. **Causeway** (Root cause analysis)
10. **DIME** (Strategic analysis)

#### Advanced Features:
1. **Session Management**
   - [ ] Session sharing and collaboration
   - [ ] Version history and comparison
   - [ ] Session templates and cloning
   - [ ] Bulk operations interface

2. **Visualization Enhancements**
   - [ ] Interactive charts (D3.js + React)
   - [ ] Network diagram improvements
   - [ ] Data export visualizations
   - [ ] Print-optimized layouts

3. **AI Integration Improvements**
   - [ ] Real-time AI suggestions
   - [ ] Framework-specific AI prompts
   - [ ] AI analysis confidence scoring
   - [ ] Custom AI model selection

**Deliverables**:
- All 10 frameworks implemented
- Advanced session management
- Enhanced visualizations
- Improved AI integration

### Phase 4.4: Research Tools Integration (Week 6)
**Goal**: Integrate Phase 3 research tool APIs

#### Research Tools:
1. **URL Processing Interface**
   - [ ] URL input with validation
   - [ ] Batch processing queue
   - [ ] Wayback Machine integration
   - [ ] Domain reputation display

2. **Citation Management**
   - [ ] Citation creation and editing
   - [ ] Format generation (APA/MLA/Chicago/BibTeX)
   - [ ] Bibliography export
   - [ ] Citation search and filtering

3. **Web Scraping Tools**
   - [ ] URL scraping interface
   - [ ] Job progress monitoring
   - [ ] Results preview and filtering
   - [ ] Data export options

4. **Social Media Analysis**
   - [ ] Platform selection interface
   - [ ] Content download tracking
   - [ ] Metadata analysis display
   - [ ] Multi-platform aggregation

5. **Document Processing**
   - [ ] File upload with drag-and-drop
   - [ ] Processing job monitoring
   - [ ] Text extraction display
   - [ ] Format conversion interface

**Deliverables**:
- Complete research tools integration
- Job monitoring and progress tracking
- File upload and processing workflow
- Integration with framework analyses

### Phase 4.5: Mobile Optimization & Polish (Week 7)
**Goal**: Mobile-first responsive design and UX polish

#### Mobile Optimization:
1. **Responsive Design**
   - [ ] Mobile-first Tailwind implementation
   - [ ] Touch-optimized interfaces
   - [ ] Collapsible navigation
   - [ ] Swipe gestures for frameworks

2. **Performance Optimization**
   - [ ] Code splitting implementation
   - [ ] Lazy loading for heavy components
   - [ ] Image optimization
   - [ ] Bundle size optimization

3. **Accessibility & UX**
   - [ ] WCAG 2.1 compliance
   - [ ] Keyboard navigation
   - [ ] Screen reader support
   - [ ] Loading states and error handling

4. **Progressive Web App**
   - [ ] Service worker implementation
   - [ ] Offline functionality
   - [ ] App manifest
   - [ ] Push notifications

**Deliverables**:
- Fully responsive mobile experience
- Performance-optimized application
- Accessibility compliance
- PWA functionality

## Risk Mitigation

### Technical Risks:
1. **API Integration Complexity**
   - *Mitigation*: Start with simple endpoints, build incrementally
   - *Fallback*: Mock data for development

2. **State Management Complexity**
   - *Mitigation*: Use proven patterns (Zustand + TanStack Query)
   - *Fallback*: Simplified state management if needed

3. **Visualization Performance**
   - *Mitigation*: Virtual scrolling, canvas-based rendering
   - *Fallback*: Simplified visualizations for complex data

### Timeline Risks:
1. **Framework Complexity Underestimation**
   - *Mitigation*: Focus on core functionality first
   - *Buffer*: Phase 4.6 for additional polish time

2. **API Changes During Development**
   - *Mitigation*: Version API contracts, use TypeScript
   - *Communication*: Regular backend/frontend sync

## Success Metrics

### Functional Requirements:
- ✅ All 10 frameworks fully functional
- ✅ Complete authentication and authorization
- ✅ All research tools integrated
- ✅ Export functionality working
- ✅ Mobile responsive design
- ✅ Accessibility compliance

### Performance Requirements:
- ✅ Page load time < 2 seconds
- ✅ Framework switching < 500ms
- ✅ Mobile performance score > 90
- ✅ Bundle size < 1MB (initial load)

### User Experience Requirements:
- ✅ Intuitive navigation
- ✅ Consistent design system
- ✅ Error handling and recovery
- ✅ Offline functionality basics

## Next Steps

1. **Initialize Next.js 14 project**
2. **Set up development environment**
3. **Implement authentication flow**
4. **Create first framework (SWOT)**
5. **Establish development patterns**

This plan provides a comprehensive roadmap for transforming OmniCore into a modern, scalable React-based frontend while leveraging all the robust API infrastructure already built.