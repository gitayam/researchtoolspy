import { generateToken } from '../../utils/jwt' // We'll need to ensure this exists or mock it

import { z } from 'zod'
import { generateToken } from '../../utils/jwt'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const LoginSchema = z.object({
  account_hash: z.string().regex(/^\d{16}$/, 'Invalid hash format. Must be 16 digits.')
})

/**
 * POST /api/hash-auth/authenticate
 * Login with a 16-digit account hash
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context
    
    let body;
    try {
      body = await request.json()
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = LoginSchema.safeParse(body)

    if (!result.success) {
      return Response.json(
        { error: 'Validation failed', details: result.error.errors },
        { status: 400 }
      )
    }

    const { account_hash } = result.data

    // Check DB
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE user_hash = ?'
    ).bind(account_hash).first() as { id: number, full_name: string, role: string, user_hash: string } | null

    if (!user) {
      return Response.json(
        { error: 'Account not found. Please register a new account.' },
        { status: 401 }
      )
    }

    // Generate JWT using shared utility
    const token = await generateToken({
      sub: user.id,
      name: user.full_name,
      role: user.role
    }, env.JWT_SECRET || 'dev-secret-key')

    return Response.json({
      access_token: token,
      refresh_token: 'refresh_' + crypto.randomUUID(), // Placeholder
      token_type: 'bearer',
      expires_in: 3600,
      account_hash: user.user_hash,
      role: user.role
    })

  } catch (error) {
    console.error('Hash Auth Error:', error)
    return Response.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
