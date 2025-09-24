/**
 * AI service routes handler
 */

import { Env, AuthRequest } from '../../../shared/types';
import { createErrorResponse } from '../middleware/errorHandler';

export async function aiRouter(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'AI service not yet implemented', 'NOT_IMPLEMENTED');
}