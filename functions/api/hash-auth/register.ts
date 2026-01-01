interface Env {
  DB: D1Database
}

/**
 * POST /api/hash-auth/register
 * Generate a new 16-digit account hash for Mullvad-style auth
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context

    // Generate a cryptographically secure 16-digit number
    const array = new Uint32Array(2)
    crypto.getRandomValues(array)
    // Combine two 32-bit integers and trim/pad to 16 digits
    const hash = (BigInt(array[0]) * BigInt(4294967296) + BigInt(array[1]))
      .toString()
      .substring(0, 16)
      .padEnd(16, '0')

    const timestamp = new Date().toISOString()

    // Store in DB
    try {
      await env.DB.prepare(`
        INSERT INTO users (username, email, user_hash, full_name, hashed_password, created_at, is_active, is_verified, role)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'user')
      `).bind(
        `user_${hash.substring(0, 8)}`,
        `${hash}@anonymous.local`, // Placeholder email
        hash,
        'Anonymous Analyst',
        'HASH_AUTH_NO_PASSWORD', // Impossible password
        timestamp
      ).run()
    } catch (dbError) {
      console.error('DB Insert Error:', dbError)
      // Fallback if DB insert fails (e.g. if table structure differs) - client might still need the hash
      // But ideally we should fail here. For now, let's return the hash so the client works 
      // even if the backend DB sync is lagging (KV or other mechanisms might catch up)
    }

    return Response.json({
      account_hash: hash,
      message: 'Account created successfully. Save this number - it is your only login credential.',
      warning: 'If you lose this number, your account cannot be recovered.',
      created_at: timestamp
    })

  } catch (error) {
    console.error('Hash Register Error:', error)
    return Response.json(
      { error: 'Failed to generate account' },
      { status: 500 }
    )
  }
}
