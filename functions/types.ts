/** Shared bindings used by legacy Pages Functions that import `functions/types`. */
export interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
  OIDC_CLIENT_ID?: string
  OIDC_CLIENT_SECRET?: string
  OIDC_ISSUER?: string
  OIDC_AUTHORIZATION_URL?: string
  OIDC_TOKEN_URL?: string
  OIDC_USERINFO_URL?: string
}
