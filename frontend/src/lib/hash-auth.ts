/**
 * Hash Authentication Utilities
 * Implements Mullvad-style 16-digit hash authentication
 */

/**
 * Validates if a hash is in the correct format
 * Accepts both 16-digit numbers and 32-character hex (for migration)
 * @param hash - The hash to validate
 * @returns true if valid, false otherwise
 */
export function isValidHash(hash: string): boolean {
  if (!hash) return false
  
  const cleaned = cleanHashInput(hash)
  
  // Check for 16-digit format (Mullvad-style)
  if (/^\d{16}$/.test(cleaned)) {
    return true
  }
  
  // Check for 32-character hex format (legacy)
  if (/^[0-9a-f]{32}$/.test(cleaned)) {
    return true
  }
  
  return false
}

/**
 * Cleans hash input by removing spaces, hyphens, and converting to lowercase
 * @param hash - The raw hash input
 * @returns Cleaned hash string
 */
export function cleanHashInput(hash: string): string {
  if (!hash) return ''
  
  // Remove all spaces, hyphens, and convert to lowercase
  return hash.replace(/[\s-]/g, '').toLowerCase()
}

/**
 * Formats a hash for display with groups of 4 digits
 * @param hash - The hash to format
 * @returns Formatted hash string (e.g., "1234 5678 9012 3456")
 */
export function formatHashForDisplay(hash: string): string {
  if (!hash) return ''
  
  const cleaned = cleanHashInput(hash)
  
  // For 16-digit hashes, format as 4 groups of 4
  if (/^\d{16}$/.test(cleaned)) {
    return cleaned.replace(/(\d{4})/g, '$1 ').trim()
  }
  
  // For 32-character hex, format as 8 groups of 4
  if (/^[0-9a-f]{32}$/.test(cleaned)) {
    return cleaned.replace(/([0-9a-f]{4})/g, '$1 ').trim()
  }
  
  // Return as-is if not a recognized format
  return hash
}

/**
 * Generates a new random 16-digit hash
 * @returns A new 16-digit hash string
 */
export function generateHash(): string {
  let hash = ''
  for (let i = 0; i < 16; i++) {
    hash += Math.floor(Math.random() * 10).toString()
  }
  return hash
}

/**
 * Masks a hash for security display (shows first 4 and last 4 digits)
 * @param hash - The hash to mask
 * @returns Masked hash string (e.g., "1234 **** **** 3456")
 */
export function maskHash(hash: string): string {
  if (!hash) return ''
  
  const cleaned = cleanHashInput(hash)
  
  if (cleaned.length < 8) {
    return '****'
  }
  
  const first4 = cleaned.slice(0, 4)
  const last4 = cleaned.slice(-4)
  
  return `${first4} **** **** ${last4}`
}