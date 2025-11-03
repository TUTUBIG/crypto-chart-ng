import { Component, signal, OnInit, OnDestroy } from '@angular/core';
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
export class LoginComponent implements OnInit, OnDestroy {
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
    // OAuth callbacks are handled by the backend redirect
  }
  
  ngOnDestroy(): void {
    // Cleanup if needed
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

  async loginWithTelegram() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      const result = await this.authService.loginWithOAuth('telegram');
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        this.error.set('Failed to initiate Telegram login');
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error('Error during Telegram login:', error);
      this.error.set('Failed to initiate Telegram login');
      this.isLoading.set(false);
    }
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

