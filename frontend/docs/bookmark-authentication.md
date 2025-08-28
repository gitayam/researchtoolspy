# Bookmark-Based Authentication System

## Overview

ResearchTools uses a privacy-first, hash-based bookmark system inspired by [Mullvad VPN's numbered account approach](https://mullvad.net/en/blog/mullvads-account-numbers-get-longer-and-safer). Instead of traditional usernames and passwords, users receive a 16-digit bookmark code that serves as their unique identifier for accessing saved work and enabling collaboration.

This documentation explains the technical architecture, security benefits, and usage guidelines for our bookmark authentication system.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Technical Architecture](#technical-architecture)
3. [Security Analysis](#security-analysis)
4. [Privacy Benefits](#privacy-benefits)
5. [Usage Guidelines](#usage-guidelines)
6. [Comparison with Traditional Authentication](#comparison-with-traditional-authentication)
7. [Implementation Details](#implementation-details)
8. [FAQ](#faq)

## Core Principles

### What It Is
- **A bookmark code**: A randomly generated 16-digit number that allows you to return to your work
- **A collaboration key**: Share your code with teammates to collaborate on analyses
- **A privacy tool**: No personal information is ever collected or stored
- **A session identifier**: Links your browser sessions to saved analysis work

### What It Is NOT
- **Not an account**: There is no user profile, email, or personal data attached
- **Not a person identifier**: The code represents access to work, not a person
- **Not recoverable**: Lost codes cannot be recovered - there is no "forgot password" option
- **Not linkable**: Multiple codes cannot be connected to identify a single user

## Technical Architecture

### Code Generation

Our system generates 16-digit decimal numbers in the format: `1234 5678 9012 3456`

```javascript
// Range: 1000 0000 0000 0000 to 9999 9999 9999 9999
// Total possible combinations: 9 × 10^15 (9 quadrillion)
// Entropy: ~53.1 bits
```

### Security Features

1. **Cryptographically Secure Random Generation**
   - Uses `window.crypto.getRandomValues()` in browsers
   - Falls back to secure random generation on server-side
   - Ensures uniform distribution across the entire keyspace

2. **Format and Display**
   - Displayed as 4 groups of 4 digits for readability
   - Accepts input with or without spaces
   - Case-insensitive for user convenience

3. **Storage Architecture**
   - Bookmark codes stored only in browser localStorage
   - No server-side user database
   - Work data associated with hash, not with personal identity

## Security Analysis

### Entropy and Keyspace

| Metric | Value |
|--------|-------|
| Total Combinations | 9 × 10^15 |
| Entropy | ~53.1 bits |
| Average Guesses (if 100k active) | 45 billion |
| Probability of Random Hit | < 0.000001% |

### Why It's Safer Than Username/Password

1. **No Weak Passwords**
   - Users cannot choose weak, predictable passwords
   - Eliminates password reuse across services
   - No dictionary attack vulnerabilities

2. **No Personal Information Leakage**
   - Usernames often reveal personal information (name, birth year, interests)
   - Email addresses link to other online identities
   - Our codes are completely anonymous identifiers

3. **Immune to Common Attacks**
   - **No phishing**: Nothing personal to phish for
   - **No credential stuffing**: Codes aren't reused from other services
   - **No social engineering**: No recovery process to exploit
   - **No password spraying**: Random distribution prevents pattern attacks

4. **Mathematical Security**
   - With 53.1 bits of entropy, brute force is impractical
   - Rate limiting makes automated attacks infeasible
   - No correlation between codes prevents pattern analysis

### Comparison with Mullvad's System

Our implementation follows [Mullvad's proven approach](https://mullvad.net/en/help/no-logging-data-policy):

| Feature | Mullvad VPN | ResearchTools |
|---------|-------------|---------------|
| Code Length | 16 digits | 16 digits |
| Format | Decimal (0-9) | Decimal (0-9) |
| Personal Info Required | None | None |
| Email Required | No | No |
| Recovery Options | None* | None |
| Entropy | ~53 bits | ~53 bits |

*Mullvad offers limited payment-based recovery within 20 days

## Privacy Benefits

### Complete Anonymity

1. **No User Tracking**
   - No cookies for tracking across sessions
   - No analytics tied to user identity
   - No behavioral profiling possible

2. **No Data Correlation**
   - Multiple bookmark codes cannot be linked
   - Work sessions remain isolated
   - No cross-reference with external services

3. **Legal Compliance**
   - No PII (Personally Identifiable Information) collected
   - GDPR-compliant by design
   - No data to breach or leak

### Collaboration Without Compromise

- Share work without sharing identity
- Temporary collaboration through code sharing
- Revocable access (generate new code anytime)
- No audit trail linking to individuals

## Usage Guidelines

### Getting Started

1. **Generate Your Bookmark Code**
   ```
   Visit: /register
   Click: "Get Bookmark"
   Your code: 1234 5678 9012 3456 (example)
   ```

2. **Save Your Code Securely**
   - **CRITICAL**: Save immediately in a password manager
   - Treat it like a Bitcoin private key
   - No recovery possible if lost

3. **Access Your Work**
   ```
   Visit: /login
   Enter: Your 16-digit code
   Click: "Access Work"
   ```

### Best Practices

#### DO ✅
- **Use a Password Manager**: Store your code in Bitwarden, 1Password, KeePass, etc.
- **Create Multiple Codes**: Use different codes for different projects
- **Share Selectively**: Only share codes with trusted collaborators
- **Regenerate Periodically**: Create new codes for enhanced privacy

#### DON'T ❌
- **Write on Paper**: Physical notes can be lost or stolen
- **Share Publicly**: Never post codes in public forums
- **Use Browser Autofill**: Avoid saving in browser password managers
- **Expect Recovery**: There is NO way to recover a lost code

### Password Manager Setup

We recommend storing your bookmark code in a password manager:

**Bitwarden Example:**
```
Name: ResearchTools Analysis Bookmark
Username: [leave blank]
Password: 1234 5678 9012 3456
URL: https://your-domain.com/login
Notes: Analysis work bookmark - NO RECOVERY IF LOST
```

**1Password Example:**
```
Title: ResearchTools Bookmark
Type: Secure Note
Code: 1234 5678 9012 3456
Tags: bookmark, research, no-recovery
```

## Comparison with Traditional Authentication

### Traditional Username/Password

**Weaknesses:**
- Users choose weak passwords (123456, password, etc.)
- Password reuse across services
- Personal information in usernames
- Complex recovery processes create vulnerabilities
- Database breaches expose credentials
- Phishing and social engineering attacks

**Required Infrastructure:**
- User database with encrypted passwords
- Email verification system
- Password reset functionality
- Session management
- Account recovery support

### Our Bookmark System

**Strengths:**
- Cryptographically random codes
- No personal information collected
- No recovery process to exploit
- No password to forget or reuse
- Database breach reveals nothing personal
- Phishing attempts yield no useful data

**Minimal Infrastructure:**
- Simple hash validation
- LocalStorage for client-side persistence
- No email system needed
- No support tickets for password resets
- No compliance burden for PII

## Implementation Details

### Client-Side Code Generation

```typescript
// Generate a 16-digit bookmark code
export function generateBookmarkHash(): string {
  const min = 1000000000000000  // 10^15
  const max = 9999999999999999  // 10^16 - 1
  
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment - use Web Crypto API
    const array = new Uint32Array(2)
    window.crypto.getRandomValues(array)
    const randomValue = (array[0] * 0x100000000 + array[1]) % (max - min)
    return (min + Math.abs(randomValue)).toString()
  } else {
    // Server environment - use secure random
    const crypto = require('crypto')
    const range = max - min
    const randomBytes = crypto.randomBytes(8)
    const randomValue = randomBytes.readBigUInt64BE() % BigInt(range)
    return (BigInt(min) + randomValue).toString()
  }
}
```

### Validation

```typescript
// Validate bookmark code format
export function isValidBookmark(code: string): boolean {
  const cleaned = code.replace(/[\s-]/g, '')
  return /^\d{16}$/.test(cleaned) && 
         parseInt(cleaned) >= 1000000000000000
}
```

### Storage Model

```javascript
// Browser LocalStorage
localStorage.setItem('bookmark_code', '1234567890123456')
localStorage.setItem('work_data', JSON.stringify(analysisData))

// No server-side user table
// Work is saved with hash reference only
```

## FAQ

### Q: What if I lose my bookmark code?

**A:** Your code cannot be recovered. This is by design - there is no support team that can help, no email recovery, and no backup system. Always save your code in a password manager immediately after generation.

### Q: Can someone guess my code?

**A:** Mathematically impractical. With 9 quadrillion possible combinations and rate limiting, an attacker would need billions of attempts. The probability of randomly guessing an active code is less than 0.000001%.

### Q: Why not use email/password like everyone else?

**A:** Email addresses and usernames leak personal information and create privacy risks. Our system follows the principle: "Your work is not your identity." This approach provides better privacy and security than traditional authentication.

### Q: Can I have multiple bookmark codes?

**A:** Yes! Generate as many codes as you need. Use different codes for different projects or share specific codes with different teams. Each code is independent.

### Q: Is this GDPR compliant?

**A:** Yes. We collect no personal data, so there's nothing to request, delete, or port under GDPR. The system is private by design, not by policy.

### Q: What inspired this approach?

**A:** [Mullvad VPN's numbered accounts](https://mullvad.net/en/help/faq) pioneered this privacy-first approach. They've successfully operated since 2009 without collecting email addresses or personal information.

## References

- [Mullvad's Account Numbers Get Longer and Safer](https://mullvad.net/en/blog/mullvads-account-numbers-get-longer-and-safer)
- [Mullvad's No-Logging Policy](https://mullvad.net/en/help/no-logging-data-policy)
- [Password Entropy and Security (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Web Crypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

## Security Disclosure

If you discover a security vulnerability in our bookmark authentication system, please report it to security@[domain]. We take security seriously and will respond promptly to valid reports.

---

*Last Updated: December 2024*  
*Version: 1.0*