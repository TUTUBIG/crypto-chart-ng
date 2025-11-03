import { Component, signal, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { API_CONFIG } from '../../../config/api.config';

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {
  email = signal('');
  password = signal('');
  verificationCode = signal('');
  
  usePasswordless = signal(false);
  isLoading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  codeSent = signal(false);
  countdown = signal(0);
  showPassword = signal(false);
  
  readonly TELEGRAM_BOT_USERNAME = 'fipulse_bot';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Set up global callback for Telegram login
    window.onTelegramAuth = (user: any) => {
      this.handleTelegramLogin(user);
    };
  }
  
  ngAfterViewInit(): void {
    // Load Telegram widget after view is initialized
    setTimeout(() => {
      this.loadTelegramWidget();
    }, 300);
  }
  
  ngOnDestroy(): void {
    // Clean up global callback
    delete window.onTelegramAuth;
  }

  async loginWithGoogle() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      const result = await this.authService.loginWithOAuth('google');
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        this.error.set('Failed to initiate Google login');
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error('Error during Google login:', error);
      this.error.set('Failed to initiate Google login');
      this.isLoading.set(false);
    }
  }

  async loginWithApple() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      const result = await this.authService.loginWithOAuth('apple');
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        this.error.set('Failed to initiate Apple login');
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error('Error during Apple login:', error);
      this.error.set('Failed to initiate Apple login');
      this.isLoading.set(false);
    }
  }

  async loginWithX() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      const result = await this.authService.loginWithOAuth('x');
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        this.error.set('Failed to initiate X login');
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error('Error during X login:', error);
      this.error.set('Failed to initiate X login');
      this.isLoading.set(false);
    }
  }

  async handleTelegramLogin(telegramUser: any): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      console.log('[Login] Telegram auth received:', telegramUser);
      
      const result = await this.authService.loginWithTelegram(telegramUser);
      
      if (result.success) {
        this.successMessage.set('Login successful!');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      } else {
        this.error.set(result.error || 'Failed to login with Telegram');
      }
    } catch (error) {
      console.error('[Login] Error during Telegram login:', error);
      this.error.set('Failed to login with Telegram');
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadTelegramWidget(): void {
    const container = document.getElementById('telegram-login-widget-container');
    if (!container) {
      console.warn('[Login] Widget container not found, retrying in 500ms...');
      setTimeout(() => this.loadTelegramWidget(), 500);
      return;
    }

    // Check if widget already loaded (prevent duplicate loading)
    if (container.querySelector('script[src*="telegram-widget"]') || container.children.length > 0) {
      console.log('[Login] Telegram widget already loaded');
      return;
    }

    console.log('[Login] Loading Telegram widget...');

    // Clear existing content
    container.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', this.TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'medium');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    
    script.onerror = () => {
      console.error('[Login] Failed to load Telegram widget script');
    };

    script.onload = () => {
      console.log('[Login] Telegram widget script loaded successfully');
    };

    container.appendChild(script);
  }

  async toggleLoginMethod() {
    this.usePasswordless.update(v => !v);
    this.error.set(null);
    this.codeSent.set(false);
    this.verificationCode.set('');
  }

  async sendCode() {
    const emailValue = this.email();
    if (!emailValue || !this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.sendVerificationCode(emailValue, 'login');

    if (result.success) {
      this.codeSent.set(true);
      this.successMessage.set('Verification code sent to your email');
      this.startCountdown();
    } else {
      this.error.set(result.error || 'Failed to send verification code');
    }

    this.isLoading.set(false);
  }

  private startCountdown() {
    this.countdown.set(60);
    const interval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        clearInterval(interval);
        this.countdown.set(0);
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  async login() {
    const emailValue = this.email();
    
    if (!emailValue || !this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    if (this.usePasswordless()) {
      const codeValue = this.verificationCode();
      if (!codeValue || codeValue.length !== 6) {
        this.error.set('Please enter a valid 6-digit verification code');
        return;
      }
    } else {
      const passwordValue = this.password();
      if (!passwordValue || passwordValue.length < 8) {
        this.error.set('Password must be at least 8 characters');
        return;
      }
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = this.usePasswordless()
      ? await this.authService.login(emailValue, undefined, this.verificationCode())
      : await this.authService.login(emailValue, this.password(), undefined);

    if (result.success) {
      this.successMessage.set('Login successful!');
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 500);
    } else {
      this.error.set(result.error || 'Login failed');
    }

    this.isLoading.set(false);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

