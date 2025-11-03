import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  email = signal('');
  verificationCode = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  
  step = signal<'email' | 'reset'>('email'); // email step or reset step
  isLoading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  codeSent = signal(false);
  countdown = signal(0);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

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

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.sendVerificationCode(emailValue, 'reset-password');

    if (result.success) {
      this.codeSent.set(true);
      this.step.set('reset');
      this.successMessage.set('Verification code sent to your email');
      this.startCountdown();
    } else {
      this.error.set(result.error || 'Failed to send verification code');
    }

    this.isLoading.set(false);
  }

  async resendCode() {
    if (this.countdown() > 0) return;
    await this.sendCode();
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

  async resetPassword() {
    const emailValue = this.email();
    const codeValue = this.verificationCode();
    const passwordValue = this.newPassword();
    const confirmPasswordValue = this.confirmPassword();

    // Validation
    if (!emailValue || !this.isValidEmail(emailValue)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    if (!codeValue || codeValue.length !== 6) {
      this.error.set('Please enter a valid 6-digit verification code');
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

    this.isLoading.set(true);
    this.error.set(null);

    const result = await this.authService.resetPassword(
      emailValue,
      codeValue,
      passwordValue
    );

    if (result.success) {
      this.successMessage.set('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } else {
      this.error.set(result.error || 'Failed to reset password');
    }

    this.isLoading.set(false);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  goBack() {
    if (this.step() === 'reset') {
      this.step.set('email');
      this.verificationCode.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.error.set(null);
      this.successMessage.set(null);
    } else {
      this.router.navigate(['/login']);
    }
  }
}

