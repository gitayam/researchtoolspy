# ResearchTools Implementation Plan
*Research → Plan → Implement - Following CLAUDE.md Workflow*

## 🎯 Executive Summary

Based on comprehensive research of the codebase, legacy implementations, and current issues, this plan addresses:

1. **Mock Data Removal** - Replace dashboard mock data with real API integration
2. **Authentication Flow Fixes** - Restore proper auth store integration  
3. **Missing Framework Implementation** - Build out frameworks from legacy concepts
4. **Framework Login Redirects** - Fix authenticated users being sent to login

## 🔍 Research Findings Summary

### Current Issues Identified
- **Mock Data**: Dashboard shows hardcoded "Recent Activity" and "Framework Usage" 
- **Auth Problems**: Temporary localStorage auth bypass causing login redirects
- **Missing Frameworks**: 6+ analytical frameworks exist in legacy but not current
- **API Gaps**: Backend uses temporary in-memory storage vs real database

### Legacy Framework Goldmine
- **14 Complete Frameworks** in legacy branch with sophisticated methodologies
- **AI Integration Patterns** for suggestions and analysis
- **Export Systems** with professional document generation
- **Network Visualization** capabilities for complex analysis

## 🚨 Critical Path Implementation

### Phase 1: Foundation Fixes (Day 1)
**Priority: BLOCKING** - These prevent normal usage

#### 1.1 Remove Mock Data from Dashboard
**Files to Modify:**
- `/frontend/src/stores/frameworks.ts` (lines 37-68) - Remove `recentSessions` mock array
- `/frontend/src/app/(dashboard)/dashboard/page.tsx` (lines 26-31) - Remove `frameworkStats` mock
- Replace with real API calls to `/api/v1/frameworks/`

**Implementation Steps:**
1. Remove hardcoded mock data arrays
2. Add API fetch calls with loading states  
3. Handle empty states properly
4. Add error boundaries for API failures

#### 1.2 Fix Authentication Flow
**Files to Modify:**
- `/frontend/src/app/(dashboard)/layout.tsx` (lines 22-34) - Remove localStorage bypass
- `/frontend/src/app/(dashboard)/layout.tsx` (lines 5-6) - Uncomment auth store imports
- Test all framework routes with proper authentication

**Implementation Steps:**
1. Uncomment proper auth store imports
2. Remove temporary localStorage auth check
3. Restore proper auth state management
4. Test authenticated navigation flow

#### 1.3 Connect Backend to Database
**Files to Modify:**
- `/api/app/api/v1/endpoints/frameworks.py` - Replace temporary storage with database
- Add proper database queries for user sessions
- Remove `_temp_sessions: dict[int, any] = {}` temporary storage

### Phase 2: Framework Enhancement (Day 2-3)
**Priority: HIGH** - Extends platform capabilities

#### 2.1 Implement Missing Critical Frameworks
Based on legacy research, prioritize these high-value frameworks:

**Immediate Priority:**
1. **DIME Analysis** (Diplomatic, Information, Military, Economic)
2. **DOTMLPF** (Doctrine, Organization, Training, Material, Leadership, Personnel, Facilities)  
3. **PMESII-PT** (Political, Military, Economic, Social, Information, Infrastructure, Physical Environment, Time)
4. **Enhanced Deception Detection** (MOM-POP-MOSES-EVE methodology)

**Implementation Pattern per Framework:**
```
backend/
├── app/api/v1/endpoints/{framework_name}.py
├── app/models/{framework_name}.py  
├── app/schemas/{framework_name}.py

frontend/
├── src/app/(dashboard)/analysis-frameworks/{framework_name}/
│   ├── page.tsx (list view)
│   ├── create/page.tsx (creation form)
│   └── [id]/page.tsx (detail view)
```

#### 2.2 AI Integration Enhancement
**Features from Legacy:**
- AI-assisted question generation for each framework
- Contextual suggestions based on framework type
- URL content processing and 5W analysis
- Entity normalization across analyses

**Implementation:**
- Extend existing AI service with framework-specific prompts
- Add URL processing capabilities to backend
- Implement suggestion system in frontend components

### Phase 3: Advanced Features (Day 4-5)
**Priority: MEDIUM** - Professional capabilities

#### 3.1 Professional Export System
**Legacy Features to Implement:**
- DOCX generation with proper formatting
- PDF export with visual elements
- GraphML export for network analysis
- JSON export for data portability

#### 3.2 Network Visualization
**For Complex Frameworks:**
- COG Analysis: Entity relationship mapping
- Fundamental Flow: Resource flow diagrams
- Cross-framework connections

## 🔧 Technical Implementation Strategy

### Backend Development Pattern
Following CLAUDE.md standards:

```python
# 1. Create SQLAlchemy model
class DIMEAnalysis(Base):
    __tablename__ = "dime_analyses"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    diplomatic_factors: Mapped[JSON] = mapped_column(JSON)
    # ... other fields

# 2. Create Pydantic schemas
class DIMEAnalysisCreate(BaseModel):
    title: str
    diplomatic_factors: List[DIMEFactor]
    # ... validation

# 3. Implement service layer  
class DIMEService:
    async def create_analysis(self, data: DIMEAnalysisCreate) -> DIMEAnalysis:
        # Business logic here
        pass

# 4. Add API endpoints
@router.post("/dime/", response_model=DIMEAnalysisResponse)
async def create_dime_analysis(data: DIMEAnalysisCreate):
    return await dime_service.create_analysis(data)
```

### Frontend Development Pattern
Following current architecture:

```typescript
// 1. Define TypeScript interfaces
interface DIMEAnalysis {
  id: string
  title: string
  diplomatic_factors: DIMEFactor[]
  framework_type: 'dime'
  status: 'draft' | 'in_progress' | 'completed'
}

// 2. Create React components with proper dark mode
const DIMECreatePage = () => {
  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardContent className="text-gray-900 dark:text-gray-100">
        {/* Form implementation */}
      </CardContent>
    </Card>
  )
}

// 3. Add API integration
const createDIMEAnalysis = async (data: DIMEAnalysisCreate) => {
  return await apiClient.post('/frameworks/', data)
}
```

## 📋 Branch and Commit Strategy

Following CLAUDE.md guidelines for frequent commits:

### Branch Structure:
- `feature/remove-mock-data` - Phase 1.1
- `feature/fix-authentication` - Phase 1.2  
- `feature/database-integration` - Phase 1.3
- `feature/dime-framework` - Individual frameworks
- `feature/ai-enhancement` - AI integration
- `feature/export-system` - Professional exports

### Commit Message Pattern:
```
feat: implement DIME framework analysis

- Add DIME backend model with diplomatic/info/military/economic factors
- Create React components for DIME creation and display
- Implement proper dark mode support following CLAUDE.md standards
- Add API endpoints with proper validation using Pydantic
- Include comprehensive TypeScript interfaces

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 🧪 Testing Strategy

### Backend Testing (pytest):
```bash
# Following CLAUDE.md standards
cd backend
conda activate omnicore-backend
make test  # Must pass ALL tests
make lint  # Must pass ALL linting
```

### Frontend Testing (vitest):
```bash
# Following CLAUDE.md standards  
cd frontend
conda activate omnicore-frontend
npm test  # Must pass ALL tests
npm run lint  # Must pass ALL linting
```

### Critical Testing Points:
- Authentication flow end-to-end
- Framework CRUD operations
- API error handling
- Dark mode accessibility (WCAG 4.5:1 contrast)
- Mobile responsiveness

## 🚀 Success Criteria

### Phase 1 Complete When:
- ✅ Dashboard shows real user data (no mock data)
- ✅ Authentication works properly (no login redirects for authenticated users)
- ✅ Backend stores data in database (not memory)
- ✅ All linting and tests pass (CLAUDE.md requirement)

### Phase 2 Complete When:
- ✅ 4+ new frameworks implemented with full CRUD
- ✅ AI suggestions working for all frameworks
- ✅ URL processing functional
- ✅ All framework types accessible from dashboard

### Phase 3 Complete When:
- ✅ Professional export system (DOCX/PDF)
- ✅ Network visualization for complex frameworks
- ✅ Cross-framework analysis capabilities
- ✅ Full accessibility compliance (WCAG 3.0)

## ⚠️ Risk Mitigation

### Identified Risks:
1. **Authentication Integration** - Complex auth store interactions
2. **Database Migration** - Switching from memory to persistent storage
3. **Legacy Code Complexity** - Sophisticated framework logic in Python/Streamlit
4. **AI API Dependencies** - OpenAI API availability and rate limits

### Mitigation Strategies:
1. **Incremental Testing** - Test each component thoroughly before integration
2. **Fallback Systems** - Implement graceful degradation for AI features
3. **Database Transactions** - Use proper SQLAlchemy transactions for data integrity
4. **Multiple Agents** - Spawn agents for parallel development when possible

## 🎯 Implementation Timeline

### Day 1: Critical Fixes
- **Morning**: Remove mock data, fix authentication
- **Afternoon**: Database integration, testing
- **Evening**: Deployment verification

### Day 2-3: Framework Development  
- **Day 2**: DIME + DOTMLPF implementation
- **Day 3**: PMESII-PT + Deception Detection

### Day 4-5: Advanced Features
- **Day 4**: AI enhancement, URL processing
- **Day 5**: Export system, network visualization

### Success Metrics:
- All CLAUDE.md automated checks pass ✅
- Zero console errors in browser
- All framework routes functional
- Professional user experience comparable to legacy

This plan follows CLAUDE.md's "Research → Plan → Implement" workflow and ensures we build maintainable, tested code that follows project patterns.