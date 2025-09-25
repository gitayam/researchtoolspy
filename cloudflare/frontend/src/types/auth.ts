// User roles
export enum UserRole {
  ADMIN = 'admin',
  ANALYST = 'analyst',
  USER = 'user',
  GUEST = 'guest',
}

// Base user interface
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  account_hash?: string; // For hash-based authentication
  created_at: string;
  updated_at: string;
}

// Authentication tokens
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Login request (email/password)
export interface LoginRequest {
  username: string;
  password: string;
}

// Login response
export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Registration request
export interface RegisterRequest {
  username: string;
  email: string;
  full_name: string;
  password: string;
}

// Hash-based authentication request
export interface HashLoginRequest {
  account_hash: string;
}

// Refresh token request
export interface RefreshTokenRequest {
  refresh_token: string;
}

// User profile update request
export interface UserUpdateRequest {
  full_name?: string;
  email?: string;
}

// Password change request
export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset confirm request
export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

// Email verification request
export interface EmailVerificationRequest {
  token: string;
}

// Account hash registration response
export interface HashRegistrationResponse {
  account_hash: string;
  message: string;
  warning: string;
  created_at: string;
}

// Auth context/store types
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Permission helpers
export const hasPermission = (user: User | null, requiredRole: UserRole): boolean => {
  if (!user) return false;

  const roleHierarchy = {
    [UserRole.GUEST]: 0,
    [UserRole.USER]: 1,
    [UserRole.ANALYST]: 2,
    [UserRole.ADMIN]: 3,
  };

  const userLevel = roleHierarchy[user.role as UserRole] ?? -1;
  const requiredLevel = roleHierarchy[requiredRole] ?? 999;

  return userLevel >= requiredLevel;
};

export const canAccessFramework = (user: User | null, frameworkType?: string): boolean => {
  if (!user) return false;

  // All authenticated users can access basic frameworks
  if (user.role === UserRole.ADMIN || user.role === UserRole.ANALYST) {
    return true;
  }

  // Regular users have limited access to certain frameworks
  const publicFrameworks = [
    'swot',
    'pest',
    'stakeholder',
    'starbursting',
    'trend'
  ];

  return frameworkType ? publicFrameworks.includes(frameworkType.toLowerCase()) : true;
};

export const canExportReports = (user: User | null): boolean => {
  return hasPermission(user, UserRole.ANALYST);
};

export const canShareReports = (user: User | null): boolean => {
  return hasPermission(user, UserRole.USER);
};

export const canManageUsers = (user: User | null): boolean => {
  return hasPermission(user, UserRole.ADMIN);
};