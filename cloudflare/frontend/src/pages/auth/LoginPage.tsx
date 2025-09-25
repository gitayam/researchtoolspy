import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, User, Hash } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

type LoginMode = 'email' | 'hash' | 'register_hash';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email/password login form
  const [emailForm, setEmailForm] = useState({
    username: '',
    password: '',
  });

  // Hash login form
  const [hashForm, setHashForm] = useState({
    account_hash: '',
  });

  // Get redirect path from location state or default to dashboard
  const redirectPath = location.state?.from?.pathname || '/dashboard';

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.login(emailForm);
      await login(response.user, response.tokens);

      toast.success(`Welcome back, ${response.user.full_name}!`);
      navigate(redirectPath, { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHashLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashForm.account_hash.trim()) {
      toast.error('Please enter your account hash');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.loginWithHash(hashForm);
      await login(response.user, response.tokens);

      toast.success(`Welcome back, ${response.user.full_name}!`);
      navigate(redirectPath, { replace: true });
    } catch (error: any) {
      console.error('Hash login error:', error);
      toast.error(error.message || 'Hash login failed. Please check your account hash.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateHash = async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.registerWithHash();

      // Auto-fill the hash form
      setHashForm({ account_hash: response.account_hash });
      setLoginMode('hash');

      toast.success('Account hash generated successfully!');

      // Show instructions
      toast(
        `Your account hash: ${response.account_hash}\n\nSave this securely - you'll need it to access your account.`,
        {
          duration: 10000,
          icon: '🔑',
        }
      );
    } catch (error: any) {
      console.error('Hash generation error:', error);
      toast.error(error.message || 'Failed to generate account hash');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Research Tools Platform
          </h1>
          <p className="text-gray-600">
            Professional intelligence analysis tools
          </p>
        </div>

        <Card className="p-6 shadow-lg">
          {/* Login Mode Tabs */}
          <div className="flex space-x-1 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setLoginMode('email')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'email'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="h-4 w-4 inline mr-1" />
              Email Login
            </button>
            <button
              onClick={() => setLoginMode('hash')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                loginMode === 'hash'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Hash className="h-4 w-4 inline mr-1" />
              Anonymous
            </button>
          </div>

          {/* Email/Password Login Form */}
          {loginMode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={emailForm.username}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email or username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={emailForm.password}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          )}

          {/* Hash Login Form */}
          {loginMode === 'hash' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Hash className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-gray-900">Anonymous Access</h3>
                <p className="text-sm text-gray-600">
                  Use your account hash for anonymous access
                </p>
              </div>

              <form onSubmit={handleHashLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Hash
                  </label>
                  <input
                    type="text"
                    required
                    value={hashForm.account_hash}
                    onChange={(e) => setHashForm({ account_hash: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter your account hash (64 characters)"
                    maxLength={64}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your unique 64-character account identifier
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Hash className="h-4 w-4 mr-2" />
                      Access Account
                    </>
                  )}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={handleGenerateHash}
                disabled={isLoading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Hash className="h-4 w-4 mr-2" />
                    Generate New Account Hash
                  </>
                )}
              </button>

              <div className="text-xs text-gray-500 text-center">
                <p>
                  <strong>Privacy Notice:</strong> Hash-based accounts provide anonymous access.
                  Save your hash securely - it cannot be recovered if lost.
                </p>
              </div>
            </div>
          )}

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            {loginMode === 'email' && (
              <>
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Sign up
                  </Link>
                </p>
                <p className="text-sm text-gray-600">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </p>
              </>
            )}

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}