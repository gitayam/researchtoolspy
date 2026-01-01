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

## Security Model

All API endpoints are protected and require a valid Bearer token. The backend supports two types of Bearer tokens:
1.  **JWT Tokens**: Issued by `/api/hash-auth/authenticate`. (Recommended)
2.  **Raw Account Hashes**: For backward compatibility and simplified CLI access.

## Error Handling

Standard error responses follow this JSON structure:

```json
{
  "error": "Error message description",
  "details": "Optional detailed info"
}
```

## Key Modules

### Authentication (`/api/hash-auth`)
- **POST** `/api/hash-auth/register`: Create a new account and get a 16-digit hash.
- **POST** `/api/hash-auth/authenticate`: Exchange hash for JWT.

### User Settings (`/api/settings`)
- **GET** `/api/settings/user`: Retrieve user settings.
- **PUT** `/api/settings/user`: Update user settings.
- **DELETE** `/api/settings/user`: Reset settings to defaults.

### Workspaces (`/api/workspaces` and `/api/settings/workspaces`)
- **GET** `/api/workspaces`: List user's workspaces.
- **POST** `/api/workspaces`: Create a new workspace.
- **GET** `/api/settings/workspaces`: Manage workspace settings.

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
