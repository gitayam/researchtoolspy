/**
 * Server-side re-export of the shared BCW canon.
 *
 * The single source of truth lives at src/lib/bcw-canon.ts. Pages Functions
 * resolve this relative import at bundle time, and deploy.sh rsyncs the
 * shared file into dist/src/lib/ so it is available at runtime.
 *
 * If you need to update the BCW canon (e.g., add a new BCT, fix a definition),
 * edit src/lib/bcw-canon.ts. This file just re-exports.
 */

export * from '../../../../src/lib/bcw-canon'
