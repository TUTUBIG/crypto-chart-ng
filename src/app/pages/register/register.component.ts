import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  verificationCode = signal('');
  
  isLoading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  codeSent = signal(false);
  countdown = signal(0);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async sendCode() {
    const emailValue = this.email();
    if (!emailValue || !this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    const passwordValue = this.password();
    if (!passwordValue || passwordValue.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    const confirmPasswordValue = this.confirmPassword();
    if (passwordValue !== confirmPasswordValue) {
      this.error.set('Passwords do not match');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.sendVerificationCode(emailValue, 'register');

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

  async register() {
    const emailValue = this.email();
    const passwordValue = this.password();
    const confirmPasswordValue = this.confirmPassword();
    const codeValue = this.verificationCode();
    
    if (!emailValue || !this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    if (!passwordValue || passwordValue.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    if (passwordValue !== confirmPasswordValue) {
      this.error.set('Passwords do not match');
      return;
    }

    if (!codeValue || codeValue.length !== 6) {
      this.error.set('Please enter a valid 6-digit verification code');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.register(emailValue, passwordValue, codeValue);

    if (result.success) {
      this.successMessage.set('Registration successful! Redirecting...');
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1000);
    } else {
      this.error.set(result.error || 'Registration failed');
    }

    this.isLoading.set(false);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

