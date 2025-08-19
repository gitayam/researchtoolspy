# Bookmark Authentication - Technical Implementation Guide

## Architecture Overview

This document provides technical implementation details for developers working with the bookmark authentication system.

## System Components

### 1. Hash Generation Service

Located in: `/src/lib/hash-auth.ts`

```typescript
/**
 * Generates a cryptographically secure 16-digit bookmark code
 * Range: 1000000000000000 to 9999999999999999
 * Entropy: ~53.1 bits
 */
export function generateBookmarkHash(): string {
  const min = 1000000000000000
  const max = 9999999999999999
  const range = max - min
  
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    const array = new Uint32Array(2)
    window.crypto.getRandomValues(array)
    const randomValue = (array[0] * 0x100000000 + array[1]) % range
    const bookmarkNumber = min + Math.abs(randomValue)
    return bookmarkNumber.toString().padStart(16, '0')
  } else {
    // Server environment (Node.js)
    const bookmarkNumber = Math.floor(Math.random() * (max - min + 1)) + min
    return bookmarkNumber.toString().padStart(16, '0')
  }
}
```

### 2. Format Utilities

```typescript
// Format for display: 1234 5678 9012 3456
export function formatHashForDisplay(hash: string): string {
  if (hash.length !== 16) return hash
  return hash.match(/.{1,4}/g)?.join(' ') || hash
}

// Clean user input (remove spaces and dashes)
export function cleanHashInput(input: string): string {
  return input.replace(/[\s-]/g, '')
}

// Validate hash format
export function isValidHash(hash: string): boolean {
  const cleaned = cleanHashInput(hash)
  return /^\d{16}$/.test(cleaned)
}
```

### 3. Storage Layer

#### Browser Storage (LocalStorage)

```typescript
interface BookmarkStorage {
  // List of valid bookmark hashes
  omnicore_valid_hashes: string[]
  
  // Current active bookmark
  omnicore_user_hash: string
  
  // Authentication state
  omnicore_authenticated: 'true' | 'false'
  
  // Work data for each bookmark
  [key: `work_${hash}`]: any
}

// Store a new bookmark
function saveBookmark(hash: string): void {
  const validHashes = JSON.parse(
    localStorage.getItem('omnicore_valid_hashes') || '[]'
  )
  if (!validHashes.includes(hash)) {
    validHashes.push(hash)
    localStorage.setItem('omnicore_valid_hashes', 
      JSON.stringify(validHashes))
  }
}

// Validate bookmark exists
function isValidBookmark(hash: string): boolean {
  const validHashes = JSON.parse(
    localStorage.getItem('omnicore_valid_hashes') || '[]'
  )
  return validHashes.includes(hash)
}
```

#### Session Management

```typescript
interface SessionData {
  bookmarkHash: string
  createdAt: string
  lastAccessed: string
  workData: {
    frameworks: Record<string, any>
    tools: Record<string, any>
  }
}

// Create new session
function createSession(bookmarkHash: string): SessionData {
  const session: SessionData = {
    bookmarkHash,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    workData: {
      frameworks: {},
      tools: {}
    }
  }
  
  localStorage.setItem(`session_${bookmarkHash}`, 
    JSON.stringify(session))
  return session
}

// Update session activity
function touchSession(bookmarkHash: string): void {
  const session = getSession(bookmarkHash)
  if (session) {
    session.lastAccessed = new Date().toISOString()
    localStorage.setItem(`session_${bookmarkHash}`, 
      JSON.stringify(session))
  }
}
```

### 4. Auto-Save Integration

```typescript
// Hook for framework auto-save
export function useFrameworkSession<T>(config: {
  frameworkType: string
  autoSaveInterval: number
  initialData: T
}) {
  const [sessionId] = useState(() => generateSessionId())
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  
  const saveSession = useCallback((data: T) => {
    setSaveStatus('saving')
    
    const bookmarkHash = localStorage.getItem('omnicore_user_hash')
    const sessionKey = bookmarkHash 
      ? `${config.frameworkType}_${bookmarkHash}_${sessionId}`
      : `${config.frameworkType}_anon_${sessionId}`
    
    localStorage.setItem(sessionKey, JSON.stringify({
      data,
      lastSaved: new Date().toISOString(),
      framework: config.frameworkType
    }))
    
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [config.frameworkType, sessionId])
  
  // Auto-save timer
  useEffect(() => {
    const interval = setInterval(() => {
      saveSession(currentData)
    }, config.autoSaveInterval)
    
    return () => clearInterval(interval)
  }, [currentData, saveSession, config.autoSaveInterval])
  
  return { sessionId, saveStatus, saveSession }
}
```

## Security Implementation

### 1. Rate Limiting

Implement rate limiting to prevent brute force attempts:

```typescript
class RateLimiter {
  private attempts: Map<string, number[]> = new Map()
  private readonly maxAttempts = 5
  private readonly windowMs = 15 * 60 * 1000 // 15 minutes
  
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(identifier) || []
    
    // Remove old attempts outside window
    const validAttempts = attempts.filter(
      time => now - time < this.windowMs
    )
    
    if (validAttempts.length >= this.maxAttempts) {
      return false
    }
    
    validAttempts.push(now)
    this.attempts.set(identifier, validAttempts)
    return true
  }
}

const limiter = new RateLimiter()

// Usage in login handler
function handleLogin(hash: string, ip: string): boolean {
  if (!limiter.isAllowed(ip)) {
    throw new Error('Too many attempts. Please try again later.')
  }
  
  return validateBookmark(hash)
}
```

### 2. Hash Validation

```typescript
function validateBookmarkSecurity(hash: string): ValidationResult {
  const cleaned = cleanHashInput(hash)
  
  // Format validation
  if (!/^\d{16}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid format' }
  }
  
  // Range validation
  const numericValue = BigInt(cleaned)
  const min = BigInt('1000000000000000')
  const max = BigInt('9999999999999999')
  
  if (numericValue < min || numericValue > max) {
    return { valid: false, error: 'Out of range' }
  }
  
  // Check against known compromised hashes (if any)
  if (isCompromised(cleaned)) {
    return { valid: false, error: 'Compromised hash' }
  }
  
  return { valid: true }
}
```

### 3. Secure Transmission

Always transmit bookmark hashes over HTTPS:

```typescript
// API endpoint for validation
app.post('/api/validate-bookmark', 
  requireHTTPS,
  rateLimiter,
  (req, res) => {
    const { bookmarkHash } = req.body
    
    // Never log the full hash
    const maskedHash = bookmarkHash.substring(0, 4) + '...'
    logger.info(`Bookmark validation attempt: ${maskedHash}`)
    
    const result = validateBookmarkSecurity(bookmarkHash)
    
    if (result.valid) {
      res.json({ success: true })
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid bookmark' 
      })
    }
  }
)
```

## Privacy Implementation

### 1. No Tracking

```typescript
// DO NOT implement any of these:
// ❌ User analytics tied to bookmark
// ❌ Bookmark correlation across sessions
// ❌ Activity logging with bookmark identifiers
// ❌ Behavioral profiling

// DO implement:
// ✅ Anonymous usage metrics
// ✅ Error logging without identifiers
// ✅ Performance monitoring without user correlation
```

### 2. Data Isolation

```typescript
class WorkspaceManager {
  private getWorkspaceKey(bookmarkHash: string, type: string): string {
    // Each bookmark gets isolated storage
    return `workspace_${bookmarkHash}_${type}`
  }
  
  saveWork(bookmarkHash: string, type: string, data: any): void {
    const key = this.getWorkspaceKey(bookmarkHash, type)
    localStorage.setItem(key, JSON.stringify(data))
  }
  
  loadWork(bookmarkHash: string, type: string): any {
    const key = this.getWorkspaceKey(bookmarkHash, type)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }
  
  clearWork(bookmarkHash: string): void {
    // Remove all data for a bookmark
    const prefix = `workspace_${bookmarkHash}_`
    Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .forEach(key => localStorage.removeItem(key))
  }
}
```

### 3. Collaboration Without Identity

```typescript
interface CollaborationSession {
  sharedHash: string
  participants: string[] // bookmark hashes only
  created: string
  expires: string
  data: any
}

function createCollaboration(ownerHash: string): CollaborationSession {
  return {
    sharedHash: generateBookmarkHash(), // New hash for collab
    participants: [ownerHash],
    created: new Date().toISOString(),
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString(), // 30 days
    data: {}
  }
}

function joinCollaboration(
  collabHash: string, 
  participantHash: string
): void {
  const session = getCollaborationSession(collabHash)
  if (session && !session.participants.includes(participantHash)) {
    session.participants.push(participantHash)
    saveCollaborationSession(session)
  }
}
```

## Migration from Traditional Auth

If migrating from username/password system:

```typescript
// One-time migration script
async function migrateToBookmarkAuth() {
  const users = await getUsersFromOldSystem()
  
  for (const user of users) {
    // Generate bookmark for existing user
    const bookmarkHash = generateBookmarkHash()
    
    // Send one-time email with bookmark
    await sendMigrationEmail(user.email, {
      subject: 'Important: Save Your New Access Code',
      bookmarkHash: formatHashForDisplay(bookmarkHash),
      message: 'We've upgraded to a privacy-first system. ' +
               'This is your only access code - save it now!'
    })
    
    // Map old user data to bookmark
    await mapUserDataToBookmark(user.id, bookmarkHash)
    
    // Schedule old data deletion
    await scheduleUserDataDeletion(user.id, '30_days')
  }
  
  // After migration, remove entire user table
  await dropUserTable()
}
```

## Testing

### Unit Tests

```typescript
describe('Bookmark Authentication', () => {
  describe('Generation', () => {
    it('generates 16-digit codes', () => {
      const hash = generateBookmarkHash()
      expect(hash).toMatch(/^\d{16}$/)
    })
    
    it('generates within valid range', () => {
      const hash = generateBookmarkHash()
      const value = BigInt(hash)
      expect(value).toBeGreaterThanOrEqual(BigInt('1000000000000000'))
      expect(value).toBeLessThanOrEqual(BigInt('9999999999999999'))
    })
    
    it('generates unique codes', () => {
      const hashes = new Set()
      for (let i = 0; i < 10000; i++) {
        hashes.add(generateBookmarkHash())
      }
      expect(hashes.size).toBe(10000)
    })
  })
  
  describe('Validation', () => {
    it('accepts valid format', () => {
      expect(isValidHash('1234567890123456')).toBe(true)
    })
    
    it('accepts formatted input', () => {
      expect(isValidHash('1234 5678 9012 3456')).toBe(true)
    })
    
    it('rejects invalid length', () => {
      expect(isValidHash('123456789012345')).toBe(false)
      expect(isValidHash('12345678901234567')).toBe(false)
    })
    
    it('rejects non-numeric', () => {
      expect(isValidHash('123456789012345a')).toBe(false)
    })
  })
})
```

### Security Tests

```typescript
describe('Security', () => {
  it('prevents brute force', async () => {
    const limiter = new RateLimiter()
    const ip = '192.168.1.1'
    
    // Should allow 5 attempts
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed(ip)).toBe(true)
    }
    
    // Should block 6th attempt
    expect(limiter.isAllowed(ip)).toBe(false)
  })
  
  it('uses cryptographically secure random', () => {
    // Mock crypto API
    const mockRandom = jest.spyOn(window.crypto, 'getRandomValues')
    generateBookmarkHash()
    expect(mockRandom).toHaveBeenCalled()
  })
  
  it('maintains entropy distribution', () => {
    const samples = 100000
    const buckets = new Map<number, number>()
    
    for (let i = 0; i < samples; i++) {
      const hash = generateBookmarkHash()
      const bucket = Math.floor(parseInt(hash.substring(0, 2)))
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
    }
    
    // Check for uniform distribution
    const expectedPerBucket = samples / 90 // 10-99 range
    for (const count of buckets.values()) {
      expect(count).toBeCloseTo(expectedPerBucket, -2)
    }
  })
})
```

## Monitoring

### Metrics to Track

```typescript
// Anonymous metrics only
interface SecurityMetrics {
  totalValidationAttempts: number
  failedValidations: number
  rateLimitTriggers: number
  averageSessionDuration: number
  // Never track: specific bookmarks, user patterns, correlation data
}

// Implementation
class MetricsCollector {
  private metrics: SecurityMetrics = {
    totalValidationAttempts: 0,
    failedValidations: 0,
    rateLimitTriggers: 0,
    averageSessionDuration: 0
  }
  
  recordValidation(success: boolean): void {
    this.metrics.totalValidationAttempts++
    if (!success) {
      this.metrics.failedValidations++
    }
  }
  
  recordRateLimit(): void {
    this.metrics.rateLimitTriggers++
  }
  
  getMetrics(): SecurityMetrics {
    return { ...this.metrics }
  }
}
```

## Production Checklist

- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting implemented (5 attempts per 15 minutes)
- [ ] Secure random generation verified
- [ ] No bookmark logging in production
- [ ] LocalStorage encryption for sensitive data
- [ ] Session timeout implemented (optional)
- [ ] No user tracking or analytics
- [ ] Data isolation between bookmarks verified
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Regular security audits scheduled

## References

- [Web Crypto API](https://www.w3.org/TR/WebCryptoAPI/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Mullvad's Implementation](https://github.com/mullvad/mullvadvpn-app)
- [LocalStorage Security](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

*Last Updated: December 2024*  
*Version: 1.0*