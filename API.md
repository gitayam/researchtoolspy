# API Documentation

## Overview

The Research Tool API is built on **Cloudflare Pages Functions**, providing a serverless backend that scales automatically. The API is served from the `/api` path of the application.

## Base URL

- **Development**: `http://localhost:8788/api` (default Wrangler port)
- **Production**: `https://<your-domain>/api`

## Authentication

The API primarily uses **Hash-Based Authentication** (Mullvad-style) for privacy and ease of use. 

### Flow
1.  **Register**: POST `/api/hash-auth/register` to receive a 16-digit account hash.
2.  **Login**: POST `/api/hash-auth/authenticate` with the hash to receive a standard JWT Bearer token.
3.  **Access**: Use `Authorization: Bearer <token>` for all subsequent requests.

```http
Authorization: Bearer <your_jwt_token>
```

### Endpoints (`/api/hash-auth`)
- **POST** `/api/hash-auth/register`: Generate a new anonymous account.
- **POST** `/api/hash-auth/authenticate`: Exchange your 16-digit hash for a session token.

### Authentication Helpers (`functions/api/_shared/auth-helpers.ts`)
- `getUserFromRequest`: Extracts user ID from the JWT token.
- `requireAuth`: Throws a 401 error if the user is not authenticated.

## Known Issues / Inconsistencies

- **Legacy Headers**: Some endpoints (like `functions/api/settings/user.ts`) might still check for `X-User-Hash`. These should be refactored to use the standard `getUserFromRequest` helper.

## Error Handling

Standard error responses follow this JSON structure:

```json
{
  "error": "Error message description",
  "details": "Optional detailed info"
}
```

## Key Modules

### Authentication (`/api/auth`)
- **POST** `/api/auth/login`: Authenticate a user.
- **POST** `/api/auth/register`: Create a new account.
- **GET** `/api/auth/me`: Get current user details.

### User Settings (`/api/settings`)
- **GET** `/api/settings/user`: Retrieve user settings. Requires `X-User-Hash` header or `?hash=` query param.
- **PUT** `/api/settings/user`: Update user settings. Requires `X-User-Hash` header or `?hash=` query param.
- **DELETE** `/api/settings/user`: Reset settings to defaults.

### Content Intelligence (`/api/content-intelligence`)
Tools for analyzing and extracting data from URLs and content.
- **POST** `/api/content-intelligence/analyze-url`: Extract content from a URL.
- **POST** `/api/content-intelligence/summarize-entity`: Generate summaries.

### Research (`/api/research`)
Core research workflow endpoints.
- **POST** `/api/research/generate-question`: Generate research questions using AI.
- **POST** `/api/research/submit`: Submit research findings.

### Evidence (`/api/evidence`)
Management of evidence items.
- **GET** `/api/evidence`: List evidence.
- **POST** `/api/evidence`: Create new evidence.

### Frameworks (`/api/frameworks`)
Support for analytical frameworks like SWOT, PMESII-PT, etc.
- **GET** `/api/frameworks`: List available frameworks.
- **POST** `/api/frameworks/[id]/populate`: Auto-populate a framework.

## Development

The API is defined in the `functions/api` directory. Each file corresponds to a route.
- `functions/api/health.ts` -> `/api/health`
- `functions/api/users/[id].ts` -> `/api/users/:id`

To run the API locally:
```bash
npm run dev
# or
npx wrangler pages dev --port 8788 -- vite
```
