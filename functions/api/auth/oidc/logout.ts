/**
 * POST /api/auth/oidc/logout
 *
 * Returns the Authentik end_session_endpoint URL so the frontend can
 * redirect the user to complete the SSO logout.
 */

import type { Env } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const origin = new URL(request.url).origin
  const endSessionUrl = (env as any).OIDC_END_SESSION_URL || 'https://sso.irregularchat.com/application/o/researchtools/end-session/'

  return Response.json(
    {
      end_session_url: endSessionUrl,
      post_logout_redirect_uri: origin,
    },
    { headers: JSON_HEADERS }
  )
}

/** OPTIONS /api/auth/oidc/logout -- CORS preflight */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
