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
  
  readonly TELEGRAM_BOT_USERNAME = 'fipulse_bot';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Load Telegram Widget script
    this.loadTelegramWidget();
    
    // Set up global callback for Telegram auth
    window.onTelegramAuth = (user: any) => {
      this.handleTelegramAuth(user);
    };
  }
  
  ngOnDestroy(): void {
    // Clean up global callback
    delete window.onTelegramAuth;
  }
  
  private loadTelegramWidget(): void {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', this.TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    
    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
    }
  }
  
  private async handleTelegramAuth(telegramUser: any): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      console.log('Telegram auth data:', telegramUser);
      
      // Use AuthService to handle Telegram login
      const result = await this.authService.loginWithTelegram(telegramUser);
      
      if (result.success) {
        this.successMessage.set('Login successful via Telegram!');
        
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      } else {
        this.error.set(result.error || 'Telegram login failed');
      }
      
    } catch (error) {
      console.error('Error during Telegram login:', error);
      this.error.set('Network error during Telegram login');
    } finally {
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

