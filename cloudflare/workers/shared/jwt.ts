/**
 * JWT utilities for Cloudflare Workers
 * Using Web Crypto API for token signing and verification
 */

import { JWTPayload } from './types';

/**
 * Create a JWT token
 */
export async function createJWT(
  payload: JWTPayload,
  secret: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(), // JWT ID for revocation
  };

  // Encode header and payload
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign the message
  const signature = await sign(message, secret);

  return `${message}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const isValid = await verify(message, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64urlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Create refresh token
 */
export async function createRefreshToken(
  userId: string,
  secret: string
): Promise<string> {
  const payload: JWTPayload = {
    sub: userId,
    type: 'refresh',
    jti: crypto.randomUUID(),
  } as JWTPayload;

  // Refresh tokens expire in 7 days
  return createJWT(payload, secret, 7 * 24 * 3600);
}

/**
 * Sign a message using HMAC-SHA256
 */
async function sign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  return base64urlEncode(signature);
}

/**
 * Verify a signature using HMAC-SHA256
 */
async function verify(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBuffer = base64urlDecode(signature, true);

  return crypto.subtle.verify(
    'HMAC',
    key,
    signatureBuffer,
    encoder.encode(message)
  );
}

/**
 * Base64url encode
 */
function base64urlEncode(input: string | ArrayBuffer): string {
  let base64: string;

  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    const binary = String.fromCharCode(...bytes);
    base64 = btoa(binary);
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decode
 */
function base64urlDecode(input: string, asBuffer: boolean = false): any {
  // Add padding if needed
  const padding = '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + padding;

  const binary = atob(base64);

  if (asBuffer) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  return binary;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string, salt?: string): Promise<{
  hash: string;
  salt: string;
}> {
  const encoder = new TextEncoder();

  // Generate salt if not provided
  const saltBytes = salt
    ? encoder.encode(salt)
    : crypto.getRandomValues(new Uint8Array(16));

  const saltString = salt || Array.from(new Uint8Array(saltBytes), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');

  // Import password as key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive bits
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hashHex,
    salt: saltString,
  };
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string
): Promise<boolean> {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

/**
 * Generate a short-lived token for email verification, password reset, etc.
 */
export async function generateVerificationToken(
  purpose: string,
  data: any,
  secret: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const payload = {
    purpose,
    data,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const token = base64urlEncode(JSON.stringify(payload));
  const signature = await sign(token, secret);

  return `${token}.${signature}`;
}

/**
 * Verify a verification token
 */
export async function verifyVerificationToken(
  token: string,
  purpose: string,
  secret: string
): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, signature] = parts;

    // Verify signature
    const isValid = await verify(encodedPayload, signature, secret);
    if (!isValid) {
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(base64urlDecode(encodedPayload));

    // Check purpose
    if (payload.purpose !== purpose) {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload.data;
  } catch (error) {
    console.error('Verification token error:', error);
    return null;
  }
}