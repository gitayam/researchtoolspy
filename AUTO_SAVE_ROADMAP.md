# Auto-Save Implementation Roadmap

## Executive Summary

Implement universal auto-save functionality that allows anonymous users to work on all tools/frameworks with automatic localStorage persistence, while providing seamless migration to backend storage when users authenticate. Critical requirement: **No data loss during authentication flow**.

## Current State Analysis

### Architecture Issues to Address
1. **Authentication Wall**: All frameworks/tools currently require login (dashboard-only access)
2. **Manual Save Only**: No auto-save mechanism exists
3. **Backend-Only Storage**: All data goes directly to APIs
4. **Inconsistent Endpoints**: Different frameworks use different save endpoints

### Existing Assets
- ✅ Zustand auth store with persistence
- ✅ Consistent framework data structures
- ✅ Robust error handling and toast system
- ✅ Well-organized component architecture

## Implementation Phases

### Phase 1: Foundation & Route Architecture (Week 1-2)

#### 1.1 Create Public Route Structure
```
/frameworks/         (public access)
├── ach/
├── swot/
├── cog/
└── ...

/dashboard/          (authenticated access) 
├── frameworks/      (saved sessions)
├── collaboration/
└── reports/
```

#### 1.2 Auto-Save Service Infrastructure
- Create universal `AutoSaveService` 
- Implement debounced save logic (500ms delay)
- Add visual save indicators
- Error handling and retry logic

#### 1.3 Data Store Architecture
```typescript
interface UniversalStore {
  // Anonymous data (localStorage)
  anonymous: {
    [frameworkType]: {
      [sessionId]: FrameworkData
    }
  }
  
  // Authenticated data cache
  authenticated: {
    [sessionId]: FrameworkData
  }
  
  // Meta information
  lastSaved: Date
  saveStatus: 'saved' | 'saving' | 'error'
}
```

### Phase 2: Auto-Save Implementation (Week 3-4)

#### 2.1 Universal Auto-Save Hook
```typescript
export function useAutoSave<T>(
  data: T,
  frameworkType: string,
  sessionId?: string
) {
  const { isAuthenticated } = useAuthStore()
  
  useEffect(() => {
    if (isAuthenticated && sessionId) {
      // Save to backend
      debouncedBackendSave(data, sessionId)
    } else {
      // Save to localStorage
      debouncedLocalSave(data, frameworkType)
    }
  }, [data, isAuthenticated, sessionId])
}
```

#### 2.2 Storage Management
- **localStorage Strategy**: Namespace by framework type
- **Backend Strategy**: Use existing API endpoints
- **Data Versioning**: Handle schema changes gracefully
- **Cleanup Logic**: Remove old localStorage entries

#### 2.3 Framework Integration
- Update all framework pages to use `useAutoSave`
- Remove manual save requirements for anonymous users
- Add save status indicators to UI

### Phase 3: Authentication Flow Enhancement (Week 5-6)

#### 3.1 Pre-Authentication Data Preservation
```typescript
// Before login/register redirect
const preserveWorkInProgress = () => {
  const currentWork = getCurrentFrameworkData()
  sessionStorage.setItem('pendingMigration', JSON.stringify(currentWork))
}
```

#### 3.2 Post-Authentication Data Migration
```typescript
// After successful login/register
const migrateAnonymousData = async () => {
  const pendingWork = sessionStorage.getItem('pendingMigration')
  const localStorageData = getAllLocalStorageData()
  
  // Prompt user for migration options
  // Save to backend
  // Clean up localStorage
}
```

#### 3.3 UX Flow Implementation
1. **Work Detection**: Check if user has unsaved work before auth
2. **Migration Prompt**: "You have unsaved work. Save to your account?"
3. **Conflict Resolution**: Handle existing backend data vs localStorage data
4. **Seamless Transition**: No interruption to user workflow

### Phase 4: Advanced Features (Week 7-8)

#### 4.1 Conflict Resolution
- Compare localStorage vs backend timestamps
- User-friendly merge interface
- Version history (future enhancement)

#### 4.2 Offline Support
- Service worker for offline functionality
- Sync queue for when connection restored
- Background sync API integration

#### 4.3 Performance Optimization
- Lazy loading of historical data
- Compression for large framework sessions
- Cleanup of stale data

## Technical Implementation Details

### 1. Auto-Save Service Design

```typescript
class AutoSaveService {
  private saveQueue: Map<string, any> = new Map()
  private debouncedSave = debounce(this.processSaveQueue, 500)
  
  public scheduleAutoSave(
    frameworkType: string, 
    sessionId: string, 
    data: any,
    isAuthenticated: boolean
  ) {
    this.saveQueue.set(`${frameworkType}:${sessionId}`, data)
    this.debouncedSave()
  }
  
  private async processSaveQueue() {
    for (const [key, data] of this.saveQueue) {
      const [frameworkType, sessionId] = key.split(':')
      
      if (this.isAuthenticated) {
        await this.saveToBackend(data, sessionId)
      } else {
        await this.saveToLocalStorage(data, frameworkType)
      }
    }
    this.saveQueue.clear()
  }
}
```

### 2. Data Migration Strategy

```typescript
interface MigrationPlan {
  localStorage: FrameworkSession[]
  backend: FrameworkSession[]
  conflicts: ConflictResolution[]
  strategy: 'merge' | 'replace' | 'keep-both'
}

const createMigrationPlan = (
  localData: any[], 
  backendData: any[]
): MigrationPlan => {
  // Analyze data for conflicts
  // Create migration strategy
  // Return actionable plan
}
```

### 3. Save Status Indicators

```typescript
const SaveStatusIndicator = () => {
  const { saveStatus, lastSaved } = useAutoSaveStore()
  
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      {saveStatus === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      )}
      {saveStatus === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Saved {formatRelativeTime(lastSaved)}
        </>
      )}
    </div>
  )
}
```

## User Experience Flows

### 1. Anonymous User Journey
```
1. Visit /frameworks/swot/create
2. Start working → Auto-save to localStorage every 500ms
3. See "💾 Draft saved locally" indicator
4. Click "Save to Account" → Prompted to login/register
5. During auth flow → Work preserved in sessionStorage
6. After auth → "Import your draft work?" prompt
7. Accept → Data migrated to backend
8. Continue working → Auto-save to backend
```

### 2. Returning Anonymous User
```
1. Visit /frameworks/swot/create
2. See "Resume previous work?" option
3. Click Resume → Load from localStorage
4. Continue working → Auto-save to localStorage
```

### 3. Authenticated User
```
1. Visit /dashboard/frameworks/swot/create
2. Work on framework → Auto-save to backend every 500ms
3. See "✅ Saved to account" indicator
4. No localStorage needed
```

## Risk Mitigation

### Data Loss Prevention
1. **Multiple Storage Points**: sessionStorage, localStorage, backend
2. **Graceful Degradation**: Fallback strategies for each storage method
3. **User Confirmation**: Always confirm before data migration/deletion
4. **Recovery Mechanisms**: Export functionality for anonymous users

### Performance Considerations
1. **Debounced Saves**: Prevent excessive API calls
2. **Incremental Updates**: Only save changed data
3. **Background Processing**: Non-blocking save operations
4. **Storage Limits**: Handle localStorage quota exceeded

### Security & Privacy
1. **Data Encryption**: Consider encrypting sensitive localStorage data
2. **Cleanup Policies**: Clear anonymous data after reasonable timeframe
3. **GDPR Compliance**: Respect user privacy preferences
4. **Session Management**: Secure handling of authentication transitions

## Testing Strategy

### Unit Tests
- Auto-save service functionality
- Data migration logic
- Storage adapters
- Conflict resolution

### Integration Tests
- Anonymous → Authenticated flow
- Cross-framework data preservation
- Error handling scenarios
- Performance under load

### User Acceptance Tests
- Complete user journeys
- Edge case scenarios
- Accessibility compliance
- Cross-browser compatibility

## Success Metrics

### Technical Metrics
- Zero data loss incidents during authentication
- < 100ms auto-save response time
- > 99.9% save success rate
- < 1MB localStorage usage per framework

### User Experience Metrics
- Reduced support tickets about lost work
- Increased conversion from anonymous to authenticated
- Higher framework completion rates
- Positive user feedback on seamless experience

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Create public framework routes
- [ ] Implement auto-save service
- [ ] Basic localStorage integration

### Week 3-4: Auto-Save Integration  
- [ ] Update all framework pages
- [ ] Add save status indicators
- [ ] Testing and refinement

### Week 5-6: Authentication Flow
- [ ] Data preservation during auth
- [ ] Migration interface
- [ ] Conflict resolution

### Week 7-8: Polish & Advanced Features
- [ ] Performance optimization
- [ ] Error handling enhancement
- [ ] Documentation and training

## Future Enhancements

### Phase 2 Features
- **Version History**: Track changes over time
- **Collaborative Editing**: Real-time collaboration
- **Cross-Device Sync**: Sync across user devices
- **Advanced Analytics**: Usage patterns and insights

### Integration Opportunities
- **Export Integration**: Include auto-saved drafts in exports
- **Template System**: Save custom framework templates
- **Sharing**: Share anonymous drafts via links
- **API Access**: Programmatic access to saved sessions

---

**Key Principle**: The user should never lose their work, regardless of their authentication state or the technical challenges involved. Every decision should prioritize data preservation and user experience.