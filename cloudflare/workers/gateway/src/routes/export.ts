/**
 * Export service routes handler
 */

import { Env, AuthRequest } from '../../../shared/types';
import { createErrorResponse } from '../middleware/errorHandler';

export async function exportRouter(
  request: AuthRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse(501, 'Export service not yet implemented', 'NOT_IMPLEMENTED');
}