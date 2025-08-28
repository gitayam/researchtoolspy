#!/usr/bin/env node

const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = 9876;
const HOST = '0.0.0.0';

// Simple in-memory storage for demo
const users = new Map();
const hashes = new Set();

// Generate a Mullvad-style 16-digit account hash
function generateAccountHash() {
  // Generate a 16-digit number (like Mullvad)
  // Split into two parts to avoid JavaScript number precision issues
  const part1 = Math.floor(Math.random() * 9000000) + 1000000; // 7 digits
  const part2 = Math.floor(Math.random() * 900000000) + 100000000; // 9 digits
  
  // Combine to get 16 digits
  const accountNumber = part1.toString() + part2.toString();
  return accountNumber;
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Access-Control-Allow-Credentials', true);
}

// Parse JSON from request
function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Mock API server
const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  try {
    // Hash registration endpoint
    if ((path === '/api/v1/auth/hash/register' || path === '/api/v1/hash-auth/register') && method === 'POST') {
      const accountHash = generateAccountHash();
      hashes.add(accountHash);
      
      const response = {
        account_hash: accountHash,
        message: 'Hash registered successfully. Save this hash - it cannot be recovered if lost.',
        warning: 'This hash is your only way to access your account. Store it securely.',
        created_at: new Date().toISOString()
      };
      
      console.log('✅ Generated hash:', accountHash.substring(0, 8) + '...');
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // Hash authentication endpoint  
    if ((path === '/api/v1/auth/hash/authenticate' || path === '/api/v1/hash-auth/authenticate') && method === 'POST') {
      const body = await parseJSON(req);
      const { account_hash } = body;
      
      if (!account_hash) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Account hash is required' }));
        return;
      }

      if (!hashes.has(account_hash)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Invalid account hash' }));
        return;
      }

      // Create mock JWT tokens
      const accessToken = Buffer.from(JSON.stringify({
        sub: account_hash,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
        iat: Math.floor(Date.now() / 1000)
      })).toString('base64');

      const refreshToken = Buffer.from(JSON.stringify({
        sub: account_hash,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
        iat: Math.floor(Date.now() / 1000)
      })).toString('base64');

      const response = {
        access_token: `mock.${accessToken}`,
        refresh_token: `mock.${refreshToken}`,
        token_type: 'bearer',
        expires_in: 3600,
        account_hash: account_hash,
        role: 'user'
      };

      console.log('✅ Hash authenticated:', account_hash.substring(0, 8) + '...');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // Get current user endpoint
    if (path === '/api/v1/auth/users/me' && method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Authorization header required' }));
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token.startsWith('mock.')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Invalid token' }));
        return;
      }

      try {
        const payload = JSON.parse(Buffer.from(token.substring(5), 'base64').toString());
        const user = {
          id: 1,
          username: `user_${payload.sub.substring(0, 8)}`,
          email: null,
          is_active: true,
          role: 'user',
          account_hash: payload.sub,
          created_at: new Date().toISOString()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(user));
        return;
      } catch (e) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Invalid token format' }));
        return;
      }
    }

    // Health check endpoint
    if (path === '/api/v1/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        message: 'Mock API server is running',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // 404 for all other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Not found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Internal server error' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Mock API server running on http://${HOST}:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  POST /api/v1/auth/hash/register - Generate new account hash');
  console.log('  POST /api/v1/auth/hash/authenticate - Authenticate with hash');
  console.log('  GET  /api/v1/auth/users/me - Get current user info');
  console.log('  GET  /api/v1/health - Health check');
  console.log('');
  console.log('🌐 Frontend should be running on http://localhost:6780');
  console.log('✨ Ready to test the consolidated authentication system!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock API server...');
  server.close(() => {
    console.log('✅ Mock API server stopped');
    process.exit(0);
  });
});