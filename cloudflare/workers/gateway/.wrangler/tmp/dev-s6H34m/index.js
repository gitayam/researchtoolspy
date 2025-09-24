var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-eX4cAX/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-eX4cAX/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// ../node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "../node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// ../shared/jwt.ts
async function createJWT(payload, secret, expiresIn = 3600) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID()
    // JWT ID for revocation
  };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(message, secret);
  return `${message}.${signature}`;
}
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;
    const isValid = await verify(message, signature, secret);
    if (!isValid) {
      return null;
    }
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
async function createRefreshToken(userId, secret) {
  const payload = {
    sub: userId,
    type: "refresh",
    jti: crypto.randomUUID()
  };
  return createJWT(payload, secret, 7 * 24 * 3600);
}
async function sign(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return base64urlEncode(signature);
}
async function verify(message, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureBuffer = base64urlDecode(signature, true);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    encoder.encode(message)
  );
}
function base64urlEncode(input) {
  let base64;
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    const binary = String.fromCharCode(...bytes);
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64urlDecode(input, asBuffer = false) {
  const padding = "=".repeat((4 - input.length % 4) % 4);
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + padding;
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
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const saltBytes = salt ? encoder.encode(salt) : crypto.getRandomValues(new Uint8Array(16));
  const saltString = salt || Array.from(
    new Uint8Array(saltBytes),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 1e5,
      hash: "SHA-256"
    },
    key,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return {
    hash: hashHex,
    salt: saltString
  };
}
async function verifyPassword(password, hash, salt) {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}
var init_jwt = __esm({
  "../shared/jwt.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    __name(createJWT, "createJWT");
    __name(verifyJWT, "verifyJWT");
    __name(createRefreshToken, "createRefreshToken");
    __name(sign, "sign");
    __name(verify, "verify");
    __name(base64urlEncode, "base64urlEncode");
    __name(base64urlDecode, "base64urlDecode");
    __name(hashPassword, "hashPassword");
    __name(verifyPassword, "verifyPassword");
  }
});

// ../shared/types.ts
var APIError, ValidationError;
var init_types = __esm({
  "../shared/types.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    APIError = class extends Error {
      constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "APIError";
      }
      static {
        __name(this, "APIError");
      }
    };
    ValidationError = class extends APIError {
      constructor(message, fields) {
        super(400, message, "VALIDATION_ERROR");
        this.fields = fields;
        this.name = "ValidationError";
      }
      static {
        __name(this, "ValidationError");
      }
    };
  }
});

// ../shared/database.ts
function createDatabase(env) {
  return new Database(env.DB);
}
var Database;
var init_database = __esm({
  "../shared/database.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_types();
    Database = class {
      static {
        __name(this, "Database");
      }
      constructor(db) {
        this.db = db;
      }
      /**
       * Execute a prepared statement with parameters
       */
      async execute(sql, params = []) {
        try {
          const stmt = this.db.prepare(sql);
          if (params.length > 0) {
            return await stmt.bind(...params).all();
          }
          return await stmt.all();
        } catch (error) {
          console.error("Database execute error:", error);
          throw new APIError(500, "Database operation failed");
        }
      }
      /**
       * Execute a single row query
       */
      async findOne(sql, params = []) {
        try {
          const stmt = this.db.prepare(sql);
          if (params.length > 0) {
            return await stmt.bind(...params).first();
          }
          return await stmt.first();
        } catch (error) {
          console.error("Database findOne error:", error);
          throw new APIError(500, "Database operation failed");
        }
      }
      /**
       * Execute multiple queries in a transaction
       */
      async transaction(queries) {
        try {
          const statements = queries.map(({ sql, params = [] }) => {
            const stmt = this.db.prepare(sql);
            return params.length > 0 ? stmt.bind(...params) : stmt;
          });
          return await this.db.batch(statements);
        } catch (error) {
          console.error("Database transaction error:", error);
          throw new APIError(500, "Transaction failed");
        }
      }
      /**
       * Insert a record and return the inserted ID
       */
      async insert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => "?").join(", ");
        const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
        try {
          const result = await this.db.prepare(sql).bind(...values).run();
          return result.meta.last_row_id;
        } catch (error) {
          console.error("Database insert error:", error);
          throw new APIError(500, "Insert operation failed");
        }
      }
      /**
       * Update records in a table
       */
      async update(table, data, where) {
        const setClause = Object.keys(data).map((key) => `${key} = ?`).join(", ");
        const whereClause = Object.keys(where).map((key) => `${key} = ?`).join(" AND ");
        const sql = `UPDATE ${table} SET ${setClause}, updated_at = datetime('now') WHERE ${whereClause}`;
        const params = [...Object.values(data), ...Object.values(where)];
        try {
          const result = await this.db.prepare(sql).bind(...params).run();
          return result.meta.changes;
        } catch (error) {
          console.error("Database update error:", error);
          throw new APIError(500, "Update operation failed");
        }
      }
      /**
       * Delete records from a table
       */
      async delete(table, where) {
        const whereClause = Object.keys(where).map((key) => `${key} = ?`).join(" AND ");
        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        const params = Object.values(where);
        try {
          const result = await this.db.prepare(sql).bind(...params).run();
          return result.meta.changes;
        } catch (error) {
          console.error("Database delete error:", error);
          throw new APIError(500, "Delete operation failed");
        }
      }
      /**
       * Build and execute a SELECT query with options
       */
      async find(table, options = {}) {
        let sql = `SELECT * FROM ${table}`;
        const params = [];
        if (options.where && Object.keys(options.where).length > 0) {
          const whereConditions = Object.keys(options.where).map((key) => {
            params.push(options.where[key]);
            return `${key} = ?`;
          }).join(" AND ");
          sql += ` WHERE ${whereConditions}`;
        }
        if (options.orderBy) {
          sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.direction.toUpperCase()}`;
        }
        if (options.limit) {
          sql += ` LIMIT ${options.limit}`;
        }
        if (options.offset) {
          sql += ` OFFSET ${options.offset}`;
        }
        try {
          const result = await this.execute(sql, params);
          return result.results;
        } catch (error) {
          console.error("Database find error:", error);
          throw new APIError(500, "Query operation failed");
        }
      }
      /**
       * Count records in a table
       */
      async count(table, where) {
        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        const params = [];
        if (where && Object.keys(where).length > 0) {
          const whereConditions = Object.keys(where).map((key) => {
            params.push(where[key]);
            return `${key} = ?`;
          }).join(" AND ");
          sql += ` WHERE ${whereConditions}`;
        }
        const result = await this.findOne(sql, params);
        return result?.count || 0;
      }
      /**
       * Check if a record exists
       */
      async exists(table, where) {
        const count = await this.count(table, where);
        return count > 0;
      }
      /**
       * Paginate query results
       */
      async paginate(table, page = 1, pageSize = 20, options = {}) {
        const offset = (page - 1) * pageSize;
        const items = await this.find(table, {
          ...options,
          limit: pageSize,
          offset
        });
        const total = await this.count(table, options.where);
        const totalPages = Math.ceil(total / pageSize);
        return {
          items,
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        };
      }
    };
    __name(createDatabase, "createDatabase");
  }
});

// src/middleware/auth.ts
async function authMiddleware(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      const anonymousSession = await checkAnonymousSession(request, env);
      if (anonymousSession) {
        request.user = anonymousSession;
        return request;
      }
      return createAuthErrorResponse("No authorization token provided");
    }
    const tokenMatch = authHeader.match(/^Bearer (.+)$/i);
    if (!tokenMatch) {
      return createAuthErrorResponse("Invalid authorization format");
    }
    const token = tokenMatch[1];
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return createAuthErrorResponse("Invalid or expired token");
    }
    const isBlacklisted = await isTokenBlacklisted(token, env);
    if (isBlacklisted) {
      return createAuthErrorResponse("Token has been revoked");
    }
    const db = createDatabase(env);
    const user = await db.findOne(
      "SELECT * FROM users WHERE id = ? AND is_active = 1",
      [payload.sub]
    );
    if (!user) {
      return createAuthErrorResponse("User not found or inactive");
    }
    request.user = user;
    request.session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token,
      expiresAt: payload.exp * 1e3,
      createdAt: payload.iat * 1e3
    };
    await updateSessionActivity(token, env);
    return request;
  } catch (error) {
    console.error("Auth middleware error:", error);
    return createAuthErrorResponse("Authentication failed");
  }
}
async function checkAnonymousSession(request, env) {
  try {
    const sessionHash = request.headers.get("X-Anonymous-Session");
    if (!sessionHash) return null;
    if (!/^[a-zA-Z0-9]{16}$/.test(sessionHash)) return null;
    const sessionData = await env.ANONYMOUS_SESSIONS.get(sessionHash);
    if (!sessionData) return null;
    const session = JSON.parse(sessionData);
    const expiryTime = 24 * 60 * 60 * 1e3;
    if (Date.now() - session.createdAt > expiryTime) {
      await env.ANONYMOUS_SESSIONS.delete(sessionHash);
      return null;
    }
    session.lastAccessedAt = Date.now();
    await env.ANONYMOUS_SESSIONS.put(
      sessionHash,
      JSON.stringify(session),
      { expirationTtl: 86400 }
      // 24 hours
    );
    return {
      id: 0,
      username: `anonymous_${sessionHash.substring(0, 8)}`,
      email: `${sessionHash}@anonymous.local`,
      full_name: "Anonymous User",
      account_hash: sessionHash,
      is_active: true,
      is_verified: false,
      role: "viewer",
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Anonymous session check error:", error);
    return null;
  }
}
async function isTokenBlacklisted(token, env) {
  try {
    const blacklistKey = `blacklist:${token}`;
    const isBlacklisted = await env.SESSIONS.get(blacklistKey);
    return isBlacklisted !== null;
  } catch (error) {
    console.error("Token blacklist check error:", error);
    return false;
  }
}
async function updateSessionActivity(token, env) {
  try {
    const sessionKey = `session:${token}`;
    const sessionData = await env.SESSIONS.get(sessionKey);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastActivity = Date.now();
      await env.SESSIONS.put(
        sessionKey,
        JSON.stringify(session),
        { expirationTtl: 86400 }
      );
    }
  } catch (error) {
    console.error("Session activity update error:", error);
  }
}
function createAuthErrorResponse(message) {
  return new Response(
    JSON.stringify({
      error: "Authentication Error",
      message,
      code: "AUTH_REQUIRED"
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="ResearchToolsPy API"'
      }
    }
  );
}
function requireRole(user, requiredRoles) {
  if (!user) {
    return createAuthErrorResponse("Authentication required");
  }
  if (!requiredRoles.includes(user.role)) {
    return new Response(
      JSON.stringify({
        error: "Authorization Error",
        message: "Insufficient permissions for this operation",
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRoles,
        userRole: user.role
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
  return null;
}
var init_auth = __esm({
  "src/middleware/auth.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_jwt();
    init_database();
    __name(authMiddleware, "authMiddleware");
    __name(checkAnonymousSession, "checkAnonymousSession");
    __name(isTokenBlacklisted, "isTokenBlacklisted");
    __name(updateSessionActivity, "updateSessionActivity");
    __name(createAuthErrorResponse, "createAuthErrorResponse");
    __name(requireRole, "requireRole");
  }
});

// src/middleware/errorHandler.ts
function errorHandler(error, requestId) {
  console.error("Error:", {
    name: error.name,
    message: error.message,
    stack: error.stack,
    requestId
  });
  if (error instanceof APIError) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
      requestId,
      status: error.status
    };
  }
  if (error instanceof ValidationError) {
    return {
      error: "Validation Error",
      message: error.message,
      code: "VALIDATION_FAILED",
      details: error.fields,
      requestId,
      status: 400
    };
  }
  if (error instanceof SyntaxError) {
    return {
      error: "Invalid Request",
      message: "Invalid JSON in request body",
      code: "INVALID_JSON",
      requestId,
      status: 400
    };
  }
  if (error instanceof TypeError) {
    return {
      error: "Type Error",
      message: "Invalid data type in request",
      code: "TYPE_ERROR",
      requestId,
      status: 400
    };
  }
  if (error.message?.includes("D1_ERROR")) {
    return {
      error: "Database Error",
      message: "A database error occurred",
      code: "DATABASE_ERROR",
      requestId,
      status: 500
    };
  }
  if (error.message?.includes("KV namespace")) {
    return {
      error: "Cache Error",
      message: "A caching error occurred",
      code: "CACHE_ERROR",
      requestId,
      status: 500
    };
  }
  if (error.message?.includes("R2")) {
    return {
      error: "Storage Error",
      message: "A storage error occurred",
      code: "STORAGE_ERROR",
      requestId,
      status: 500
    };
  }
  return {
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    code: "INTERNAL_ERROR",
    requestId,
    status: 500
  };
}
function createErrorResponse(status, message, code, details, requestId) {
  const errorBody = {
    error: getErrorName(status),
    message,
    code: code || getErrorCode(status),
    requestId,
    details
  };
  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...requestId ? { "X-Request-ID": requestId } : {}
    }
  });
}
function getErrorName(status) {
  const errorNames = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout"
  };
  return errorNames[status] || "Error";
}
function getErrorCode(status) {
  const errorCodes = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT"
  };
  return errorCodes[status] || "UNKNOWN_ERROR";
}
function validateRequestBody(body, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];
    const fieldErrors = [];
    if (rules.required && (value === void 0 || value === null || value === "")) {
      fieldErrors.push(`${field} is required`);
    }
    if (value !== void 0 && value !== null && rules.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== rules.type) {
        fieldErrors.push(`${field} must be of type ${rules.type}`);
      }
    }
    if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
      fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
    }
    if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
      fieldErrors.push(`${field} must be at most ${rules.maxLength} characters`);
    }
    if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
      fieldErrors.push(`${field} has invalid format`);
    }
    if (rules.validate && typeof rules.validate === "function") {
      const customError = rules.validate(value);
      if (customError) {
        fieldErrors.push(customError);
      }
    }
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }
  if (Object.keys(errors).length > 0) {
    return new ValidationError("Validation failed", errors);
  }
  return null;
}
var init_errorHandler = __esm({
  "src/middleware/errorHandler.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_types();
    __name(errorHandler, "errorHandler");
    __name(createErrorResponse, "createErrorResponse");
    __name(getErrorName, "getErrorName");
    __name(getErrorCode, "getErrorCode");
    __name(validateRequestBody, "validateRequestBody");
  }
});

// src/routes/auth.ts
var auth_exports = {};
__export(auth_exports, {
  authRouter: () => authRouter
});
async function authRouter(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  switch (true) {
    case (path === "/api/v1/auth/login" && request.method === "POST"):
      return handleLogin(request, env);
    case (path === "/api/v1/auth/register" && request.method === "POST"):
      return handleRegister(request, env);
    case (path === "/api/v1/auth/refresh" && request.method === "POST"):
      return handleRefreshToken(request, env);
    case (path === "/api/v1/auth/logout" && request.method === "POST"):
      return handleLogout(request, env);
    case (path === "/api/v1/auth/anonymous" && request.method === "POST"):
      return handleAnonymousSession(request, env);
    case (path === "/api/v1/auth/verify-email" && request.method === "POST"):
      return handleEmailVerification(request, env);
    case (path === "/api/v1/auth/forgot-password" && request.method === "POST"):
      return handleForgotPassword(request, env);
    case (path === "/api/v1/auth/reset-password" && request.method === "POST"):
      return handleResetPassword(request, env);
    case (path === "/api/v1/auth/me" && request.method === "GET"):
      return handleGetCurrentUser(request, env);
    case (path === "/api/v1/auth/me" && request.method === "PATCH"):
      return handleUpdateCurrentUser(request, env);
    default:
      return createErrorResponse(404, "Auth endpoint not found", "AUTH_ENDPOINT_NOT_FOUND");
  }
}
async function handleLogin(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body", "INVALID_JSON");
    }
    const validation = validateRequestBody(body, {
      email: { required: true, type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      password: { required: true, type: "string", minLength: 6 }
    });
    if (validation) {
      return createErrorResponse(400, "Validation failed", "VALIDATION_ERROR", validation.fields);
    }
    const { email, password } = body;
    const db = createDatabase(env);
    const user = await db.findOne(
      "SELECT * FROM users WHERE email = ?",
      [email.toLowerCase()]
    );
    if (!user) {
      await logAuthAttempt(null, email, false, request, env, "User not found");
      return createErrorResponse(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    const [hash, salt] = user.hashed_password.split(":");
    const isValidPassword = await verifyPassword(password, hash, salt);
    if (!isValidPassword) {
      await logAuthAttempt(user.id, email, false, request, env, "Invalid password");
      return createErrorResponse(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    if (!user.is_active) {
      await logAuthAttempt(user.id, email, false, request, env, "User inactive");
      return createErrorResponse(403, "Account is inactive", "ACCOUNT_INACTIVE");
    }
    const accessToken = await createJWT(
      {
        sub: user.id.toString(),
        email: user.email,
        username: user.username,
        role: user.role
      },
      env.JWT_SECRET,
      3600
      // 1 hour
    );
    const refreshToken = await createRefreshToken(user.id.toString(), env.JWT_SECRET);
    const sessionData = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
      // 24 hours
    );
    await logAuthAttempt(user.id, email, true, request, env);
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_verified: user.is_verified,
          organization: user.organization,
          department: user.department
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: "Bearer"
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    return createErrorResponse(500, "Login failed", "LOGIN_ERROR");
  }
}
async function handleRegister(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body", "INVALID_JSON");
    }
    const validation = validateRequestBody(body, {
      email: { required: true, type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      username: { required: true, type: "string", minLength: 3, maxLength: 50 },
      password: { required: true, type: "string", minLength: 8 },
      full_name: { required: true, type: "string", minLength: 2 }
    });
    if (validation) {
      return createErrorResponse(400, "Validation failed", "VALIDATION_ERROR", validation.fields);
    }
    const { email, username, password, full_name, organization, department } = body;
    const db = createDatabase(env);
    const existingEmail = await db.exists("users", { email: email.toLowerCase() });
    if (existingEmail) {
      return createErrorResponse(409, "Email already registered", "EMAIL_EXISTS");
    }
    const existingUsername = await db.exists("users", { username: username.toLowerCase() });
    if (existingUsername) {
      return createErrorResponse(409, "Username already taken", "USERNAME_EXISTS");
    }
    const { hash, salt } = await hashPassword(password);
    const hashedPassword = `${hash}:${salt}`;
    const accountHash = generateAccountHash();
    const userId = await db.insert("users", {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      full_name,
      hashed_password: hashedPassword,
      account_hash: accountHash,
      is_active: 1,
      is_verified: 0,
      role: "researcher",
      organization,
      department
    });
    const accessToken = await createJWT(
      {
        sub: userId.toString(),
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        role: "researcher"
      },
      env.JWT_SECRET,
      3600
    );
    const refreshToken = await createRefreshToken(userId.toString(), env.JWT_SECRET);
    const sessionData = {
      userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      role: "researcher",
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
    );
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          full_name,
          role: "researcher",
          is_verified: false,
          account_hash: accountHash
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          token_type: "Bearer"
        }
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return createErrorResponse(500, "Registration failed", "REGISTRATION_ERROR");
  }
}
async function handleRefreshToken(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body", "INVALID_JSON");
    }
    const { refresh_token } = body;
    if (!refresh_token) {
      return createErrorResponse(400, "Refresh token required", "REFRESH_TOKEN_REQUIRED");
    }
    const payload = await verifyJWT(refresh_token, env.JWT_SECRET);
    if (!payload || payload.type !== "refresh") {
      return createErrorResponse(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }
    const db = createDatabase(env);
    const user = await db.findOne(
      "SELECT * FROM users WHERE id = ? AND is_active = 1",
      [payload.sub]
    );
    if (!user) {
      return createErrorResponse(401, "User not found or inactive", "USER_NOT_FOUND");
    }
    const accessToken = await createJWT(
      {
        sub: user.id.toString(),
        email: user.email,
        username: user.username,
        role: user.role
      },
      env.JWT_SECRET,
      3600
    );
    const sessionData = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    await env.SESSIONS.put(
      `session:${accessToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
    );
    return new Response(
      JSON.stringify({
        success: true,
        tokens: {
          access_token: accessToken,
          refresh_token,
          expires_in: 3600,
          token_type: "Bearer"
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Token refresh error:", error);
    return createErrorResponse(500, "Token refresh failed", "TOKEN_REFRESH_ERROR");
  }
}
async function handleLogout(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    await env.SESSIONS.put(
      `blacklist:${token}`,
      "1",
      { expirationTtl: 86400 }
      // Keep blacklisted for 24 hours
    );
    await env.SESSIONS.delete(`session:${token}`);
    return new Response(
      JSON.stringify({ success: true, message: "Logged out successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return createErrorResponse(500, "Logout failed", "LOGOUT_ERROR");
  }
}
async function handleAnonymousSession(request, env) {
  try {
    const sessionHash = generateAccountHash();
    const sessionData = {
      sessionHash,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      data: {}
    };
    await env.ANONYMOUS_SESSIONS.put(
      sessionHash,
      JSON.stringify(sessionData),
      { expirationTtl: 86400 }
      // 24 hours
    );
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          hash: sessionHash,
          expires_in: 86400
        }
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Anonymous session error:", error);
    return createErrorResponse(500, "Failed to create anonymous session", "ANONYMOUS_SESSION_ERROR");
  }
}
async function handleEmailVerification(request, env) {
  return createErrorResponse(501, "Email verification not implemented", "NOT_IMPLEMENTED");
}
async function handleForgotPassword(request, env) {
  return createErrorResponse(501, "Forgot password not implemented", "NOT_IMPLEMENTED");
}
async function handleResetPassword(request, env) {
  return createErrorResponse(501, "Reset password not implemented", "NOT_IMPLEMENTED");
}
async function handleGetCurrentUser(request, env) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: request.user.id,
        username: request.user.username,
        email: request.user.email,
        full_name: request.user.full_name,
        role: request.user.role,
        is_verified: request.user.is_verified,
        organization: request.user.organization,
        department: request.user.department,
        bio: request.user.bio,
        created_at: request.user.created_at
      }
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
async function handleUpdateCurrentUser(request, env) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(400, "Invalid JSON body", "INVALID_JSON");
    }
    const db = createDatabase(env);
    const updates = {};
    const allowedFields = ["full_name", "bio", "organization", "department", "preferences"];
    for (const field of allowedFields) {
      if (body[field] !== void 0) {
        updates[field] = field === "preferences" ? JSON.stringify(body[field]) : body[field];
      }
    }
    if (Object.keys(updates).length === 0) {
      return createErrorResponse(400, "No valid fields to update", "NO_UPDATES");
    }
    await db.update("users", updates, { id: request.user.id });
    const updatedUser = await db.findOne(
      "SELECT * FROM users WHERE id = ?",
      [request.user.id]
    );
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          full_name: updatedUser.full_name,
          role: updatedUser.role,
          is_verified: updatedUser.is_verified,
          organization: updatedUser.organization,
          department: updatedUser.department,
          bio: updatedUser.bio
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Update user error:", error);
    return createErrorResponse(500, "Failed to update user", "UPDATE_USER_ERROR");
  }
}
function generateAccountHash() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let hash = "";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    hash += chars[array[i] % chars.length];
  }
  return hash;
}
async function logAuthAttempt(userId, email, success, request, env, errorMessage) {
  try {
    const db = createDatabase(env);
    await db.insert("auth_logs", {
      user_id: userId,
      account_hash: email,
      success: success ? 1 : 0,
      ip_address: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || null,
      user_agent: request.headers.get("User-Agent"),
      error_message: errorMessage,
      login_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("Failed to log auth attempt:", error);
  }
}
var init_auth2 = __esm({
  "src/routes/auth.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_database();
    init_jwt();
    init_errorHandler();
    __name(authRouter, "authRouter");
    __name(handleLogin, "handleLogin");
    __name(handleRegister, "handleRegister");
    __name(handleRefreshToken, "handleRefreshToken");
    __name(handleLogout, "handleLogout");
    __name(handleAnonymousSession, "handleAnonymousSession");
    __name(handleEmailVerification, "handleEmailVerification");
    __name(handleForgotPassword, "handleForgotPassword");
    __name(handleResetPassword, "handleResetPassword");
    __name(handleGetCurrentUser, "handleGetCurrentUser");
    __name(handleUpdateCurrentUser, "handleUpdateCurrentUser");
    __name(generateAccountHash, "generateAccountHash");
    __name(logAuthAttempt, "logAuthAttempt");
  }
});

// ../frameworks/swot/src/ai.ts
async function generateAISuggestions(swotData, env) {
  if (!env.OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured");
    return null;
  }
  try {
    const prompt = constructSuggestionsPrompt(swotData);
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);
    if (!response) {
      return null;
    }
    return parseSuggestionsResponse(response);
  } catch (error) {
    console.error("AI suggestions error:", error);
    return null;
  }
}
async function validateWithAI(swotData, env) {
  if (!env.OPENAI_API_KEY) {
    return performBasicValidation(swotData);
  }
  try {
    const prompt = constructValidationPrompt(swotData);
    const response = await callOpenAI(prompt, env.OPENAI_API_KEY);
    if (!response) {
      return performBasicValidation(swotData);
    }
    return parseValidationResponse(response);
  } catch (error) {
    console.error("AI validation error:", error);
    return performBasicValidation(swotData);
  }
}
function constructSuggestionsPrompt(swotData) {
  return `You are a strategic business analyst expert in SWOT analysis. Analyze the following SWOT framework and provide additional suggestions:

Objective: ${swotData.objective}
Context: ${swotData.context || "Not specified"}

Current Analysis:
STRENGTHS:
${swotData.strengths.map((s) => `- ${s}`).join("\n") || "- None specified"}

WEAKNESSES:
${swotData.weaknesses.map((w) => `- ${w}`).join("\n") || "- None specified"}

OPPORTUNITIES:
${swotData.opportunities.map((o) => `- ${o}`).join("\n") || "- None specified"}

THREATS:
${swotData.threats.map((t) => `- ${t}`).join("\n") || "- None specified"}

Please provide:
1. 3-5 additional strengths that haven't been identified
2. 3-5 additional weaknesses to consider
3. 3-5 additional opportunities to explore
4. 3-5 additional threats to monitor
5. 2-3 key strategic insights based on the analysis
6. 2-3 actionable recommendations

Respond in JSON format:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "threats": ["..."],
  "insights": ["..."],
  "recommendations": ["..."],
  "confidence": 0.0-1.0
}`;
}
function constructValidationPrompt(swotData) {
  return `You are a strategic analysis expert. Validate the following SWOT analysis for completeness, consistency, and quality:

Objective: ${swotData.objective}
Context: ${swotData.context || "Not specified"}

STRENGTHS (${swotData.strengths.length} items):
${swotData.strengths.map((s) => `- ${s}`).join("\n") || "- None"}

WEAKNESSES (${swotData.weaknesses.length} items):
${swotData.weaknesses.map((w) => `- ${w}`).join("\n") || "- None"}

OPPORTUNITIES (${swotData.opportunities.length} items):
${swotData.opportunities.map((o) => `- ${o}`).join("\n") || "- None"}

THREATS (${swotData.threats.length} items):
${swotData.threats.map((t) => `- ${t}`).join("\n") || "- None"}

Evaluate and provide:
1. Completeness score (0-100): Are all key areas covered?
2. Consistency score (0-100): Are items properly categorized and non-contradictory?
3. Quality score (0-100): Are items specific, actionable, and relevant?
4. List any issues found (missing areas, vague items, contradictions, duplicates)
5. Suggestions for improvement

Respond in JSON format:
{
  "is_valid": boolean,
  "completeness_score": 0-100,
  "consistency_score": 0-100,
  "quality_score": 0-100,
  "issues": [
    {
      "category": "strengths|weaknesses|opportunities|threats",
      "issue_type": "missing|vague|contradictory|duplicate",
      "description": "...",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["..."]
}`;
}
async function callOpenAI(prompt, apiKey) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a strategic business analyst expert in SWOT analysis. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1e3,
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) {
      console.error("OpenAI API error:", response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("OpenAI API call error:", error);
    return null;
  }
}
function parseSuggestionsResponse(response) {
  try {
    const parsed = JSON.parse(response);
    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      opportunities: parsed.opportunities || [],
      threats: parsed.threats || [],
      insights: parsed.insights || [],
      recommendations: parsed.recommendations || [],
      confidence: parsed.confidence || 0.8,
      generated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to parse AI suggestions:", error);
    return {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
      insights: [],
      recommendations: [],
      confidence: 0,
      generated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function parseValidationResponse(response) {
  try {
    const parsed = JSON.parse(response);
    return {
      is_valid: parsed.is_valid ?? true,
      completeness_score: parsed.completeness_score || 0,
      consistency_score: parsed.consistency_score || 0,
      quality_score: parsed.quality_score || 0,
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || []
    };
  } catch (error) {
    console.error("Failed to parse AI validation:", error);
    return performBasicValidation({ strengths: [], weaknesses: [], opportunities: [], threats: [] });
  }
}
function performBasicValidation(swotData) {
  const issues = [];
  const suggestions = [];
  const totalItems = swotData.strengths.length + swotData.weaknesses.length + swotData.opportunities.length + swotData.threats.length;
  if (swotData.strengths.length === 0) {
    issues.push({
      category: "strengths",
      issue_type: "missing",
      description: "No strengths identified",
      severity: "high"
    });
    suggestions.push("Add at least 3-5 organizational or project strengths");
  }
  if (swotData.weaknesses.length === 0) {
    issues.push({
      category: "weaknesses",
      issue_type: "missing",
      description: "No weaknesses identified",
      severity: "high"
    });
    suggestions.push("Identify 3-5 areas for improvement or limitations");
  }
  if (swotData.opportunities.length === 0) {
    issues.push({
      category: "opportunities",
      issue_type: "missing",
      description: "No opportunities identified",
      severity: "high"
    });
    suggestions.push("Explore 3-5 external opportunities or market trends");
  }
  if (swotData.threats.length === 0) {
    issues.push({
      category: "threats",
      issue_type: "missing",
      description: "No threats identified",
      severity: "high"
    });
    suggestions.push("Consider 3-5 external risks or challenges");
  }
  const checkVague = /* @__PURE__ */ __name((items, category) => {
    items.forEach((item) => {
      if (item.length < 10) {
        issues.push({
          category,
          issue_type: "vague",
          description: `Item too brief: "${item}"`,
          severity: "low"
        });
      }
    });
  }, "checkVague");
  checkVague(swotData.strengths, "strengths");
  checkVague(swotData.weaknesses, "weaknesses");
  checkVague(swotData.opportunities, "opportunities");
  checkVague(swotData.threats, "threats");
  const completenessScore = Math.min(100, totalItems / 16 * 100);
  const hasIssues = issues.filter((i) => i.severity === "high").length > 0;
  const consistencyScore = hasIssues ? 60 : 85;
  const qualityScore = Math.max(0, 100 - issues.length * 10);
  return {
    is_valid: !hasIssues,
    completeness_score: Math.round(completenessScore),
    consistency_score: consistencyScore,
    quality_score: Math.round(qualityScore),
    issues,
    suggestions
  };
}
var init_ai = __esm({
  "../frameworks/swot/src/ai.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    __name(generateAISuggestions, "generateAISuggestions");
    __name(validateWithAI, "validateWithAI");
    __name(constructSuggestionsPrompt, "constructSuggestionsPrompt");
    __name(constructValidationPrompt, "constructValidationPrompt");
    __name(callOpenAI, "callOpenAI");
    __name(parseSuggestionsResponse, "parseSuggestionsResponse");
    __name(parseValidationResponse, "parseValidationResponse");
    __name(performBasicValidation, "performBasicValidation");
  }
});

// ../frameworks/swot/src/export.ts
async function exportSWOT(session, swotData, format, env, userId) {
  switch (format) {
    case "json":
      return exportToJSON(session, swotData, env, userId);
    case "pdf":
      return exportToPDF(session, swotData, env, userId);
    case "docx":
      return exportToDocx(session, swotData, env, userId);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
async function exportToJSON(session, swotData, env, userId) {
  const exportData = {
    metadata: {
      title: session.title,
      description: session.description,
      created_at: session.created_at,
      updated_at: session.updated_at,
      version: session.version,
      exported_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    analysis: {
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats
    },
    ai_insights: session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null
  };
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `swot_${session.id}_${Date.now()}.json`;
  if (env.EXPORTS) {
    await env.EXPORTS.put(filename, blob);
    const db = createDatabase(env);
    await db.insert("framework_exports", {
      session_id: session.id,
      export_type: "json",
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId
    });
    const expiresAt = new Date(Date.now() + 3600 * 1e3);
    return {
      download_url: `/api/v1/exports/${filename}`,
      format: "json",
      file_size: blob.size,
      expires_at: expiresAt.toISOString()
    };
  }
  const dataUrl = `data:application/json;base64,${btoa(jsonString)}`;
  return {
    download_url: dataUrl,
    format: "json",
    file_size: jsonString.length,
    expires_at: new Date(Date.now() + 3600 * 1e3).toISOString()
  };
}
async function exportToPDF(session, swotData, env, userId) {
  const html = generateHTMLReport(session, swotData);
  const filename = `swot_${session.id}_${Date.now()}.html`;
  if (env.EXPORTS) {
    const blob = new Blob([html], { type: "text/html" });
    await env.EXPORTS.put(filename, blob);
    const db = createDatabase(env);
    await db.insert("framework_exports", {
      session_id: session.id,
      export_type: "pdf",
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId
    });
    return {
      download_url: `/api/v1/exports/${filename}`,
      format: "pdf",
      file_size: blob.size,
      expires_at: new Date(Date.now() + 3600 * 1e3).toISOString()
    };
  }
  const dataUrl = `data:text/html;base64,${btoa(html)}`;
  return {
    download_url: dataUrl,
    format: "pdf",
    file_size: html.length,
    expires_at: new Date(Date.now() + 3600 * 1e3).toISOString()
  };
}
async function exportToDocx(session, swotData, env, userId) {
  const docData = {
    title: session.title,
    sections: [
      {
        heading: "Executive Summary",
        content: session.description
      },
      {
        heading: "Objective",
        content: swotData.objective
      },
      {
        heading: "Context",
        content: swotData.context || "No additional context provided."
      },
      {
        heading: "Strengths",
        type: "list",
        items: swotData.strengths
      },
      {
        heading: "Weaknesses",
        type: "list",
        items: swotData.weaknesses
      },
      {
        heading: "Opportunities",
        type: "list",
        items: swotData.opportunities
      },
      {
        heading: "Threats",
        type: "list",
        items: swotData.threats
      }
    ],
    metadata: {
      created: session.created_at,
      updated: session.updated_at,
      version: session.version
    }
  };
  const jsonString = JSON.stringify(docData, null, 2);
  const filename = `swot_${session.id}_${Date.now()}.docx.json`;
  if (env.EXPORTS) {
    const blob = new Blob([jsonString], { type: "application/json" });
    await env.EXPORTS.put(filename, blob);
    const db = createDatabase(env);
    await db.insert("framework_exports", {
      session_id: session.id,
      export_type: "docx",
      file_path: filename,
      file_size: blob.size,
      exported_by_id: userId
    });
    return {
      download_url: `/api/v1/exports/${filename}`,
      format: "docx",
      file_size: blob.size,
      expires_at: new Date(Date.now() + 3600 * 1e3).toISOString()
    };
  }
  const dataUrl = `data:application/json;base64,${btoa(jsonString)}`;
  return {
    download_url: dataUrl,
    format: "docx",
    file_size: jsonString.length,
    expires_at: new Date(Date.now() + 3600 * 1e3).toISOString()
  };
}
function generateHTMLReport(session, swotData) {
  const aiSuggestions = session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(session.title)} - SWOT Analysis</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .meta {
            opacity: 0.9;
            margin-top: 10px;
        }
        .section {
            background: white;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
            color: #667eea;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .swot-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        .swot-quadrant {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid;
        }
        .strengths { border-color: #48bb78; background: #f0fff4; }
        .weaknesses { border-color: #f56565; background: #fff5f5; }
        .opportunities { border-color: #4299e1; background: #ebf8ff; }
        .threats { border-color: #ed8936; background: #fffdf7; }
        .swot-quadrant h3 {
            margin-top: 0;
            margin-bottom: 15px;
        }
        .strengths h3 { color: #48bb78; }
        .weaknesses h3 { color: #f56565; }
        .opportunities h3 { color: #4299e1; }
        .threats h3 { color: #ed8936; }
        ul {
            margin: 0;
            padding-left: 20px;
        }
        li {
            margin-bottom: 8px;
        }
        .ai-insights {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        @media print {
            body { background: white; }
            .section { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(session.title)}</h1>
        <div class="meta">
            <div>Created: ${new Date(session.created_at).toLocaleDateString()}</div>
            <div>Last Updated: ${new Date(session.updated_at).toLocaleDateString()}</div>
            <div>Version: ${session.version}</div>
        </div>
    </div>

    <div class="section">
        <h2>Objective</h2>
        <p>${escapeHtml(swotData.objective)}</p>

        ${swotData.context ? `
        <h2>Context</h2>
        <p>${escapeHtml(swotData.context)}</p>
        ` : ""}
    </div>

    <div class="section">
        <h2>SWOT Analysis Matrix</h2>
        <div class="swot-grid">
            <div class="swot-quadrant strengths">
                <h3>Strengths</h3>
                <ul>
                    ${swotData.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
                </ul>
            </div>

            <div class="swot-quadrant weaknesses">
                <h3>Weaknesses</h3>
                <ul>
                    ${swotData.weaknesses.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
                </ul>
            </div>

            <div class="swot-quadrant opportunities">
                <h3>Opportunities</h3>
                <ul>
                    ${swotData.opportunities.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}
                </ul>
            </div>

            <div class="swot-quadrant threats">
                <h3>Threats</h3>
                <ul>
                    ${swotData.threats.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
                </ul>
            </div>
        </div>
    </div>

    ${aiSuggestions && aiSuggestions.insights ? `
    <div class="section">
        <h2>AI-Generated Insights</h2>
        <div class="ai-insights">
            <h3>Key Insights</h3>
            <ul>
                ${aiSuggestions.insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
            </ul>

            ${aiSuggestions.recommendations ? `
            <h3>Recommendations</h3>
            <ul>
                ${aiSuggestions.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
            </ul>
            ` : ""}
        </div>
    </div>
    ` : ""}

    <div class="footer">
        <p>Generated by ResearchToolsPy - SWOT Analysis Framework</p>
        <p>${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
    </div>
</body>
</html>`;
}
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
var init_export = __esm({
  "../frameworks/swot/src/export.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_database();
    __name(exportSWOT, "exportSWOT");
    __name(exportToJSON, "exportToJSON");
    __name(exportToPDF, "exportToPDF");
    __name(exportToDocx, "exportToDocx");
    __name(generateHTMLReport, "generateHTMLReport");
    __name(escapeHtml, "escapeHtml");
  }
});

// ../frameworks/swot/src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default,
  handleSWOTRequest: () => handleSWOTRequest
});
async function handleSWOTRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const swotPath = path.replace("/api/v1/frameworks/swot", "");
  switch (true) {
    case ((swotPath === "" || swotPath === "/" || swotPath === "/create") && method === "POST"):
      return handleCreateSWOT(request, env);
    case (swotPath.match(/^\/(\d+)$/) && method === "GET"):
      return handleGetSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));
    case (swotPath.match(/^\/(\d+)$/) && method === "PUT"):
      return handleUpdateSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));
    case (swotPath.match(/^\/(\d+)$/) && method === "DELETE"):
      return handleDeleteSWOT(request, env, parseInt(swotPath.match(/^\/(\d+)$/)[1]));
    case (swotPath.match(/^\/(\d+)\/ai-suggestions$/) && method === "POST"):
      return handleAISuggestions(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));
    case (swotPath.match(/^\/(\d+)\/validate$/) && method === "POST"):
      return handleAIValidation(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));
    case (swotPath.match(/^\/(\d+)\/export$/) && method === "POST"):
      return handleExport(request, env, parseInt(swotPath.match(/^\/(\d+)/)[1]));
    case (swotPath === "/templates/list" && method === "GET"):
      return handleListTemplates(request, env);
    case (swotPath === "/ai/industry-analysis" && method === "POST"):
      return handleIndustryAnalysis(request, env);
    case (swotPath === "/ai/competitive-intelligence" && method === "POST"):
      return handleCompetitiveIntelligence(request, env);
    case (swotPath === "/ai/predictive-modeling" && method === "POST"):
      return handlePredictiveModeling(request, env);
    case (swotPath === "/list" && method === "GET"):
      return handleListSWOT(request, env);
    default:
      return createErrorResponse(404, "SWOT endpoint not found", "ENDPOINT_NOT_FOUND");
  }
}
async function handleCreateSWOT(request, env) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const body = await request.json();
    const validation = validateRequestBody(body, {
      title: { required: true, type: "string", minLength: 1 },
      objective: { required: true, type: "string", minLength: 1 },
      context: { required: false, type: "string" },
      initial_strengths: { required: false, type: "array" },
      initial_weaknesses: { required: false, type: "array" },
      initial_opportunities: { required: false, type: "array" },
      initial_threats: { required: false, type: "array" }
    });
    if (validation) {
      return createErrorResponse(400, "Validation failed", "VALIDATION_ERROR", validation.fields);
    }
    const db = createDatabase(env);
    const swotData = {
      objective: body.objective,
      context: body.context || "",
      strengths: body.initial_strengths || [],
      weaknesses: body.initial_weaknesses || [],
      opportunities: body.initial_opportunities || [],
      threats: body.initial_threats || [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let aiSuggestions = null;
    if (body.request_ai_suggestions && env.OPENAI_API_KEY) {
      try {
        aiSuggestions = await generateAISuggestions(swotData, env);
        if (aiSuggestions) {
          swotData.strengths = mergUnique(swotData.strengths, aiSuggestions.strengths || []);
          swotData.weaknesses = mergeUnique(swotData.weaknesses, aiSuggestions.weaknesses || []);
          swotData.opportunities = mergeUnique(swotData.opportunities, aiSuggestions.opportunities || []);
          swotData.threats = mergeUnique(swotData.threats, aiSuggestions.threats || []);
          swotData.ai_suggestions = aiSuggestions;
        }
      } catch (error) {
        console.error("AI suggestions error:", error);
      }
    }
    const sessionId = await db.insert("framework_sessions", {
      title: body.title,
      description: body.objective,
      framework_type: "swot",
      status: "draft",
      user_id: request.user.id,
      data: JSON.stringify(swotData),
      config: JSON.stringify({ includeAI: body.request_ai_suggestions }),
      tags: body.tags ? JSON.stringify(body.tags) : null,
      version: 1,
      ai_suggestions: aiSuggestions ? JSON.stringify(aiSuggestions) : null,
      ai_analysis_count: aiSuggestions ? 1 : 0
    });
    const response = {
      session_id: sessionId,
      title: body.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: aiSuggestions,
      status: "draft",
      version: 1
    };
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Create SWOT error:", error);
    return createErrorResponse(500, "Failed to create SWOT analysis", "CREATE_ERROR");
  }
}
async function handleGetSWOT(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const db = createDatabase(env);
    const session = await db.findOne(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );
    if (!session) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    const swotData = JSON.parse(session.data);
    const aiSuggestions = session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null;
    const response = {
      session_id: session.id,
      title: session.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: aiSuggestions,
      status: session.status,
      version: session.version
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get SWOT error:", error);
    return createErrorResponse(500, "Failed to retrieve SWOT analysis", "GET_ERROR");
  }
}
async function handleUpdateSWOT(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const body = await request.json();
    const db = createDatabase(env);
    const session = await db.findOne(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );
    if (!session) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    const swotData = JSON.parse(session.data);
    if (body.objective !== void 0) swotData.objective = body.objective;
    if (body.context !== void 0) swotData.context = body.context;
    if (body.strengths !== void 0) swotData.strengths = body.strengths;
    if (body.weaknesses !== void 0) swotData.weaknesses = body.weaknesses;
    if (body.opportunities !== void 0) swotData.opportunities = body.opportunities;
    if (body.threats !== void 0) swotData.threats = body.threats;
    swotData.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await db.update(
      "framework_sessions",
      {
        title: body.title || session.title,
        data: JSON.stringify(swotData),
        version: session.version + 1,
        status: body.status || session.status
      },
      { id: sessionId }
    );
    const response = {
      session_id: sessionId,
      title: body.title || session.title,
      objective: swotData.objective,
      context: swotData.context,
      strengths: swotData.strengths,
      weaknesses: swotData.weaknesses,
      opportunities: swotData.opportunities,
      threats: swotData.threats,
      ai_suggestions: session.ai_suggestions ? JSON.parse(session.ai_suggestions) : null,
      status: body.status || session.status,
      version: session.version + 1
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Update SWOT error:", error);
    return createErrorResponse(500, "Failed to update SWOT analysis", "UPDATE_ERROR");
  }
}
async function handleDeleteSWOT(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const db = createDatabase(env);
    const deleted = await db.delete("framework_sessions", {
      id: sessionId,
      user_id: request.user.id,
      framework_type: "swot"
    });
    if (deleted === 0) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Delete SWOT error:", error);
    return createErrorResponse(500, "Failed to delete SWOT analysis", "DELETE_ERROR");
  }
}
async function handleAISuggestions(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, "AI service not available", "AI_UNAVAILABLE");
  }
  try {
    const db = createDatabase(env);
    const session = await db.findOne(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );
    if (!session) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    const swotData = JSON.parse(session.data);
    const suggestions = await generateAISuggestions(swotData, env);
    await db.update(
      "framework_sessions",
      {
        ai_suggestions: JSON.stringify(suggestions),
        ai_analysis_count: session.ai_analysis_count + 1
      },
      { id: sessionId }
    );
    return new Response(JSON.stringify(suggestions), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("AI suggestions error:", error);
    return createErrorResponse(500, "Failed to generate AI suggestions", "AI_ERROR");
  }
}
async function handleAIValidation(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  if (!env.OPENAI_API_KEY) {
    return createErrorResponse(503, "AI service not available", "AI_UNAVAILABLE");
  }
  try {
    const db = createDatabase(env);
    const session = await db.findOne(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );
    if (!session) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    const swotData = JSON.parse(session.data);
    const validation = await validateWithAI(swotData, env);
    return new Response(JSON.stringify(validation), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("AI validation error:", error);
    return createErrorResponse(500, "Failed to validate SWOT analysis", "VALIDATION_ERROR");
  }
}
async function handleExport(request, env, sessionId) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const body = await request.json();
    if (!["pdf", "docx", "json"].includes(body.format)) {
      return createErrorResponse(400, "Invalid export format", "INVALID_FORMAT");
    }
    const db = createDatabase(env);
    const session = await db.findOne(
      `SELECT * FROM framework_sessions
       WHERE id = ? AND user_id = ? AND framework_type = 'swot'`,
      [sessionId, request.user.id]
    );
    if (!session) {
      return createErrorResponse(404, "SWOT analysis not found", "NOT_FOUND");
    }
    const swotData = JSON.parse(session.data);
    const exportResult = await exportSWOT(
      session,
      swotData,
      body.format,
      env,
      request.user.id
    );
    return new Response(JSON.stringify(exportResult), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Export error:", error);
    return createErrorResponse(500, "Failed to export SWOT analysis", "EXPORT_ERROR");
  }
}
async function handleListTemplates(request, env) {
  try {
    const db = createDatabase(env);
    const templates = await db.find("framework_templates", {
      where: {
        framework_type: "swot",
        is_public: 1
      },
      orderBy: {
        column: "usage_count",
        direction: "desc"
      },
      limit: 20
    });
    return new Response(JSON.stringify(templates), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("List templates error:", error);
    return createErrorResponse(500, "Failed to list templates", "LIST_ERROR");
  }
}
async function handleListSWOT(request, env) {
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  try {
    const db = createDatabase(env);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const result = await db.paginate("framework_sessions", page, pageSize, {
      where: {
        user_id: request.user.id,
        framework_type: "swot"
      },
      orderBy: {
        column: "updated_at",
        direction: "desc"
      }
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("List SWOT error:", error);
    return createErrorResponse(500, "Failed to list SWOT analyses", "LIST_ERROR");
  }
}
async function handleIndustryAnalysis(request, env) {
  return createErrorResponse(501, "Industry analysis not yet implemented", "NOT_IMPLEMENTED");
}
async function handleCompetitiveIntelligence(request, env) {
  return createErrorResponse(501, "Competitive intelligence not yet implemented", "NOT_IMPLEMENTED");
}
async function handlePredictiveModeling(request, env) {
  return createErrorResponse(501, "Predictive modeling not yet implemented", "NOT_IMPLEMENTED");
}
function mergeUnique(arr1, arr2) {
  const seen = new Set(arr1);
  const result = [...arr1];
  for (const item of arr2) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
var src_default;
var init_src = __esm({
  "../frameworks/swot/src/index.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_database();
    init_errorHandler();
    init_ai();
    init_export();
    src_default = {
      async fetch(request, env, ctx) {
        return handleSWOTRequest(request, env, ctx);
      }
    };
    __name(handleSWOTRequest, "handleSWOTRequest");
    __name(handleCreateSWOT, "handleCreateSWOT");
    __name(handleGetSWOT, "handleGetSWOT");
    __name(handleUpdateSWOT, "handleUpdateSWOT");
    __name(handleDeleteSWOT, "handleDeleteSWOT");
    __name(handleAISuggestions, "handleAISuggestions");
    __name(handleAIValidation, "handleAIValidation");
    __name(handleExport, "handleExport");
    __name(handleListTemplates, "handleListTemplates");
    __name(handleListSWOT, "handleListSWOT");
    __name(handleIndustryAnalysis, "handleIndustryAnalysis");
    __name(handleCompetitiveIntelligence, "handleCompetitiveIntelligence");
    __name(handlePredictiveModeling, "handlePredictiveModeling");
    __name(mergeUnique, "mergeUnique");
  }
});

// src/routes/frameworks.ts
var frameworks_exports = {};
__export(frameworks_exports, {
  frameworkRouter: () => frameworkRouter,
  getUserFrameworkSessions: () => getUserFrameworkSessions
});
async function frameworkRouter(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const frameworkMatch = path.match(/^\/api\/v1\/frameworks\/([^\/]+)/);
  if (!frameworkMatch) {
    return handleListFrameworks(request, env);
  }
  const frameworkType = frameworkMatch[1];
  switch (frameworkType) {
    case "swot":
      return handleSWOTFramework(request, env, ctx);
    case "ach":
      return handleACHFramework(request, env, ctx);
    case "behavioral":
    case "behavioral-analysis":
      return handleBehavioralFramework(request, env, ctx);
    case "deception":
    case "deception-detection":
      return handleDeceptionFramework(request, env, ctx);
    case "dotmlpf":
      return handleDOTMLPFFramework(request, env, ctx);
    case "pmesii-pt":
      return handlePMESIIPTFramework(request, env, ctx);
    case "dime":
      return handleDIMEFramework(request, env, ctx);
    case "pest":
      return handlePESTFramework(request, env, ctx);
    case "vrio":
      return handleVRIOFramework(request, env, ctx);
    case "stakeholder":
      return handleStakeholderFramework(request, env, ctx);
    case "trend":
      return handleTrendFramework(request, env, ctx);
    case "surveillance":
      return handleSurveillanceFramework(request, env, ctx);
    case "causeway":
      return handleCausewayFramework(request, env, ctx);
    case "cog":
      return handleCOGFramework(request, env, ctx);
    case "starbursting":
      return handleStarburstingFramework(request, env, ctx);
    case "fundamental-flow":
      return handleFundamentalFlowFramework(request, env, ctx);
    default:
      return createErrorResponse(404, `Framework '${frameworkType}' not found`, "FRAMEWORK_NOT_FOUND");
  }
}
async function handleListFrameworks(request, env) {
  const frameworks = [
    {
      id: "swot",
      name: "SWOT Analysis",
      description: "Analyze Strengths, Weaknesses, Opportunities, and Threats",
      category: "strategic",
      ai_enabled: true
    },
    {
      id: "ach",
      name: "Analysis of Competing Hypotheses",
      description: "Systematic method for evaluating multiple hypotheses",
      category: "intelligence",
      ai_enabled: true
    },
    {
      id: "behavioral",
      name: "Behavioral Analysis (COM-B)",
      description: "Analyze behavior using Capability, Opportunity, Motivation model",
      category: "behavioral",
      ai_enabled: true
    },
    {
      id: "deception",
      name: "Deception Detection",
      description: "Identify and analyze potential deception in information",
      category: "intelligence",
      ai_enabled: true
    },
    {
      id: "dotmlpf",
      name: "DOTMLPF-P Assessment",
      description: "Military capability assessment framework",
      category: "military",
      ai_enabled: true
    },
    {
      id: "pmesii-pt",
      name: "PMESII-PT Analysis",
      description: "Environmental factor analysis for operations",
      category: "military",
      ai_enabled: true
    },
    {
      id: "dime",
      name: "DIME Analysis",
      description: "Diplomatic, Information, Military, Economic power analysis",
      category: "strategic",
      ai_enabled: true
    },
    {
      id: "pest",
      name: "PEST Analysis",
      description: "Political, Economic, Social, Technological factors",
      category: "business",
      ai_enabled: true
    },
    {
      id: "vrio",
      name: "VRIO Framework",
      description: "Valuable, Rare, Inimitable, Organized resource analysis",
      category: "business",
      ai_enabled: true
    },
    {
      id: "stakeholder",
      name: "Stakeholder Analysis",
      description: "Map and analyze stakeholder influence and interest",
      category: "strategic",
      ai_enabled: true
    },
    {
      id: "trend",
      name: "Trend Analysis",
      description: "Identify and analyze patterns over time",
      category: "analytical",
      ai_enabled: true
    },
    {
      id: "surveillance",
      name: "Surveillance Analysis",
      description: "Systematic monitoring and analysis framework",
      category: "intelligence",
      ai_enabled: true
    },
    {
      id: "causeway",
      name: "Causeway Analysis",
      description: "Analyze causal relationships and pathways",
      category: "analytical",
      ai_enabled: true
    },
    {
      id: "cog",
      name: "Center of Gravity",
      description: "Identify critical capabilities and vulnerabilities",
      category: "military",
      ai_enabled: true
    },
    {
      id: "starbursting",
      name: "Starbursting",
      description: "Systematic questioning technique using 5W1H",
      category: "analytical",
      ai_enabled: true
    },
    {
      id: "fundamental-flow",
      name: "Fundamental Flow",
      description: "Analyze fundamental processes and workflows",
      category: "analytical",
      ai_enabled: false
    }
  ];
  if (request.user) {
    const db = createDatabase(env);
    const userSessions = await db.execute(
      `SELECT framework_type, COUNT(*) as count
       FROM framework_sessions
       WHERE user_id = ?
       GROUP BY framework_type`,
      [request.user.id]
    );
    const usageMap = new Map(
      userSessions.results.map((row) => [row.framework_type, row.count])
    );
    frameworks.forEach((framework) => {
      framework.user_sessions_count = usageMap.get(framework.id) || 0;
    });
  }
  return new Response(JSON.stringify(frameworks), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleSWOTFramework(request, env, ctx) {
  const { handleSWOTRequest: handleSWOTRequest2 } = await Promise.resolve().then(() => (init_src(), src_exports));
  return handleSWOTRequest2(request, env, ctx);
}
async function handleACHFramework(request, env, ctx) {
  return createErrorResponse(501, "ACH framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleBehavioralFramework(request, env, ctx) {
  return createErrorResponse(501, "Behavioral Analysis framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleDeceptionFramework(request, env, ctx) {
  return createErrorResponse(501, "Deception Detection framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleDOTMLPFFramework(request, env, ctx) {
  return createErrorResponse(501, "DOTMLPF framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handlePMESIIPTFramework(request, env, ctx) {
  return createErrorResponse(501, "PMESII-PT framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleDIMEFramework(request, env, ctx) {
  return createErrorResponse(501, "DIME framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handlePESTFramework(request, env, ctx) {
  return createErrorResponse(501, "PEST framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleVRIOFramework(request, env, ctx) {
  return createErrorResponse(501, "VRIO framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleStakeholderFramework(request, env, ctx) {
  return createErrorResponse(501, "Stakeholder Analysis framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleTrendFramework(request, env, ctx) {
  return createErrorResponse(501, "Trend Analysis framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleSurveillanceFramework(request, env, ctx) {
  return createErrorResponse(501, "Surveillance Analysis framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleCausewayFramework(request, env, ctx) {
  return createErrorResponse(501, "Causeway Analysis framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleCOGFramework(request, env, ctx) {
  return createErrorResponse(501, "Center of Gravity framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleStarburstingFramework(request, env, ctx) {
  return createErrorResponse(501, "Starbursting framework not yet implemented", "NOT_IMPLEMENTED");
}
async function handleFundamentalFlowFramework(request, env, ctx) {
  return createErrorResponse(501, "Fundamental Flow framework not yet implemented", "NOT_IMPLEMENTED");
}
async function getUserFrameworkSessions(userId, env, options) {
  const db = createDatabase(env);
  const where = { user_id: userId };
  if (options?.framework_type) {
    where.framework_type = options.framework_type;
  }
  if (options?.status) {
    where.status = options.status;
  }
  return db.paginate(
    "framework_sessions",
    options?.page || 1,
    options?.pageSize || 20,
    {
      where,
      orderBy: {
        column: "updated_at",
        direction: "desc"
      }
    }
  );
}
var init_frameworks = __esm({
  "src/routes/frameworks.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_database();
    init_errorHandler();
    __name(frameworkRouter, "frameworkRouter");
    __name(handleListFrameworks, "handleListFrameworks");
    __name(handleSWOTFramework, "handleSWOTFramework");
    __name(handleACHFramework, "handleACHFramework");
    __name(handleBehavioralFramework, "handleBehavioralFramework");
    __name(handleDeceptionFramework, "handleDeceptionFramework");
    __name(handleDOTMLPFFramework, "handleDOTMLPFFramework");
    __name(handlePMESIIPTFramework, "handlePMESIIPTFramework");
    __name(handleDIMEFramework, "handleDIMEFramework");
    __name(handlePESTFramework, "handlePESTFramework");
    __name(handleVRIOFramework, "handleVRIOFramework");
    __name(handleStakeholderFramework, "handleStakeholderFramework");
    __name(handleTrendFramework, "handleTrendFramework");
    __name(handleSurveillanceFramework, "handleSurveillanceFramework");
    __name(handleCausewayFramework, "handleCausewayFramework");
    __name(handleCOGFramework, "handleCOGFramework");
    __name(handleStarburstingFramework, "handleStarburstingFramework");
    __name(handleFundamentalFlowFramework, "handleFundamentalFlowFramework");
    __name(getUserFrameworkSessions, "getUserFrameworkSessions");
  }
});

// src/routes/tools.ts
var tools_exports = {};
__export(tools_exports, {
  toolsRouter: () => toolsRouter
});
async function toolsRouter(request, env, ctx) {
  return createErrorResponse(501, "Research tools not yet implemented", "NOT_IMPLEMENTED");
}
var init_tools = __esm({
  "src/routes/tools.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(toolsRouter, "toolsRouter");
  }
});

// src/routes/users.ts
var users_exports = {};
__export(users_exports, {
  usersRouter: () => usersRouter
});
async function usersRouter(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (!request.user) {
    return createErrorResponse(401, "Authentication required", "AUTH_REQUIRED");
  }
  switch (true) {
    case (path === "/api/v1/users" && method === "GET"):
      const roleCheck = requireRole(request.user, ["admin"]);
      if (roleCheck) return roleCheck;
      return handleListUsers(request, env);
    case (path.match(/^\/api\/v1\/users\/(\d+)$/) && method === "GET"):
      return handleGetUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));
    case (path.match(/^\/api\/v1\/users\/(\d+)$/) && method === "PATCH"):
      return handleUpdateUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));
    case (path.match(/^\/api\/v1\/users\/(\d+)$/) && method === "DELETE"):
      return handleDeleteUser(request, env, parseInt(path.match(/^\/api\/v1\/users\/(\d+)$/)[1]));
    case (path === "/api/v1/users/search" && method === "GET"):
      return handleSearchUsers(request, env);
    case (path === "/api/v1/users/stats" && method === "GET"):
      return handleUserStats(request, env);
    default:
      return createErrorResponse(404, "User endpoint not found", "ENDPOINT_NOT_FOUND");
  }
}
async function handleListUsers(request, env) {
  const db = createDatabase(env);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const result = await db.paginate("users", page, pageSize, {
    orderBy: { column: "created_at", direction: "desc" }
  });
  result.items = result.items.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    is_verified: user.is_verified,
    organization: user.organization,
    department: user.department,
    created_at: user.created_at
  }));
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleGetUser(request, env, userId) {
  if (request.user.id !== userId && request.user.role !== "admin") {
    return createErrorResponse(403, "Forbidden", "FORBIDDEN");
  }
  const db = createDatabase(env);
  const user = await db.findOne(
    "SELECT id, username, email, full_name, role, is_active, is_verified, organization, department, bio, created_at, updated_at FROM users WHERE id = ?",
    [userId]
  );
  if (!user) {
    return createErrorResponse(404, "User not found", "NOT_FOUND");
  }
  return new Response(JSON.stringify(user), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleUpdateUser(request, env, userId) {
  if (request.user.id !== userId && request.user.role !== "admin") {
    return createErrorResponse(403, "Forbidden", "FORBIDDEN");
  }
  const body = await request.json();
  const db = createDatabase(env);
  const allowedSelfUpdate = ["full_name", "bio", "organization", "department"];
  const allowedAdminUpdate = [...allowedSelfUpdate, "role", "is_active", "is_verified"];
  const updates = {};
  const allowedFields = request.user.role === "admin" ? allowedAdminUpdate : allowedSelfUpdate;
  for (const field of allowedFields) {
    if (body[field] !== void 0) {
      updates[field] = body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    return createErrorResponse(400, "No valid fields to update", "NO_UPDATES");
  }
  await db.update("users", updates, { id: userId });
  const updatedUser = await db.findOne(
    "SELECT id, username, email, full_name, role, is_active, is_verified, organization, department, bio, created_at, updated_at FROM users WHERE id = ?",
    [userId]
  );
  return new Response(JSON.stringify(updatedUser), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleDeleteUser(request, env, userId) {
  const roleCheck = requireRole(request.user, ["admin"]);
  if (roleCheck) return roleCheck;
  if (request.user.id === userId) {
    return createErrorResponse(400, "Cannot delete your own account", "SELF_DELETE");
  }
  const db = createDatabase(env);
  const deleted = await db.delete("users", { id: userId });
  if (deleted === 0) {
    return createErrorResponse(404, "User not found", "NOT_FOUND");
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleSearchUsers(request, env) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  if (!query || query.length < 2) {
    return createErrorResponse(400, "Search query must be at least 2 characters", "INVALID_QUERY");
  }
  const db = createDatabase(env);
  const results = await db.execute(
    `SELECT id, username, email, full_name, role, organization, department
     FROM users
     WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?)
     AND is_active = 1
     LIMIT 20`,
    [`%${query}%`, `%${query}%`, `%${query}%`]
  );
  return new Response(JSON.stringify(results.results), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleUserStats(request, env) {
  const userId = request.user.role === "admin" ? parseInt(new URL(request.url).searchParams.get("userId") || request.user.id.toString()) : request.user.id;
  const db = createDatabase(env);
  const stats = await db.execute(
    `SELECT
      COUNT(DISTINCT fs.id) as total_sessions,
      COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_sessions,
      COUNT(DISTINCT fs.framework_type) as frameworks_used,
      SUM(fs.ai_analysis_count) as total_ai_analyses,
      COUNT(DISTINCT fe.id) as total_exports
     FROM users u
     LEFT JOIN framework_sessions fs ON u.id = fs.user_id
     LEFT JOIN framework_exports fe ON fs.id = fe.session_id
     WHERE u.id = ?`,
    [userId]
  );
  return new Response(JSON.stringify(stats.results[0]), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
var init_users = __esm({
  "src/routes/users.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_database();
    init_errorHandler();
    init_auth();
    __name(usersRouter, "usersRouter");
    __name(handleListUsers, "handleListUsers");
    __name(handleGetUser, "handleGetUser");
    __name(handleUpdateUser, "handleUpdateUser");
    __name(handleDeleteUser, "handleDeleteUser");
    __name(handleSearchUsers, "handleSearchUsers");
    __name(handleUserStats, "handleUserStats");
  }
});

// src/routes/ai.ts
var ai_exports = {};
__export(ai_exports, {
  aiRouter: () => aiRouter
});
async function aiRouter(request, env, ctx) {
  return createErrorResponse(501, "AI service not yet implemented", "NOT_IMPLEMENTED");
}
var init_ai2 = __esm({
  "src/routes/ai.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(aiRouter, "aiRouter");
  }
});

// src/routes/export.ts
var export_exports = {};
__export(export_exports, {
  exportRouter: () => exportRouter
});
async function exportRouter(request, env, ctx) {
  return createErrorResponse(501, "Export service not yet implemented", "NOT_IMPLEMENTED");
}
var init_export2 = __esm({
  "src/routes/export.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(exportRouter, "exportRouter");
  }
});

// src/routes/analytics.ts
var analytics_exports = {};
__export(analytics_exports, {
  analyticsRouter: () => analyticsRouter
});
async function analyticsRouter(request, env, ctx) {
  return createErrorResponse(501, "Analytics service not yet implemented", "NOT_IMPLEMENTED");
}
var init_analytics = __esm({
  "src/routes/analytics.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(analyticsRouter, "analyticsRouter");
  }
});

// src/routes/citations.ts
var citations_exports = {};
__export(citations_exports, {
  citationsRouter: () => citationsRouter
});
async function citationsRouter(request, env, ctx) {
  return createErrorResponse(501, "Citations service not yet implemented", "NOT_IMPLEMENTED");
}
var init_citations = __esm({
  "src/routes/citations.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(citationsRouter, "citationsRouter");
  }
});

// src/routes/jobs.ts
var jobs_exports = {};
__export(jobs_exports, {
  jobsRouter: () => jobsRouter
});
async function jobsRouter(request, env, ctx) {
  return createErrorResponse(501, "Jobs service not yet implemented", "NOT_IMPLEMENTED");
}
var init_jobs = __esm({
  "src/routes/jobs.ts"() {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    init_errorHandler();
    __name(jobsRouter, "jobsRouter");
  }
});

// .wrangler/tmp/bundle-eX4cAX/middleware-loader.entry.ts
init_checked_fetch();
init_modules_watch_stub();

// .wrangler/tmp/bundle-eX4cAX/middleware-insertion-facade.js
init_checked_fetch();
init_modules_watch_stub();

// src/index.ts
init_checked_fetch();
init_modules_watch_stub();

// src/middleware/cors.ts
init_checked_fetch();
init_modules_watch_stub();
function corsMiddleware(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins(env);
  const isAllowed = allowedOrigins.includes("*") || allowedOrigins.some((allowed) => {
    if (allowed.includes("*")) {
      const pattern = allowed.replace("*", ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return allowed === origin;
  });
  const corsHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Content-Type, Authorization, X-Request-ID",
    "Access-Control-Max-Age": "86400"
    // 24 hours
  };
  if (isAllowed) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  } else if (env.ENVIRONMENT !== "production") {
    corsHeaders["Access-Control-Allow-Origin"] = origin || "*";
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return new Response(null, {
    headers: corsHeaders
  });
}
__name(corsMiddleware, "corsMiddleware");
function getAllowedOrigins(env) {
  if (env.ENVIRONMENT === "production") {
    return [
      "https://researchtoolspy.com",
      "https://www.researchtoolspy.com",
      "https://app.researchtoolspy.com",
      "https://*.researchtoolspy.com"
    ];
  } else if (env.ENVIRONMENT === "staging") {
    return [
      "https://staging.researchtoolspy.com",
      "https://*.staging.researchtoolspy.com",
      "http://localhost:3000",
      "http://localhost:3001"
    ];
  } else {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      // Vite default
      "http://127.0.0.1:5173"
    ];
  }
}
__name(getAllowedOrigins, "getAllowedOrigins");

// src/middleware/rateLimit.ts
init_checked_fetch();
init_modules_watch_stub();
async function rateLimitMiddleware(request, env) {
  const config = getRateLimitConfig(request, env);
  const key = getRateLimitKey(request);
  try {
    const currentCount = await env.RATE_LIMITS.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;
    if (count >= config.maxRequests) {
      const retryAfter = Math.ceil(config.windowMs / 1e3);
      return createRateLimitResponse(retryAfter, config);
    }
    const newCount = count + 1;
    const ttl = Math.ceil(config.windowMs / 1e3);
    await env.RATE_LIMITS.put(key, newCount.toString(), {
      expirationTtl: ttl
    });
    request.rateLimitInfo = {
      limit: config.maxRequests,
      remaining: config.maxRequests - newCount,
      reset: Date.now() + config.windowMs
    };
    return null;
  } catch (error) {
    console.error("Rate limit error:", error);
    return null;
  }
}
__name(rateLimitMiddleware, "rateLimitMiddleware");
function getRateLimitConfig(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/v1/auth/login")) {
    return {
      windowMs: 15 * 60 * 1e3,
      // 15 minutes
      maxRequests: 5
    };
  }
  if (path.startsWith("/api/v1/auth/register")) {
    return {
      windowMs: 60 * 60 * 1e3,
      // 1 hour
      maxRequests: 3
    };
  }
  if (path.startsWith("/api/v1/ai/")) {
    return {
      windowMs: 60 * 1e3,
      // 1 minute
      maxRequests: 10
    };
  }
  if (path.startsWith("/api/v1/export/")) {
    return {
      windowMs: 60 * 1e3,
      // 1 minute
      maxRequests: 5
    };
  }
  const defaultLimit = env.ENVIRONMENT === "production" ? 100 : 1e3;
  return {
    windowMs: 60 * 1e3,
    // 1 minute
    maxRequests: defaultLimit
  };
}
__name(getRateLimitConfig, "getRateLimitConfig");
function getRateLimitKey(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || request.headers.get("X-Real-IP") || "unknown";
  const userId = request.user?.id || "";
  const baseKey = `rate_limit:${path}:${ip}`;
  return userId ? `${baseKey}:${userId}` : baseKey;
}
__name(getRateLimitKey, "getRateLimitKey");
function createRateLimitResponse(retryAfter, config) {
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
      limit: config.maxRequests,
      window: config.windowMs / 1e3
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": (Date.now() + config.windowMs).toString()
      }
    }
  );
}
__name(createRateLimitResponse, "createRateLimitResponse");

// src/index.ts
init_auth();
init_errorHandler();

// src/middleware/logger.ts
init_checked_fetch();
init_modules_watch_stub();
init_database();
async function requestLogger(request, response, env, metadata) {
  try {
    const url = new URL(request.url);
    const logEntry = {
      requestId: metadata.requestId,
      method: request.method,
      url: url.href,
      path: url.pathname,
      statusCode: response.status,
      processingTime: metadata.processingTime,
      userAgent: request.headers.get("User-Agent") || void 0,
      ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || request.headers.get("X-Real-IP") || void 0,
      userId: request.user?.id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (response.status >= 400) {
      try {
        const responseBody = await response.clone().text();
        const errorData = JSON.parse(responseBody);
        logEntry.error = errorData.message || errorData.error;
      } catch {
      }
    }
    const logKey = `log:${metadata.requestId}`;
    await env.CACHE.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 86400
      // 24 hours
    });
    await storeMetrics(logEntry, env);
    if (env.ENVIRONMENT === "production") {
      await sendToAnalytics(logEntry, env);
    }
    if (env.ENVIRONMENT !== "production") {
      console.log("Request Log:", logEntry);
    }
  } catch (error) {
    console.error("Logging error:", error);
  }
}
__name(requestLogger, "requestLogger");
async function storeMetrics(logEntry, env) {
  try {
    const metricsKey = `metrics:${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
    const existingMetrics = await env.CACHE.get(metricsKey);
    const metrics = existingMetrics ? JSON.parse(existingMetrics) : {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      endpoints: {},
      statusCodes: {},
      userAgents: {}
    };
    metrics.totalRequests++;
    if (logEntry.statusCode < 400) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.totalRequests - 1) + logEntry.processingTime) / metrics.totalRequests;
    if (!metrics.endpoints[logEntry.path]) {
      metrics.endpoints[logEntry.path] = {
        count: 0,
        avgTime: 0,
        errors: 0
      };
    }
    const endpointMetrics = metrics.endpoints[logEntry.path];
    endpointMetrics.count++;
    endpointMetrics.avgTime = (endpointMetrics.avgTime * (endpointMetrics.count - 1) + logEntry.processingTime) / endpointMetrics.count;
    if (logEntry.statusCode >= 400) {
      endpointMetrics.errors++;
    }
    metrics.statusCodes[logEntry.statusCode] = (metrics.statusCodes[logEntry.statusCode] || 0) + 1;
    if (logEntry.userAgent) {
      const browser = getBrowserFromUserAgent(logEntry.userAgent);
      metrics.userAgents[browser] = (metrics.userAgents[browser] || 0) + 1;
    }
    await env.CACHE.put(metricsKey, JSON.stringify(metrics), {
      expirationTtl: 604800
      // 7 days
    });
  } catch (error) {
    console.error("Metrics storage error:", error);
  }
}
__name(storeMetrics, "storeMetrics");
async function sendToAnalytics(logEntry, env) {
  try {
    const db = createDatabase(env);
    await db.insert("usage_metrics", {
      user_id: logEntry.userId || null,
      metric_type: "api_request",
      metric_value: JSON.stringify({
        method: logEntry.method,
        path: logEntry.path,
        statusCode: logEntry.statusCode,
        processingTime: logEntry.processingTime
      }),
      session_id: logEntry.requestId,
      ip_address: logEntry.ip,
      user_agent: logEntry.userAgent
    });
  } catch (error) {
    console.error("Analytics error:", error);
  }
}
__name(sendToAnalytics, "sendToAnalytics");
function getBrowserFromUserAgent(userAgent) {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  if (userAgent.includes("Opera")) return "Opera";
  if (userAgent.includes("curl")) return "curl";
  if (userAgent.includes("Postman")) return "Postman";
  if (userAgent.includes("axios")) return "axios";
  return "Other";
}
__name(getBrowserFromUserAgent, "getBrowserFromUserAgent");

// src/router.ts
init_checked_fetch();
init_modules_watch_stub();
init_errorHandler();
async function router(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (path === "/api/v1/health" || path === "/health") {
    return handleHealthCheck(env);
  }
  if (!path.startsWith("/api/v1/")) {
    return createErrorResponse(404, "API version not found. Use /api/v1/", "VERSION_NOT_FOUND");
  }
  try {
    if (path.startsWith("/api/v1/auth/")) {
      return routeToAuthService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/frameworks/")) {
      return routeToFrameworkService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/tools/")) {
      return routeToToolsService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/users/")) {
      return routeToUsersService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/ai/")) {
      return routeToAIService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/export/")) {
      return routeToExportService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/analytics/")) {
      return routeToAnalyticsService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/citations/")) {
      return routeToCitationsService(request, env, ctx);
    }
    if (path.startsWith("/api/v1/jobs/")) {
      return routeToJobsService(request, env, ctx);
    }
    return createErrorResponse(404, "Endpoint not found", "ENDPOINT_NOT_FOUND");
  } catch (error) {
    console.error("Routing error:", error);
    return createErrorResponse(500, "Internal routing error", "ROUTING_ERROR");
  }
}
__name(router, "router");
async function routeToAuthService(request, env, ctx) {
  if (env.AUTH_SERVICE) {
    return env.AUTH_SERVICE.fetch(request);
  }
  const { authRouter: authRouter2 } = await Promise.resolve().then(() => (init_auth2(), auth_exports));
  return authRouter2(request, env, ctx);
}
__name(routeToAuthService, "routeToAuthService");
async function routeToFrameworkService(request, env, ctx) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const frameworkType = pathParts[4];
  const serviceBindings = {
    "swot": env.SWOT_SERVICE,
    "ach": env.ACH_SERVICE,
    "behavioral": env.BEHAVIORAL_SERVICE,
    "deception": env.DECEPTION_SERVICE,
    "dotmlpf": env.DOTMLPF_SERVICE,
    "pmesii-pt": env.PMESII_SERVICE,
    "dime": env.DIME_SERVICE,
    "pest": env.PEST_SERVICE,
    "vrio": env.VRIO_SERVICE,
    "stakeholder": env.STAKEHOLDER_SERVICE,
    "trend": env.TREND_SERVICE,
    "surveillance": env.SURVEILLANCE_SERVICE,
    "causeway": env.CAUSEWAY_SERVICE,
    "cog": env.COG_SERVICE,
    "starbursting": env.STARBURSTING_SERVICE,
    "fundamental-flow": env.FLOW_SERVICE
  };
  const service = serviceBindings[frameworkType];
  if (service) {
    return service.fetch(request);
  }
  const { frameworkRouter: frameworkRouter2 } = await Promise.resolve().then(() => (init_frameworks(), frameworks_exports));
  return frameworkRouter2(request, env, ctx);
}
__name(routeToFrameworkService, "routeToFrameworkService");
async function routeToToolsService(request, env, ctx) {
  if (env.TOOLS_SERVICE) {
    return env.TOOLS_SERVICE.fetch(request);
  }
  const { toolsRouter: toolsRouter2 } = await Promise.resolve().then(() => (init_tools(), tools_exports));
  return toolsRouter2(request, env, ctx);
}
__name(routeToToolsService, "routeToToolsService");
async function routeToUsersService(request, env, ctx) {
  if (env.USERS_SERVICE) {
    return env.USERS_SERVICE.fetch(request);
  }
  const { usersRouter: usersRouter2 } = await Promise.resolve().then(() => (init_users(), users_exports));
  return usersRouter2(request, env, ctx);
}
__name(routeToUsersService, "routeToUsersService");
async function routeToAIService(request, env, ctx) {
  if (env.AI_SERVICE) {
    return env.AI_SERVICE.fetch(request);
  }
  const { aiRouter: aiRouter2 } = await Promise.resolve().then(() => (init_ai2(), ai_exports));
  return aiRouter2(request, env, ctx);
}
__name(routeToAIService, "routeToAIService");
async function routeToExportService(request, env, ctx) {
  if (env.EXPORT_SERVICE) {
    return env.EXPORT_SERVICE.fetch(request);
  }
  const { exportRouter: exportRouter2 } = await Promise.resolve().then(() => (init_export2(), export_exports));
  return exportRouter2(request, env, ctx);
}
__name(routeToExportService, "routeToExportService");
async function routeToAnalyticsService(request, env, ctx) {
  if (env.ANALYTICS_SERVICE) {
    return env.ANALYTICS_SERVICE.fetch(request);
  }
  const { analyticsRouter: analyticsRouter2 } = await Promise.resolve().then(() => (init_analytics(), analytics_exports));
  return analyticsRouter2(request, env, ctx);
}
__name(routeToAnalyticsService, "routeToAnalyticsService");
async function routeToCitationsService(request, env, ctx) {
  const { citationsRouter: citationsRouter2 } = await Promise.resolve().then(() => (init_citations(), citations_exports));
  return citationsRouter2(request, env, ctx);
}
__name(routeToCitationsService, "routeToCitationsService");
async function routeToJobsService(request, env, ctx) {
  const { jobsRouter: jobsRouter2 } = await Promise.resolve().then(() => (init_jobs(), jobs_exports));
  return jobsRouter2(request, env, ctx);
}
__name(routeToJobsService, "routeToJobsService");

// src/index.ts
var src_default2 = {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const headers = new Headers(request.headers);
    headers.set("X-Request-ID", requestId);
    const enrichedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body
    });
    enrichedRequest.env = env;
    enrichedRequest.ctx = ctx;
    enrichedRequest.requestId = requestId;
    enrichedRequest.startTime = startTime;
    try {
      if (request.method === "OPTIONS") {
        return corsMiddleware(request, env);
      }
      let response;
      const corsHeaders = getCorsHeaders(env);
      if (!request.url.includes("/health")) {
        const rateLimitResponse = await rateLimitMiddleware(enrichedRequest, env);
        if (rateLimitResponse) {
          return new Response(rateLimitResponse.body, {
            status: rateLimitResponse.status,
            headers: {
              ...Object.fromEntries(rateLimitResponse.headers),
              ...corsHeaders
            }
          });
        }
      }
      const isPublicRoute = isPublicEndpoint(request.url);
      if (!isPublicRoute) {
        const authResponse = await authMiddleware(enrichedRequest, env);
        if (authResponse instanceof Response) {
          return new Response(authResponse.body, {
            status: authResponse.status,
            headers: {
              ...Object.fromEntries(authResponse.headers),
              ...corsHeaders
            }
          });
        }
      }
      response = await router(enrichedRequest, env, ctx);
      const finalHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        finalHeaders.set(key, value);
      });
      finalHeaders.set("X-Request-ID", requestId);
      finalHeaders.set("X-Processing-Time", `${Date.now() - startTime}ms`);
      ctx.waitUntil(
        requestLogger(enrichedRequest, response, env, {
          requestId,
          processingTime: Date.now() - startTime
        })
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: finalHeaders
      });
    } catch (error) {
      console.error("Gateway error:", error);
      const errorResponse = errorHandler(error, requestId);
      return new Response(JSON.stringify(errorResponse), {
        status: errorResponse.status || 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(env),
          "X-Request-ID": requestId
        }
      });
    }
  }
};
function getCorsHeaders(env) {
  const allowedOrigins = env.ENVIRONMENT === "production" ? [
    "https://researchtoolspy.com",
    "https://www.researchtoolspy.com",
    "https://app.researchtoolspy.com"
  ] : ["http://localhost:3000", "http://localhost:3001"];
  return {
    "Access-Control-Allow-Origin": allowedOrigins[0],
    // TODO: Check origin header
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function isPublicEndpoint(url) {
  const publicPaths = [
    "/api/v1/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/anonymous",
    "/api/v1/public"
  ];
  const urlPath = new URL(url).pathname;
  return publicPaths.some((path) => urlPath.startsWith(path));
}
__name(isPublicEndpoint, "isPublicEndpoint");
async function handleHealthCheck(env) {
  const health = {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: env.ENVIRONMENT || "development",
    services: {
      database: "checking",
      cache: "checking",
      storage: "checking"
    }
  };
  try {
    const result = await env.DB.prepare("SELECT 1 as health").first();
    health.services.database = result ? "healthy" : "unhealthy";
  } catch (error) {
    health.services.database = "unhealthy";
    health.status = "degraded";
  }
  try {
    await env.SESSIONS.put("health-check", Date.now().toString(), {
      expirationTtl: 10
    });
    health.services.cache = "healthy";
  } catch (error) {
    health.services.cache = "unhealthy";
    health.status = "degraded";
  }
  if (env.DOCUMENTS) {
    try {
      await env.DOCUMENTS.head("health-check");
      health.services.storage = "healthy";
    } catch (error) {
      health.services.storage = error.message.includes("NoSuchKey") ? "healthy" : "unhealthy";
    }
  } else {
    health.services.storage = "not configured";
  }
  const statusCode = health.status === "healthy" ? 200 : 503;
  return new Response(JSON.stringify(health), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    }
  });
}
__name(handleHealthCheck, "handleHealthCheck");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-eX4cAX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default2;

// ../node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-eX4cAX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
  handleHealthCheck
};
//# sourceMappingURL=index.js.map
