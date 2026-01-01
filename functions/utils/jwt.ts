/**
 * JWT Utilities for Cloudflare Workers
 * Uses Web Crypto API for performance and compatibility
 */

export interface JWTPayload {
  sub: string | number
  name?: string
  role?: string
  iat?: number
  exp?: number
  [key: string]: any
}

/**
 * Generate a JWT token
 */
export async function generateToken(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  
  const fullPayload: JWTPayload = {
    iat: now,
    exp: now + (24 * 60 * 60), // Default 24 hours
    ...payload
  }

  const encodedHeader = b64url(JSON.stringify(header))
  const encodedPayload = b64url(JSON.stringify(fullPayload))
  
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
  
  const encodedSignature = b64urlFromBuffer(signature)

  return `${signatureInput}.${encodedSignature}`
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, signatureB64] = parts
  const signatureInput = `${headerB64}.${payloadB64}`

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signature = b64urlToBuffer(signatureB64)
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(signatureInput)
    )

    if (!isValid) return null

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null
    }

    return payload
  } catch (e) {
    console.error('[JWT] Verification failed:', e)
    return null
  }
}

// Helper: base64url encoding
function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Helper: base64url from ArrayBuffer
function b64urlFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Helper: base64url to ArrayBuffer
function b64urlToBuffer(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
