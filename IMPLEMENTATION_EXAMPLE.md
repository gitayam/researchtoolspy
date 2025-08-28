# Auto-Save Implementation Example

This document shows how to integrate the auto-save functionality into framework pages using the ACH framework as an example.

## Phase 1: Update Framework Page Structure

### 1. Create Public Route Structure

First, create public routes alongside the existing dashboard routes:

```
/frameworks/ach/create         (public - anonymous users)
/frameworks/ach/[id]           (public - view sessions)
/dashboard/frameworks/ach/     (authenticated - saved sessions list)
```

### 2. Updated ACH Create Page with Auto-Save

```typescript
// /frameworks/ach/create/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAutoSave } from '@/services/auto-save'
import { useAutoSaveActions, useCurrentSession } from '@/stores/auto-save'
import { SaveStatusIndicator } from '@/components/auto-save/save-status-indicator'
import { MigrationPrompt } from '@/components/auto-save/migration-prompt'
import { useIsAuthenticated } from '@/stores/auth'

export default function ACHCreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAuthenticated = useIsAuthenticated()
  
  // Auto-save integration
  const { createNewSession, loadSession } = useAutoSaveActions()
  const currentSession = useCurrentSession()
  
  // Framework state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [scores, setScores] = useState<Map<string, Map<string, ACHScore>>>(new Map())
  
  // Session management
  const [sessionId, setSessionId] = useState<string>('new')
  const [isLoading, setIsLoading] = useState(false)
  
  // Auto-save hook - this handles all the automatic saving
  const { saveStatus, generateSessionId } = useAutoSave(
    {
      title,
      description,
      hypotheses,
      evidence,
      scores: Array.from(scores.entries()),
      framework_type: 'ach'
    },
    'ach',
    sessionId,
    { 
      enabled: !isLoading && (title || hypotheses.length > 0),
      title: title || 'Untitled ACH Analysis'
    }
  )
  
  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      const editId = searchParams.get('edit')
      const resumeId = searchParams.get('resume')
      
      if (editId) {
        // Load existing session for editing
        setIsLoading(true)
        const session = await loadSession('ach', editId)
        if (session) {
          setSessionId(editId)
          setTitle(session.data.title || '')
          setDescription(session.data.description || '')
          setHypotheses(session.data.hypotheses || [])
          setEvidence(session.data.evidence || [])
          // ... load other data
        }
        setIsLoading(false)
      } else if (resumeId) {
        // Resume anonymous session
        setIsLoading(true)
        const session = await loadSession('ach', resumeId)
        if (session) {
          setSessionId(resumeId)
          // Load data...
        }
        setIsLoading(false)
      } else {
        // Create new session
        const newSessionId = generateSessionId()
        setSessionId(newSessionId)
        createNewSession('ach', 'Untitled ACH Analysis')
      }
    }
    
    initializeSession()
  }, [searchParams])
  
  // Manual save for authenticated users who want to "publish"
  const handleManualSave = async () => {
    if (!isAuthenticated) {
      // Prompt for login
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    
    // For authenticated users, this creates a "published" version
    // vs the auto-saved draft
    try {
      const response = await apiClient.post('/frameworks/', {
        title,
        description,
        framework_type: 'ach',
        data: {
          hypotheses,
          evidence,
          scores: Array.from(scores.entries())
        },
        status: 'completed'
      })
      
      router.push(`/dashboard/frameworks/ach/${response.id}`)
    } catch (error) {
      // Handle error
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Migration prompt for authenticated users with pending work */}
      <MigrationPrompt compact />
      
      {/* Header with save status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ACH Analysis</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analysis of Competing Hypotheses
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Save status indicator */}
          <SaveStatusIndicator sessionId={sessionId} />
          
          {/* Action buttons */}
          <div className="flex gap-2">
            {!isAuthenticated && (
              <Button 
                variant="outline"
                onClick={() => router.push('/login')}
              >
                Sign In to Save
              </Button>
            )}
            
            <Button 
              onClick={handleManualSave}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAuthenticated ? 'Publish Analysis' : 'Save Analysis'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Market Entry Strategy Analysis"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the analysis..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Rest of the ACH framework UI */}
      {/* ... hypotheses, evidence, scoring sections ... */}
    </div>
  )
}
```

### 3. Anonymous Session Browser Component

```typescript
// /components/auto-save/anonymous-session-browser.tsx
export function AnonymousSessionBrowser({ frameworkType }: { frameworkType: string }) {
  const { getAnonymousSessions } = useAutoSaveActions()
  const sessions = getAnonymousSessions(frameworkType)
  
  if (sessions.length === 0) {
    return null
  }
  
  return (
    <Card className="border-dashed border-2 border-gray-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Resume Previous Work
        </CardTitle>
        <CardDescription>
          You have {sessions.length} saved session(s) from previous visits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sessions.slice(0, 3).map((session) => (
            <div 
              key={session.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
              onClick={() => {
                const url = new URL(window.location.href)
                url.searchParams.set('resume', session.id)
                window.location.href = url.toString()
              }}
            >
              <div>
                <p className="font-medium">{session.title}</p>
                <p className="text-sm text-gray-500">
                  {formatRelativeTime(session.lastModified)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          ))}
          
          {sessions.length > 3 && (
            <p className="text-sm text-gray-500 text-center pt-2">
              +{sessions.length - 3} more sessions
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 4. Enhanced Authentication Flow

```typescript
// /app/(auth)/login/page.tsx - Updated to preserve work
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAutoSaveActions } from '@/stores/auto-save'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const { preserveWorkForAuthentication } = useAutoSaveActions()
  
  useEffect(() => {
    // Preserve any current work before login
    preserveWorkForAuthentication()
  }, [])
  
  const handleLogin = async (credentials) => {
    try {
      await login(credentials)
      
      // Redirect to original page or dashboard
      const redirect = searchParams.get('redirect')
      if (redirect) {
        router.push(redirect)
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      // Handle error
    }
  }
  
  return (
    <div>
      {/* Login form */}
      <form onSubmit={handleLogin}>
        {/* ... form fields ... */}
      </form>
      
      {/* Show migration info if user has pending work */}
      <MigrationPrompt compact />
    </div>
  )
}
```

### 5. Dashboard Integration

```typescript
// /app/(dashboard)/frameworks/ach/page.tsx - Show saved sessions
export default function ACHDashboardPage() {
  const [sessions, setSessions] = useState([])
  const { checkForPendingMigration } = useAutoSaveActions()
  
  useEffect(() => {
    // Check for any pending migration when user views dashboard
    checkForPendingMigration()
    
    // Load saved sessions from backend
    loadSessions()
  }, [])
  
  return (
    <div>
      {/* Migration banner */}
      <MigrationBanner />
      
      {/* Saved sessions */}
      <div className="grid gap-4">
        {sessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
      
      {/* Create new button */}
      <Link href="/frameworks/ach/create">
        <Button>New ACH Analysis</Button>
      </Link>
    </div>
  )
}
```

## Phase 2: Universal Framework Hook

Create a universal hook that any framework can use:

```typescript
// /hooks/use-framework-session.ts
export function useFrameworkSession<T>(
  frameworkType: string,
  defaultData: T,
  options: {
    title?: string
    autoSaveEnabled?: boolean
    loadFromUrl?: boolean
  } = {}
) {
  const searchParams = useSearchParams()
  const { createNewSession, loadSession } = useAutoSaveActions()
  
  const [sessionId, setSessionId] = useState<string>('new')
  const [data, setData] = useState<T>(defaultData)
  const [isLoading, setIsLoading] = useState(false)
  
  // Auto-save integration
  const { saveStatus, generateSessionId } = useAutoSave(
    data,
    frameworkType,
    sessionId,
    {
      enabled: options.autoSaveEnabled !== false,
      title: options.title || 'Untitled'
    }
  )
  
  // Session initialization
  useEffect(() => {
    if (options.loadFromUrl) {
      const editId = searchParams.get('edit')
      const resumeId = searchParams.get('resume')
      
      if (editId || resumeId) {
        initializeFromId(editId || resumeId!)
      } else {
        initializeNew()
      }
    } else {
      initializeNew()
    }
  }, [searchParams, frameworkType])
  
  const initializeFromId = async (id: string) => {
    setIsLoading(true)
    try {
      const session = await loadSession(frameworkType, id)
      if (session) {
        setSessionId(id)
        setData(session.data)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const initializeNew = () => {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    createNewSession(frameworkType, options.title)
  }
  
  return {
    sessionId,
    data,
    setData,
    isLoading,
    saveStatus,
    
    // Utilities
    updateData: (updater: (prev: T) => T) => setData(updater),
    resetSession: initializeNew
  }
}
```

## Phase 3: Complete Framework Integration

Any framework can now be updated with minimal changes:

```typescript
// Example: SWOT framework with auto-save
export default function SWOTCreatePage() {
  const {
    sessionId,
    data,
    updateData,
    isLoading,
    saveStatus
  } = useFrameworkSession('swot', {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: []
  }, {
    title: 'SWOT Analysis',
    loadFromUrl: true
  })
  
  const addStrength = (text: string) => {
    updateData(prev => ({
      ...prev,
      strengths: [...prev.strengths, { id: Date.now().toString(), text }]
    }))
  }
  
  return (
    <div>
      <SaveStatusIndicator sessionId={sessionId} />
      
      {/* Framework UI */}
      {data.strengths.map(strength => (
        <StrengthItem key={strength.id} strength={strength} />
      ))}
    </div>
  )
}
```

## Benefits of This Implementation

### 1. **Zero Data Loss**
- Work is saved every 500ms automatically
- Multiple fallback storage methods
- Preserved during authentication flow

### 2. **Seamless User Experience**
- Users can start working immediately
- No interruption for authentication
- Natural upgrade path to accounts

### 3. **Progressive Enhancement**
- Anonymous users get full functionality
- Authenticated users get additional features
- Graceful degradation for offline use

### 4. **Developer Friendly**
- Universal hook for easy integration
- Consistent patterns across frameworks
- Minimal changes to existing code

### 5. **Performance Optimized**
- Debounced saves prevent API spam
- Local storage for anonymous users
- Background migration process

This implementation provides a robust foundation for auto-save functionality while maintaining the existing user experience and making it easy to integrate across all framework types.