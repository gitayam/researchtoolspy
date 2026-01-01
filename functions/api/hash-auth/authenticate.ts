import { generateToken } from '../../utils/jwt' // We'll need to ensure this exists or mock it

import { z } from 'zod'

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
    ).bind(account_hash).first()

    if (!user) {
      return Response.json(
        { error: 'Account not found. Please register a new account.' },
        { status: 401 }
      )
    }

    // Generate JWT (Simulated if util doesn't exist, but we should create it)
    // Ideally use a library like jose or jsonwebtoken, but in Workers we might use web crypto or pure JS
    // For now, let's create a basic JWT structure manually if no lib is imported
    // But better to use a proper helper.
    
    // We'll defer to a helper we'll create next
    const token = await generateJwt(user, env.JWT_SECRET || 'dev-secret-key')

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

// Basic JWT generation for Cloudflare Workers (Web Crypto API)
async function generateJwt(user: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: user.id,
    name: user.full_name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  }

  const encodedHeader = btoa(JSON.stringify(header))
  const encodedPayload = btoa(JSON.stringify(payload))
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signatureInput)
  )
  
  // Convert signature to base64url
  const signatureArray = Array.from(new Uint8Array(signature))
  const encodedSignature = btoa(String.fromCharCode.apply(null, signatureArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return `${signatureInput}.${encodedSignature}`
}
