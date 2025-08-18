# Lessons Learned - Chat-Based Community Dashboard

This document captures key lessons learned during the development and debugging of the Chat-Based Community Dashboard project. These insights will help streamline future development and troubleshooting.

## Table of Contents
1. [Python Import Issues](#python-import-issues)
2. [Streamlit Development Best Practices](#streamlit-development-best-practices)
3. [Matrix Integration Challenges](#matrix-integration-challenges)
4. [Database and Session Management](#database-and-session-management)
5. [Error Handling and Debugging Strategies](#error-handling-and-debugging-strategies)
6. [Code Organization and Structure](#code-organization-and-structure)
7. [SSL/TLS and Network Issues](#ssltls-and-network-issues)
8. [Standard Operating Procedures](#standard-operating-procedures)
9. [Docker Build Issues](#docker-build-issues)
10. [JavaScript/TypeScript Strict Mode Issues](#javascripttypescript-strict-mode-issues)
11. [Hash-Based Authentication Implementation](#hash-based-authentication-implementation)
12. [Export Functionality and Browser Compatibility](#export-functionality-and-browser-compatibility)

---

## Python Import Issues

### ❌ What Didn't Work

**Problem**: `UnboundLocalError: local variable 'Config' referenced before assignment`

**Root Cause**: Having multiple `from app.utils.config import Config` statements within the same file - one at the top level and others inside functions. Python treats variables as local if they're assigned anywhere in the function scope, even if the assignment comes after the reference.

```python
# At top of file
from app.utils.config import Config

async def main_function():
    if not Config.MATRIX_ACTIVE:  # ❌ UnboundLocalError here
        return
    
    # ... later in the function or in helper functions
    def helper_function():
        from app.utils.config import Config  # ❌ This causes the error
        return Config.SOME_VALUE
```

### ✅ What Worked

**Solution**: Remove all redundant import statements within functions and rely on the top-level import.

```python
# At top of file
from app.utils.config import Config

async def main_function():
    if not Config.MATRIX_ACTIVE:  # ✅ Works correctly
        return
    
    def helper_function():
        # ✅ Use the top-level import, no local import needed
        return Config.SOME_VALUE
```

### 🔧 Standard Operating Procedure

1. **Always import modules at the top level** of the file
2. **Avoid redundant imports** within functions unless absolutely necessary
3. **Use grep to check for duplicate imports**: `grep -n "from.*import Config" filename.py`
4. **Test imports in isolation** when debugging import issues

---

## Streamlit Development Best Practices

### ❌ What Didn't Work

**Problem**: Modifying widget state after instantiation
```python
# ❌ This causes errors
st.session_state.confirm_user_removal = False  # After widget creation
```

**Problem**: Not handling session state persistence properly across reruns

### ✅ What Worked

**Solution**: Proper session state management
```python
# ✅ Initialize before widget creation
if 'confirm_user_removal' not in st.session_state:
    st.session_state.confirm_user_removal = False

# ✅ Use callbacks for state updates
def on_user_selection_change():
    st.session_state.selected_users = st.session_state.user_multiselect

st.multiselect("Users", options=users, on_change=on_user_selection_change, key="user_multiselect")
```

### 🔧 Standard Operating Procedure

1. **Initialize session state variables early** in the function
2. **Use unique keys** for all widgets to avoid conflicts
3. **Use callbacks** for complex state management instead of direct modification
4. **Test widget interactions** thoroughly, especially with multiple selections
5. **Cache expensive operations** using `@st.cache_data` or session state

---

## Matrix Integration Challenges

### ❌ What Didn't Work

**Problem**: Bot permission issues preventing user removal
- Bot had only Moderator privileges instead of Admin
- Removal operations failed with `M_FORBIDDEN` errors

**Problem**: Relying on stale local cache for room memberships

### ✅ What Worked

**Solution**: Multi-layered approach to user removal
1. **Live verification** of user memberships from Matrix API
2. **Smart filtering** to only attempt removal from rooms where users are actually members
3. **Enhanced error handling** with specific error messages
4. **Automatic cache refresh** after successful operations

```python
# ✅ Live verification approach
try:
    client = await get_matrix_client()
    all_bot_rooms = await get_joined_rooms_async(client)
    
    for room_id in all_bot_rooms:
        room_members = await get_room_members_async(client, room_id)
        if user_id in room_members:
            user_actual_room_ids.append(room_id)
except Exception as e:
    # Fallback to database cache
    logger.warning(f"Using database fallback: {e}")
```

### 🔧 Standard Operating Procedure

1. **Always verify bot permissions** before attempting administrative actions
2. **Use live API calls** for critical operations, with database cache as fallback
3. **Implement comprehensive error handling** with specific error types
4. **Log all Matrix operations** for audit trails
5. **Test with actual Matrix rooms** in development environment

---

## Database and Session Management

### ❌ What Didn't Work

**Problem**: Database session conflicts and unclosed connections
```python
# ❌ Session management issues
db = next(get_db())
# ... operations without proper cleanup
```

**Problem**: SQLite-specific function issues
```
sqlite3.OperationalError: no such function: string_agg
```

### ✅ What Worked

**Solution**: Proper session management with try/finally blocks
```python
# ✅ Proper session handling
db = next(get_db())
try:
    # Database operations
    result = db.query(Model).all()
    db.commit()
finally:
    db.close()
```

**Solution**: Database-agnostic queries or conditional SQL

### 🔧 Standard Operating Procedure

1. **Always use try/finally** for database session cleanup
2. **Test with both SQLite and PostgreSQL** if supporting multiple databases
3. **Use database-agnostic ORM methods** when possible
4. **Monitor for unclosed sessions** in logs
5. **Implement connection pooling** for production environments

---

## Error Handling and Debugging Strategies

### ❌ What Didn't Work

**Problem**: Silent failures without proper error reporting
**Problem**: Generic error messages that don't help with debugging
**Problem**: Not testing edge cases (empty user lists, network failures, etc.)

### ✅ What Worked

**Solution**: Comprehensive error handling strategy
```python
# ✅ Detailed error handling
try:
    result = await some_operation()
    if result:
        logger.info(f"Operation successful: {result}")
        return result
    else:
        logger.warning("Operation returned no result")
        return None
except SpecificException as e:
    logger.error(f"Specific error in operation: {e}")
    # Handle specific case
except Exception as e:
    logger.error(f"Unexpected error in operation: {e}", exc_info=True)
    # Handle general case
```

### 🔧 Standard Operating Procedure

1. **Create isolated test scripts** for debugging complex issues
2. **Use specific exception handling** rather than generic `except Exception`
3. **Log with appropriate levels** (DEBUG, INFO, WARNING, ERROR)
4. **Include context** in error messages (user IDs, room IDs, etc.)
5. **Test error conditions** explicitly (network failures, permission issues)
6. **Use `exc_info=True`** for detailed stack traces in logs

---

## Code Organization and Structure

### ❌ What Didn't Work

**Problem**: Massive functions with multiple responsibilities
**Problem**: Inconsistent indentation causing syntax errors
**Problem**: Mixing UI logic with business logic

### ✅ What Worked

**Solution**: Modular function design
```python
# ✅ Separate concerns
async def render_matrix_messaging_page():
    """Main UI rendering function"""
    if not _validate_matrix_config():
        return
    
    matrix_rooms = _get_cached_rooms()
    _render_room_selection_ui(matrix_rooms)
    _render_messaging_ui()

def _validate_matrix_config():
    """Helper function for validation"""
    return Config.MATRIX_ACTIVE

def _get_cached_rooms():
    """Helper function for data fetching"""
    # Implementation
```

### 🔧 Standard Operating Procedure

1. **Break large functions** into smaller, focused functions
2. **Use consistent indentation** (4 spaces for Python)
3. **Separate UI rendering** from business logic
4. **Use descriptive function names** that indicate purpose
5. **Add docstrings** for complex functions
6. **Use helper functions** with leading underscore for internal use

---

## SSL/TLS and Network Issues

### ❌ What Didn't Work

**Problem**: SSL version compatibility issues
```
[SSL: TLSV1_ALERT_PROTOCOL_VERSION] tlsv1 alert protocol version
```

**Problem**: Network timeouts without proper retry logic

### ✅ What Worked

**Solution**: Flexible SSL configuration
```python
# ✅ Configurable SSL settings
ssl_context = ssl.create_default_context()
if Config.MATRIX_DISABLE_SSL_VERIFICATION:
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
```

**Solution**: Retry logic with exponential backoff

### 🔧 Standard Operating Procedure

1. **Make SSL settings configurable** for different environments
2. **Implement retry logic** for network operations
3. **Use connection pooling** to reduce connection overhead
4. **Log network errors** with sufficient detail for debugging
5. **Test with different network conditions** (slow, unreliable connections)

---

## Standard Operating Procedures

### Development Workflow

1. **Before making changes:**
   - Test current functionality to establish baseline
   - Create isolated test scripts for complex features
   - Check for existing similar implementations

2. **During development:**
   - Make small, incremental changes
   - Test each change immediately
   - Use proper error handling from the start
   - Log important operations for debugging

3. **After making changes:**
   - Test the specific functionality changed
   - Test related functionality that might be affected
   - Check logs for any new errors or warnings
   - Verify imports and syntax with `python -m py_compile`

### Debugging Workflow

1. **Identify the problem:**
   - Check logs for specific error messages
   - Isolate the failing component
   - Create minimal reproduction case

2. **Investigate systematically:**
   - Check imports and dependencies
   - Verify configuration values
   - Test with simplified inputs
   - Use debugging scripts to isolate issues

3. **Fix and verify:**
   - Make targeted fixes
   - Test the fix in isolation
   - Test integration with the full system
   - Update documentation if needed

### Code Quality Checklist

- [ ] All imports are at the top level (no redundant imports in functions)
- [ ] Proper error handling with specific exception types
- [ ] Database sessions are properly closed
- [ ] Session state is managed correctly in Streamlit
- [ ] Functions are focused and have single responsibilities
- [ ] Network operations have retry logic and timeouts
- [ ] Logging is comprehensive and at appropriate levels
- [ ] Configuration is externalized and validated
- [ ] Tests cover both success and failure cases

### Testing Strategy

1. **Unit Testing:**
   - Test individual functions in isolation
   - Mock external dependencies (Matrix API, database)
   - Test error conditions explicitly

2. **Integration Testing:**
   - Test with real Matrix rooms and users
   - Test database operations with actual data
   - Test UI interactions in Streamlit

3. **Error Condition Testing:**
   - Network failures
   - Permission denied scenarios
   - Empty or invalid data
   - Concurrent access scenarios

---

## Key Takeaways

1. **Python import scoping** can cause subtle bugs - always import at module level
2. **Streamlit session state** requires careful management - use callbacks and proper initialization
3. **Matrix API operations** need live verification and comprehensive error handling
4. **Database sessions** must be properly managed to avoid connection leaks
5. **Error handling** should be specific and informative, not generic
6. **Code organization** matters - break large functions into focused, testable units
7. **Network operations** need retry logic and proper SSL configuration
8. **Testing** should cover both happy path and error conditions
9. **Logging** is crucial for debugging complex async operations
10. **Configuration** should be externalized and validated at startup

This document should be updated as new lessons are learned during continued development of the project. 

---

## Docker Build Issues

### ❌ What Didn't Work

**Problem**: Complex dependency resolution causing "resolution-too-deep" errors
```
error: resolution-too-deep
× Dependency resolution exceeded maximum depth
```

**Root Cause**: 
- Too many dependencies with complex version constraints
- Conflicting package requirements (especially with `streamlit-extras` and its dependencies)
- Python 3.9 compatibility issues with newer package versions

**Problem**: Long build times and timeouts during pip install
- Build process getting killed during dependency resolution
- Network timeouts with large package downloads

### ✅ What Worked

**Solution 1**: Split requirements into base and extra files
```dockerfile
# requirements-base.txt - Core dependencies only
streamlit>=1.45.1
pandas>=2.2.3
sqlalchemy>=2.0.41
# ... other essential packages

# requirements-extra.txt - Optional/problematic packages
streamlit-extras>=0.7.1
playwright>=1.52.0
# ... other optional packages
```

**Solution 2**: Multi-stage dependency installation
```dockerfile
# Install base requirements first
RUN pip install --no-cache-dir -r requirements-base.txt

# Try to install extra dependencies (allow failure)
RUN pip install --no-cache-dir -r requirements-extra.txt || true
```

**Solution 3**: Create .dockerignore to reduce build context
```
# .dockerignore
__pycache__/
*.py[cod]
.git/
.pytest_cache/
venv/
env/
*.log
.DS_Store
```

**Solution 4**: Optimize Dockerfile for better caching
```dockerfile
# Copy requirements first to leverage Docker cache
COPY requirements*.txt .
# Install dependencies before copying application code
RUN pip install ...
# Copy application code last
COPY . .
```

### 🔧 Standard Operating Procedure

1. **Keep dependencies minimal** in Docker images
   - Separate core from optional dependencies
   - Use version constraints carefully
   - Test with the target Python version

2. **Optimize Docker builds**
   - Use .dockerignore to exclude unnecessary files
   - Order Dockerfile commands for optimal caching
   - Copy requirements before application code

3. **Handle dependency conflicts**
   - Use `pip install --no-deps` for problematic packages
   - Allow non-critical installations to fail
   - Consider using pip-tools or poetry for better dependency management

4. **Debug build issues**
   - Build with `--no-cache` to ensure clean builds
   - Check pip version compatibility
   - Use `pip install -v` for verbose output during debugging

5. **Environment-specific considerations**
   - Set appropriate pip timeouts: `PIP_DEFAULT_TIMEOUT=100`
   - Disable pip cache in Docker: `PIP_NO_CACHE_DIR=1`
   - Use build-essential for packages that need compilation

### Key Takeaways for Docker Builds

1. **Simplify dependencies** - Not all packages need to be in the Docker image
2. **Use multi-stage builds** - Separate build dependencies from runtime
3. **Leverage caching** - Order Dockerfile commands strategically
4. **Handle failures gracefully** - Allow optional dependencies to fail
5. **Monitor build context size** - Use .dockerignore effectively
6. **Test locally first** - Ensure dependencies resolve before Docker build
7. **Document build issues** - Keep track of problematic packages and solutions 

---

## JavaScript/TypeScript Strict Mode Issues

### ❌ What Didn't Work

**Problem**: `'eval' and 'arguments' cannot be used as a binding identifier in strict mode`

**Root Cause**: Using `eval` as a parameter name or variable name in JavaScript/TypeScript strict mode. These are reserved words that cannot be used as identifiers.

```typescript
// ❌ This fails in strict mode
const evidenceEvaluations = [...]
evidenceEvaluations.map(eval => eval[question.id])

// ❌ This also fails
onEvaluationComplete={(eval) => updateEvidenceEvaluation(evidence.id, eval)}
```

**Error Messages**:
- `Parsing ecmascript source code failed`
- `'eval' and 'arguments' cannot be used as a binding identifier in strict mode`

### ✅ What Worked

**Solution**: Rename the parameter/variable to avoid reserved words like `eval`, `arguments`, etc.

```typescript
// ✅ Use descriptive names instead
const evidenceEvaluations = [...]
evidenceEvaluations.map(evaluation => evaluation[question.id])

// ✅ Use clear parameter names
onEvaluationComplete={(evaluation) => updateEvidenceEvaluation(evidence.id, evaluation)}
```

### Best Practices

1. **Avoid Reserved Words**: Never use `eval`, `arguments`, `with`, etc. as variable names
2. **Use Descriptive Names**: `evaluation` is clearer than `eval` anyway
3. **Check Strict Mode**: Most modern frameworks enable strict mode by default
4. **Search Codebase**: Use regex `\beval\b(?!uate)` to find problematic usage
5. **IDE/Linting**: Configure tools to catch these issues early

### How to Fix Systematically

1. **Search for problematic patterns**:
   ```bash
   grep -r "\beval\s*[=>]" src/
   grep -r "\barguments\s*[=>]" src/
   ```

2. **Replace with descriptive names**:
   - `eval` → `evaluation`, `item`, `element`
   - `arguments` → `args`, `params`, `options`

3. **Test the build** to ensure all issues are resolved

### Prevention

- Configure ESLint rules to catch reserved word usage
- Use TypeScript strict mode settings
- Regular code reviews to catch naming issues
- Document naming conventions in team guidelines

---

## Hash-Based Authentication Implementation

### ❌ What Didn't Work

**Problem**: Mock authentication tokens were not valid JWTs
```python
# ❌ This created invalid tokens that backend couldn't verify
const mockTokens: AuthTokens = {
  access_token: 'mock_access_token_' + Date.now(),
  refresh_token: 'mock_refresh_token_' + Date.now(),
  token_type: 'bearer',
  expires_in: 3600
}
```

**Root Cause**: Mock tokens weren't actual JWTs, so when sent to backend endpoints that require authentication, JWT verification failed with "Not enough segments" error.

**Problem**: Using wrong function signatures for token creation
```python
# ❌ These functions don't exist with these parameters
access_token = create_access_token(
    user_id=hash(request.account_hash),
    username=f"user_{request.account_hash[:8]}",
    scopes=["admin"]
)
```

### ✅ What Worked

**Solution 1**: Implement proper Mullvad-style hash authentication
```python
# ✅ Backend: Create real JWT tokens from hash authentication
from app.core.security import create_token_pair

tokens = create_token_pair(
    user_id=abs(hash(request.account_hash)) % 1000000,
    username=f"user_{request.account_hash[:8]}",
    scopes=["admin"] if account_info["role"] == UserRole.ADMIN else ["user"]
)
```

**Solution 2**: Use 16-digit decimal account hashes like Mullvad
```typescript
// ✅ Frontend: Generate proper 16-digit account hashes
export function generateAccountHash(): string {
  const min = 1000000000000000
  const max = 9999999999999999
  const accountNumber = randomInt(min, max + 1)
  return accountNumber.toString()
}
```

**Solution 3**: Frontend calls real backend auth endpoint
```typescript
// ✅ Use actual backend hash auth endpoint
const response = await this.client.post('/hash-auth/authenticate', {
  account_hash: hashCredentials.account_hash
})
```

### Key Learnings

1. **Privacy-First Design**: No usernames, emails, or passwords stored
2. **Cryptographic Security**: 16-digit numbers = ~9 quadrillion combinations
3. **Stateless Authentication**: Account hash is both username AND password
4. **Minimal Claims in JWT**: Only include necessary information for privacy
5. **Anti-Timing Attacks**: Add delays to prevent timing-based attacks

### Best Practices for Hash Authentication

1. **Generate cryptographically secure hashes**: Use `secrets` module in Python
2. **Format for readability**: Display as `1234 5678 9012 3456`
3. **Store minimal data**: Only hash, role, and timestamps
4. **Implement rate limiting**: Prevent brute force attempts
5. **Add timing attack protection**: Consistent response times

---

## Export Functionality and Browser Compatibility

### ❌ What Didn't Work

**Problem**: PowerPoint export failing with `pptx.writeFile()` 
```typescript
// ❌ writeFile() doesn't work in browsers
return await pptx.writeFile()
```

**Root Cause**: `writeFile()` is for Node.js environments, not browsers. Browser-based exports need to return data as ArrayBuffer or Blob.

**Problem**: API endpoint path inconsistencies
```typescript
// ❌ Different frameworks using different paths
'/frameworks/sessions'  // Some frameworks
'/frameworks/'          // Correct path
```

### ✅ What Worked

**Solution 1**: Use correct export methods for browser
```typescript
// ✅ PowerPoint: Use write() with arraybuffer output
return await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer

// ✅ Excel: toBuffer() returns ArrayBuffer
const buffer = await workbook.xlsx.writeBuffer()
return buffer

// ✅ Word: Packer.toBuffer() for browser
return await Packer.toBuffer(doc)

// ✅ PDF: Already returns ArrayBuffer
const buffer = doc.output('arraybuffer')
return buffer
```

**Solution 2**: Consistent file download function
```typescript
export function downloadFile(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)  // Clean up memory
}
```

**Solution 3**: Correct MIME types for each format
```typescript
const mimeTypes = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  json: 'application/json',
  csv: 'text/csv'
}
```

### Key Learnings

1. **Browser vs Node.js APIs**: Different methods for same libraries
2. **ArrayBuffer for binary data**: Standard format for browser file generation
3. **Blob and Object URLs**: Required for triggering downloads
4. **Memory cleanup**: Always revoke object URLs after use
5. **MIME type accuracy**: Important for proper file handling

### Export Best Practices

1. **Test in actual browser**: Not just Node.js tests
2. **Handle large files**: Consider streaming for big exports
3. **Progress indicators**: Show export progress for large datasets
4. **Error recovery**: Graceful handling of export failures
5. **Format validation**: Ensure exported files open correctly

### Common Export Library Patterns

```typescript
// Excel (exceljs)
const buffer = await workbook.xlsx.writeBuffer()

// Word (docx)
const buffer = await Packer.toBuffer(doc)

// PowerPoint (pptxgenjs)
const buffer = await pptx.write({ outputType: 'arraybuffer' })

// PDF (jspdf)
const buffer = doc.output('arraybuffer')

// All return ArrayBuffer for browser downloads
```

### Debugging Export Issues

1. **Check console errors**: Library-specific error messages
2. **Verify data structure**: Ensure data matches library expectations
3. **Test with minimal data**: Isolate formatting from data issues
4. **Check library docs**: Browser-specific sections often separate
5. **Memory limits**: Browser tabs have memory constraints

---

---

## Public Hosting & Demo Deployment

### ❌ What Didn't Work

**Problem**: Automatically creating public URLs without explicit user request
- Creates unnecessary public exposure
- Wastes resources when not needed
- May confuse users about deployment intent

### ✅ What Worked

**Solution**: Only create public tunnels when explicitly requested

```bash
# ✅ Only run when user specifically asks for public URL
cloudflared tunnel --url http://localhost:3380
```

**Best Practice**: Document the capability in README but don't auto-execute

### Key Learnings

1. **On-Demand Only**: Public hosting should be user-initiated, not automatic
2. **Clear Documentation**: Provide instructions for when users want to share
3. **Temporary Nature**: Emphasize these are temporary demo URLs
4. **Security Awareness**: Public URLs expose the application to the internet
5. **Resource Management**: Don't run tunnels unless actively needed

### When to Use Public Tunnels

- ✅ User explicitly requests feedback sharing
- ✅ Demo presentations to stakeholders  
- ✅ Cross-device testing
- ✅ Remote collaboration sessions
- ❌ NOT as default deployment strategy
- ❌ NOT without user understanding the implications

---

## Dark Mode Implementation Best Practices

### ❌ What Didn't Work

**Problem**: Text becoming invisible or unreadable in dark mode
```tsx
// ❌ Text disappears in dark mode
<div className="bg-white text-gray-900">
  <p className="text-gray-600">This text is invisible in dark mode!</p>
</div>
```

**Problem**: Using pure black/white causing eye strain
```tsx
// ❌ Harsh contrast
<div className="bg-black text-white">Too harsh!</div>
```

**Problem**: Low contrast failing WCAG accessibility standards
```tsx
// ❌ Poor contrast
<div className="dark:bg-gray-900 dark:text-gray-700">Hard to read</div>
```

### ✅ What Worked

**Solution 1**: Always include dark mode variants for text and backgrounds
```tsx
// ✅ Proper dark mode support
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <p className="text-gray-600 dark:text-gray-400">Visible in both modes!</p>
</div>
```

**Solution 2**: Use Tailwind's color palette for proper contrast
```tsx
// ✅ Good contrast ratios
<Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
  <CardHeader className="text-gray-900 dark:text-gray-100">
    <CardTitle>Readable Title</CardTitle>
  </CardHeader>
</Card>
```

**Solution 3**: Test with accessibility tools
```bash
# Use browser dev tools
# 1. Open DevTools > Rendering
# 2. Enable "Emulate CSS media feature prefers-color-scheme: dark"
# 3. Check contrast with Lighthouse or axe DevTools
```

### 🔧 Standard Operating Procedure

1. **For every text element**, add dark mode variant:
   - Light: text-gray-900, Dark: dark:text-gray-100
   - Light: text-gray-600, Dark: dark:text-gray-400

2. **For backgrounds**, use proper color pairs:
   - Light: bg-white, Dark: dark:bg-gray-900
   - Light: bg-gray-50, Dark: dark:bg-gray-800

3. **For borders**, ensure visibility:
   - Light: border-gray-200, Dark: dark:border-gray-700

4. **Test systematically**:
   - Toggle dark mode in browser
   - Check all text is visible
   - Verify contrast ratios
   - Test on different screens

### Key Learnings

1. **Never assume inheritance** - Always explicitly set dark mode classes
2. **Avoid pure colors** - Use gray-900 instead of black, gray-50 instead of white
3. **Test early and often** - Dark mode issues compound quickly
4. **Use CSS variables** for complex theming scenarios
5. **Consider user preference** - Respect system settings but allow manual override

### Common Patterns

```tsx
// Standard text hierarchy
<h1 className="text-gray-900 dark:text-gray-100">Heading</h1>
<h2 className="text-gray-800 dark:text-gray-200">Subheading</h2>
<p className="text-gray-600 dark:text-gray-400">Body text</p>
<span className="text-gray-500 dark:text-gray-500">Muted text</span>

// Cards and containers
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
  <div className="text-gray-900 dark:text-gray-100">Content</div>
</div>

// Interactive elements
<button className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600">
  Button
</button>

// Input fields
<input className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" />
```

---

## Summary of New Learnings

### Hash Authentication
- Implement privacy-first authentication without personal data
- Use cryptographically secure random numbers for account hashes
- Create real JWT tokens, not mock strings
- Add anti-timing attack protections
- Format hashes for human readability (space-separated groups)

### Export Functionality
- Use browser-compatible methods (ArrayBuffer, not file system)
- Different libraries have different browser methods
- Always clean up object URLs to prevent memory leaks
- Use correct MIME types for each file format
- Test exports in actual browser environment, not just tests

### Public Hosting
- Only create public URLs when explicitly requested by user
- Document capabilities but don't auto-execute
- Emphasize temporary nature and security implications
- Use for demos, feedback, and collaboration - not default deployment

These lessons have been crucial for building a professional, privacy-focused research platform with government-standard export capabilities.