import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { API_CONFIG } from '../../../config/api.config';

declare global {
  interface Window {
    onTelegramAuthProfile?: (user: any) => void;
  }
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  // Get user from AuthService
  currentUser = computed(() => this.authService.currentUser());

  // Notification preferences
  emailNotifications = signal(true);
  telegramNotifications = signal(false);

  // UI states
  showTelegramGuide = signal(false);
  isUnlinkingTelegram = signal(false);

  // Telegram bot info
  readonly TELEGRAM_BOT_USERNAME = 'fipulse_bot'; // Replace with actual bot username
  
  constructor(private authService: AuthService) {}
  
  ngOnInit(): void {
    this.loadNotificationPreferences();
    
    // Load Telegram Widget if not connected
    if (!this.isTelegramConnected) {
      setTimeout(() => this.loadTelegramWidget(), 100);
    }
    
    // Set up global callback for Telegram binding
    window.onTelegramAuthProfile = (user: any) => {
      this.handleTelegramBinding(user);
    };
  }
  
  ngOnDestroy(): void {
    // Clean up global callback
    delete window.onTelegramAuthProfile;
  }
  
  get isTelegramConnected(): boolean {
    return !!(this.currentUser()?.telegram_id && this.currentUser()?.telegram_username);
  }
  
  /**
   * Get Telegram bot deep link with user ID for automatic account binding
   * Format: https://t.me/bot_username?start=userid_{user_id}
   */
  get telegramBotLink(): string {
    const userId = this.currentUser()?.id;
    if (userId) {
      // Encode user ID in the start parameter so bot can auto-link the account
      return `https://t.me/${this.TELEGRAM_BOT_USERNAME}?start=userid_${userId}`;
    }
    return `https://t.me/${this.TELEGRAM_BOT_USERNAME}`;
  }

  async loadNotificationPreferences(): Promise<void> {
    try {
      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}/user/notification-preferences`
      );

      if (response.ok) {
        const data = await response.json();
        this.emailNotifications.set(data.email_enabled ?? true);
        this.telegramNotifications.set(data.telegram_enabled ?? false);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  }

  async updateNotificationPreference(type: 'email' | 'telegram', enabled: boolean): Promise<void> {
    try {
      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}/user/notification-preferences`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [`${type}_enabled`]: enabled
          })
        }
      );

      if (response.ok) {
        if (type === 'email') {
          this.emailNotifications.set(enabled);
        } else {
          this.telegramNotifications.set(enabled);
        }
        console.log(`${type} notifications ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error(`Error updating ${type} notification preference:`, error);
    }
  }

  private loadTelegramWidget(): void {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', this.TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuthProfile(user)');
    script.setAttribute('data-request-access', 'write');
    
    const container = document.getElementById('telegram-bind-container');
    if (container) {
      // Clear existing content
      container.innerHTML = '';
      container.appendChild(script);
    }
  }
  
  private async handleTelegramBinding(telegramUser: any): Promise<void> {
    try {
      console.log('Binding Telegram account:', telegramUser);
      
      // Use AuthService to bind Telegram account
      const result = await this.authService.bindTelegram(telegramUser);
      
      if (result.success) {
        alert('✅ Telegram account linked successfully!');
        // Refresh user profile to get updated info
        await this.authService.fetchUserProfile();
      } else {
        alert('Failed to bind Telegram: ' + (result.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Error binding Telegram:', error);
      alert('Error binding Telegram account');
    }
  }

  toggleTelegramGuide(): void {
    this.showTelegramGuide.update(v => !v);
  }

  async unlinkTelegram(): Promise<void> {
    if (!confirm('Are you sure you want to unlink your Telegram account? You will stop receiving Telegram alerts.')) {
      return;
    }

    this.isUnlinkingTelegram.set(true);

    try {
      // Use AuthService to unbind Telegram
      const result = await this.authService.unbindTelegram();

      if (result.success) {
        alert('✅ Telegram account unlinked successfully');
        // Refresh user profile
        await this.authService.fetchUserProfile();
      } else {
        alert('Failed to unlink Telegram: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error unlinking Telegram:', error);
      alert('Error unlinking Telegram account');
    } finally {
      this.isUnlinkingTelegram.set(false);
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  }
}

