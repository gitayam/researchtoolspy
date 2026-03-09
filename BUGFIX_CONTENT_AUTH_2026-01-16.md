# Fix Report: Content Intelligence Authorization

## Issue
Users were experiencing a 403 Unauthorized error when attempting to run Claims Analysis on analyzed content.
`[Claims] API error: {error: "Unauthorized"}`

## Root Cause
1. The `analyze-url` endpoint, which creates the content analysis record, respects the `Authorization` header to assign ownership (`user_id`).
2. If no header is provided (which was the case in the frontend), it defaults to `user_id = 1`.
3. The `claims/analyze` endpoint strictly checks ownership against the requesting user.
4. When `claims/analyze` is called, it correctly sends the `Authorization` header (e.g., matching `user_id = 123`).
5. `user_id (1) !== user_id (123)`, resulting in 403 Unauthorized.

## Fix
Updated `src/pages/tools/ContentIntelligencePage.tsx` to include the `Authorization` header (Bearer token with `omnicore_user_hash`) in all relevant API calls:
- `handleAnalyze` (`/api/content-intelligence/analyze-url`) - **Primary Fix**
- `handleQuickSave` (`/api/content-intelligence/analyze-url`)
- `runDIMEAnalysis` (`/api/content-intelligence/dime-analyze`)
- `handleCreateACH` (`/api/content-intelligence/save`)
- `loadSavedLinks` (`/api/content-intelligence/saved-links`)

This ensures that content analysis records are created with the correct user ownership, allowing subsequent operations (like Claims Analysis) to verify ownership successfully.
