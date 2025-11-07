import { Component, signal, computed, OnInit, OnDestroy, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { API_CONFIG } from '../../../config/api.config';

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  // Get user from AuthService
  currentUser = computed(() => this.authService.currentUser());

  // Notification preferences
  emailNotifications = signal<boolean | null>(null);
  telegramNotifications = signal<boolean | null>(null);
  preferencesLoaded = signal(false);

  // UI states
  showTelegramGuide = signal(false);
  isUnlinkingTelegram = signal(false);
  isPollingBotStatus = signal(false);
  pollingMessage = signal<string>('');

  // Telegram bot info
  readonly TELEGRAM_BOT_USERNAME = 'fipulse_bot'; // Replace with actual bot username

  // Long polling for bot status
  private pollingInterval?: any;
  private pollingTimeout?: any;
  private readonly POLLING_INTERVAL = 3000; // Poll every 3 seconds
  private readonly POLLING_MAX_DURATION = 120000; // Stop after 2 minutes

  constructor(
    private authService: AuthService
  ) {
    // Watch for connection status changes and load widget when ready
    // effect() must be called in constructor (injection context)
    effect(() => {
      const isLinked = this.isTelegramLinked;

      if (!isLinked) {
        // Load widget when Telegram is not linked
        setTimeout(() => this.loadTelegramWidgetForIntegration(), 300);
      }
    });
  }

  ngOnInit(): void {
    this.loadNotificationPreferences();

    // Set up global callback for Telegram binding
    window.onTelegramAuth = (user: any) => {
      this.handleTelegramBinding(user);
    };
  }

  ngAfterViewInit(): void {
    // Load widget if Telegram is not linked after view is initialized
    // Use a delay to ensure Angular has fully rendered the conditional content
    setTimeout(() => {
      if (!this.isTelegramLinked) {
        this.loadTelegramWidgetForIntegration();
      }
    }, 300);
  }

  ngOnDestroy(): void {
    // Clean up global callback
    delete window.onTelegramAuth;

    // Stop long polling if active
    this.stopPollingBotStatus();
  }

  get isTelegramLinked(): boolean {
    return !!(this.currentUser()?.telegram_id);
  }

  get isBotReady(): boolean {
    const botStarted = this.currentUser()?.bot_started;
    // Handle both boolean and number (0/1) formats
    return this.isTelegramLinked && botStarted === true;
  }

  get isBotStarted(): boolean {
    const botStarted = this.currentUser()?.bot_started;
    // Handle both boolean and number (0/1) formats
    return botStarted === true;
  }

  /**
   * Get Telegram bot deep link with user ID for automatic account binding
   * Format: https://t.me/bot_username?start=userid_{user_id}
   */
  get telegramBotLink(): string {
    const userId = this.currentUser()?.id;
    if (userId) {
      // Encode user ID in the start parameter so bot can auto-link the account
      return `https://t.me/${this.TELEGRAM_BOT_USERNAME}?start=${userId}`;
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
        this.emailNotifications.set(data.email_enabled ?? false);
        this.telegramNotifications.set(data.telegram_enabled ?? false);
        this.preferencesLoaded.set(true);
      } else if (response.status === 404) {
        // Endpoint not available yet, use default values (disabled)
        console.log('[Profile] Notification preferences endpoint not available, using defaults');
        this.emailNotifications.set(false);
        this.telegramNotifications.set(false);
        this.preferencesLoaded.set(true);
      } else {
        console.error('[Profile] Failed to load notification preferences:', response.status, response.statusText);
        // Set defaults on error (disabled)
        this.emailNotifications.set(false);
        this.telegramNotifications.set(false);
        this.preferencesLoaded.set(true);
      }
    } catch (error) {
      // Handle network errors gracefully
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        console.log('[Profile] Not authenticated, skipping notification preferences load');
      } else {
        console.error('[Profile] Error loading notification preferences:', error);
      }
      // Set defaults on error (disabled)
      this.emailNotifications.set(false);
      this.telegramNotifications.set(false);
      this.preferencesLoaded.set(true);
    }
  }

  async updateNotificationPreference(type: 'email' | 'telegram', enabled: boolean, event?: Event): Promise<void> {
    try {
      // Check if user is trying to enable this method while another is already enabled
      if (enabled) {
        const otherType = type === 'email' ? 'telegram' : 'email';
        const otherEnabled = type === 'email' ? this.telegramNotifications() : this.emailNotifications();

        if (otherEnabled) {
          // Prevent the toggle from changing
          if (event && event.target) {
            (event.target as HTMLInputElement).checked = false;
          }
          
          // Revert UI state immediately without API call
          if (type === 'email') {
            this.emailNotifications.set(false);
          } else {
            this.telegramNotifications.set(false);
          }
          
          // Alert user that they need to disable the other method first
          alert(
            `⚠️ Only one notification method can be enabled at a time.\n\n` +
            `Please disable ${otherType === 'email' ? 'Email' : 'Telegram'} notifications first before enabling ` +
            `${type === 'email' ? 'Email' : 'Telegram'} notifications.`
          );
          return;
        }
      }

      // Update UI state immediately for better UX
      if (type === 'email') {
        this.emailNotifications.set(enabled);
      } else {
        this.telegramNotifications.set(enabled);
      }

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
        const data = await response.json();
        // Update both states based on server response to ensure sync
        this.emailNotifications.set(data.email_enabled ?? false);
        this.telegramNotifications.set(data.telegram_enabled ?? false);

        console.log(`[Profile] ${type} notifications ${enabled ? 'enabled' : 'disabled'}`);

        // Show success message
        if (enabled) {
          alert(`✅ ${type === 'email' ? 'Email' : 'Telegram'} notifications enabled successfully!`);
        }
      } else if (response.status === 404) {
        // Endpoint not available yet, keep local state but warn user
        console.warn(`[Profile] Notification preferences endpoint not available. Preference saved locally only.`);
      } else {
        // Try to get error message from response
        let errorMessage = `Failed to update notification preferences. Please try again.`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If response is not JSON, use default message
        }
        
        console.error(`[Profile] Failed to update ${type} notification preference:`, response.status, response.statusText);
        // Revert on error
        await this.loadNotificationPreferences();
        alert(`❌ ${errorMessage}`);
      }
    } catch (error) {
      // Handle network errors
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        console.warn('[Profile] Not authenticated, cannot save notification preferences');
        alert('❌ You must be logged in to update notification preferences.');
      } else {
        console.error(`[Profile] Error updating ${type} notification preference:`, error);
        alert('❌ An error occurred. Please try again.');
      }
      // Revert to server state on error
      await this.loadNotificationPreferences();
    }
  }

  private loadTelegramWidget(): void {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', this.TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'medium');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
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
        alert('❌ ' + (result.error || 'Failed to bind Telegram account'));
      }

    } catch (error) {
      console.error('Error binding Telegram:', error);
      alert('Error binding Telegram account');
    }
  }

  toggleTelegramGuide(): void {
    this.showTelegramGuide.update(v => !v);
  }

  private loadTelegramWidgetForIntegration(): void {
    // Check conditions before trying to load
    if (this.isTelegramLinked) {
      console.log('[Profile] Telegram already linked, skipping widget load');
      return;
    }

    const container = document.getElementById('telegram-integration-widget-container');
    if (!container) {
      console.warn('[Profile] Widget container not found, retrying in 500ms...');
      // Retry with longer delay if container doesn't exist yet
      setTimeout(() => this.loadTelegramWidgetForIntegration(), 500);
      return;
    }

    // Check if widget already loaded (prevent duplicate loading)
    if (container.querySelector('script[src*="telegram-widget"]') || container.children.length > 0) {
      console.log('[Profile] Telegram widget already loaded');
      return;
    }

    console.log('[Profile] Loading Telegram widget for integration...');

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
      console.error('[Profile] Failed to load Telegram widget script');
    };

    script.onload = () => {
      console.log('[Profile] Telegram widget script loaded successfully');
    };

    container.appendChild(script);
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

  formatBotStartedDate(dateString?: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Start long polling to check bot started status
   * Called when user clicks "Start bot" button
   * Polls the backend every 3 seconds to detect when bot_started becomes true
   */
  startPollingBotStatus(): void {
    // Don't start if already polling
    if (this.isPollingBotStatus()) {
      console.log('[Profile] Already polling, skipping');
      return;
    }

    // Don't start if bot is already started
    if (this.isBotStarted) {
      console.log('[Profile] Bot already started, skipping polling');
      return;
    }

    console.log('[Profile] Starting long polling for bot status (polls every 3s for up to 2 minutes)');
    this.isPollingBotStatus.set(true);
    this.pollingMessage.set('Waiting for bot start...');

    const startTime = Date.now();

    // Start polling interval
    this.pollingInterval = setInterval(async () => {
      try {
        // Check if max duration exceeded
        const elapsed = Date.now() - startTime;
        if (elapsed >= this.POLLING_MAX_DURATION) {
          console.log('[Profile] Polling timeout reached');
          this.stopPollingBotStatus();
          this.pollingMessage.set('Timeout: Please try refreshing the page or contact support.');
          return;
        }

        // Poll user profile to check bot_started status
        const result = await this.authService.fetchUserProfile();

        if (result.success) {
          const user = this.authService.currentUser();

          // Check if bot is started (handle both boolean and number formats)
          const botStarted = user?.bot_started;
          if (botStarted === true) {
            console.log('[Profile] ✅ Bot started detected via polling!');
            this.stopPollingBotStatus();
            this.pollingMessage.set('✅ Bot is now connected and ready!');

            // Load widget after user data is updated
            setTimeout(() => this.loadTelegramWidgetForIntegration(), 300);

            // Clear the message after a short delay
            setTimeout(() => {
              this.pollingMessage.set('');
            }, 3000);
          } else {
            // Still waiting, update message
            const elapsedSeconds = Math.floor(elapsed / 1000);
            this.pollingMessage.set(`Checking... (${elapsedSeconds}s)`);
          }
        } else {
          console.error('[Profile] Failed to fetch user profile:', result.error);
        }
      } catch (error) {
        console.error('[Profile] Error during polling:', error);
      }
    }, this.POLLING_INTERVAL);

    // Set timeout to stop polling after max duration
    this.pollingTimeout = setTimeout(() => {
      if (this.isPollingBotStatus()) {
        console.log('[Profile] Polling stopped due to timeout');
        this.stopPollingBotStatus();
        this.pollingMessage.set('Timeout: Please try refreshing the page.');
      }
    }, this.POLLING_MAX_DURATION);
  }

  /**
   * Stop long polling for bot status
   */
  stopPollingBotStatus(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = undefined;
    }

    this.isPollingBotStatus.set(false);
  }

  /**
   * Handle click on "Start bot" button
   * Opens Telegram and starts long polling to detect when bot is started
   */
  onStartBotClick(): void {
    console.log('[Profile] User clicked Start Bot button - starting long polling');

    // Start long polling to check bot_started status
    this.startPollingBotStatus();

    // The link will open Telegram in a new tab
    // Long polling will continue in the background to detect when bot is started
  }
}

