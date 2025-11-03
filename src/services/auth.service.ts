import { Injectable, signal } from '@angular/core';
import { API_CONFIG } from '../config/api.config';

export interface User {
  id: number;
  email?: string;
  telegram_id?: string;
  telegram_username?: string;
  google_id?: string;
  apple_id?: string;
  x_id?: string;
  full_name?: string;
  avatar_url?: string;
  bot_started?: boolean;
  bot_started_at?: string;
  created_at: string;
  last_login_at?: string;
}

export interface AuthResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'user';

  // Signals for reactive state
  private isAuthenticatedSignal = signal<boolean>(this.hasValidToken());
  private currentUserSignal = signal<User | null>(this.loadUser());

  // Public readonly signals
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  currentUser = this.currentUserSignal.asReadonly();

  constructor() {
    // Load user on init
    this.loadUser();
  }

  /**
   * Check if user has a valid access token
   */
  private hasValidToken(): boolean {
    const token = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    return !!token;
  }

  /**
   * Load user from localStorage
   */
  private loadUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error);
    }
    return null;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Store authentication data
   */
  private storeAuth(data: AuthResponse): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));

    this.isAuthenticatedSignal.set(true);
    this.currentUserSignal.set(data.user);
  }

  /**
   * Clear authentication data
   */
  private clearAuth(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);

    this.isAuthenticatedSignal.set(false);
    this.currentUserSignal.set(null);
  }

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email: string, purpose: 'register' | 'login' | 'reset-password'): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_SEND_CODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, purpose }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send verification code' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending verification code:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Register with email and verification code
   */
  async register(email: string, password: string, verificationCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          verification_code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      this.storeAuth(data);
      return { success: true };
    } catch (error) {
      console.error('Error during registration:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Reset password with email, verification code, and new password
   */
  async resetPassword(email: string, verificationCode: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_RESET_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          verification_code: verificationCode,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Password reset failed' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error during password reset:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Login with email and password or verification code
   */
  async login(email: string, password?: string, verificationCode?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const body: any = { email };
      if (password) body.password = password;
      if (verificationCode) body.verification_code = verificationCode;

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      this.storeAuth(data);
      return { success: true };
    } catch (error) {
      console.error('Error during login:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      localStorage.setItem(this.ACCESS_TOKEN_KEY, data.access_token);
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearAuth();
      return false;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_LOGOUT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Get current user profile from server
   */
  async fetchUserProfile(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_ME}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry with new token
            return this.fetchUserProfile();
          }
        }
        return { success: false, error: data.error || 'Failed to fetch profile' };
      }

      this.currentUserSignal.set(data.user);
      localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Refresh current user data from server
   * Alias for fetchUserProfile() for better clarity
   */
  async refreshCurrentUser(): Promise<{ success: boolean; error?: string }> {
    return this.fetchUserProfile();
  }

  /**
   * Login with Telegram (or bind if already authenticated)
   * @param telegramAuthData - Telegram authentication data received from Telegram Login Widget
   * Should include: id, first_name, username (optional), photo_url (optional), auth_date, hash
   *
   * If user is authenticated (has JWT token), this will bind Telegram to their account
   * If user is not authenticated, this will log in/register with Telegram
   */
  async loginWithTelegram(telegramAuthData: any): Promise<{ success: boolean; error?: string; isBind?: boolean }> {
    try {
      // Validate required fields
      if (!telegramAuthData.id || !telegramAuthData.hash) {
        return { success: false, error: 'Invalid Telegram authentication data' };
      }

      const token = this.getAccessToken();
      const headers: any = {
        'Content-Type': 'application/json',
      };

      // If user is authenticated, include token for binding
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/telegram`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(telegramAuthData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Telegram operation failed' };
      }

      // If binding (user was already authenticated)
      if (data.message && data.message.includes('linked')) {
        // Update current user data
        if (data.user) {
          this.currentUserSignal.set(data.user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
        }
        return { success: true, isBind: true };
      }

      // If login/register (user was not authenticated)
      if (data.access_token) {
        this.storeAuth(data);
        return { success: true, isBind: false };
      }

      return { success: true };
    } catch (error) {
      console.error('Error during Telegram operation:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Bind Telegram account to current authenticated user
   * @param telegramAuthData - Telegram authentication data
   */
  async bindTelegram(telegramAuthData: any): Promise<{ success: boolean; error?: string }> {
    // This is just an alias for loginWithTelegram when authenticated
    // The backend will handle the binding logic based on JWT presence
    return this.loginWithTelegram(telegramAuthData);
  }

  /**
   * Initiate OAuth login with specified provider
   * @param provider - OAuth provider ('google', 'apple', 'x', 'telegram')
   */
  async loginWithOAuth(provider: 'google' | 'apple' | 'x' | 'telegram'): Promise<{ authUrl?: string; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/oauth/${provider}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || `Failed to initiate ${provider} login` };
      }

      return { authUrl: data.auth_url };
    } catch (error) {
      console.error(`Error initiating ${provider} login:`, error);
      return { error: 'Network error' };
    }
  }

  /**
   * Unbind Telegram from current user account
   */
  async unbindTelegram(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/telegram`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to unbind Telegram' };
      }

      // Update user data (remove Telegram info)
      const user = this.currentUserSignal();
      if (user) {
        const updatedUser = { ...user, telegram_id: undefined, telegram_username: undefined };
        this.currentUserSignal.set(updatedUser);
        localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      }

      return { success: true };
    } catch (error) {
      console.error('Error unbinding Telegram:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Mark that the user has started the Telegram bot
   */
  async markBotStarted(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getAccessToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/user/bot-started`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to mark bot as started' };
      }

      // Update user data
      const user = this.currentUserSignal();
      if (user) {
        const updatedUser = { ...user, bot_started: true, bot_started_at: new Date().toISOString() };
        this.currentUserSignal.set(updatedUser);
        localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking bot as started:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Make authenticated API request
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });

    // If 401, try to refresh token and retry
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newToken = this.getAccessToken();
        const newHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        };
        return fetch(url, { ...options, headers: newHeaders });
      } else {
        this.clearAuth();
        throw new Error('Authentication expired');
      }
    }

    return response;
  }
}

