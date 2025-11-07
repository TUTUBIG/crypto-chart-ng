import { Component, signal, computed, OnInit, OnDestroy, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { WebSocketService } from '../../../services/websocket.service';
import { API_CONFIG } from '../../../config/api.config';
import { Subscription } from 'rxjs';

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
  
  // WebSocket subscription
  private botStartedSubscription?: Subscription;
  
  // Long polling for bot status
  private pollingInterval?: any;
  private pollingTimeout?: any;
  private readonly POLLING_INTERVAL = 3000; // Poll every 3 seconds
  private readonly POLLING_MAX_DURATION = 120000; // Stop after 2 minutes

  constructor(
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadNotificationPreferences();

    // Set up global callback for Telegram binding
    window.onTelegramAuth = (user: any) => {
      this.handleTelegramBinding(user);
    };
    
    // Subscribe to bot_started WebSocket events
    this.subscribeToBotStartedEvents();

    // Watch for connection status changes and load widget when ready
    effect(() => {
      const isConnected = this.isTelegramConnected;
      
      if (!isConnected) {
        // Load widget when Telegram is not connected
        setTimeout(() => this.loadTelegramWidgetForIntegration(), 300);
      }
    });
  }

  ngAfterViewInit(): void {
    // Load widget if Telegram is not connected after view is initialized
    // Use a delay to ensure Angular has fully rendered the conditional content
    setTimeout(() => {
      if (!this.isTelegramConnected) {
        this.loadTelegramWidgetForIntegration();
      }
    }, 300);
  }

  ngOnDestroy(): void {
    // Clean up global callback
    delete window.onTelegramAuth;
    
    // Unsubscribe from WebSocket events
    if (this.botStartedSubscription) {
      this.botStartedSubscription.unsubscribe();
    }
    
    // Stop long polling if active
    this.stopPollingBotStatus();
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

  async updateNotificationPreference(type: 'email' | 'telegram', enabled: boolean): Promise<void> {
    try {
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
        console.log(`[Profile] ${type} notifications ${enabled ? 'enabled' : 'disabled'}`);
      } else if (response.status === 404) {
        // Endpoint not available yet, keep local state but warn user
        console.warn(`[Profile] Notification preferences endpoint not available. Preference saved locally only.`);
        // Revert to previous state if needed, or keep the local change
        // For now, we'll keep the local change
      } else {
        console.error(`[Profile] Failed to update ${type} notification preference:`, response.status, response.statusText);
        // Optionally revert on error
        // if (type === 'email') {
        //   this.emailNotifications.set(!enabled);
        // } else {
        //   this.telegramNotifications.set(!enabled);
        // }
      }
    } catch (error) {
      // Handle network errors
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        console.warn('[Profile] Not authenticated, cannot save notification preferences');
      } else {
        console.error(`[Profile] Error updating ${type} notification preference:`, error);
      }
      // UI state was already updated, so it remains changed
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
    if (this.isTelegramConnected) {
      console.log('[Profile] Telegram already connected, skipping widget load');
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
   * Subscribe to bot_started WebSocket events
   * Listens for real-time updates when user starts the bot
   */
  private subscribeToBotStartedEvents(): void {
    console.log('[Profile] Subscribing to bot_started WebSocket events...');
    
    this.botStartedSubscription = this.wsService.onBotStarted$().subscribe(async (event) => {
      console.log('[Profile] Bot started event received:', event);
      
      // Check if this event is for the current user
      if (event.user_id === this.currentUser()?.id) {
        console.log('[Profile] Bot started for current user! Refreshing user data...');
        
        // Refresh user data to get updated bot_started status
        await this.authService.refreshCurrentUser();
        
        // Stop polling since bot is now started
        this.stopPollingBotStatus();
        
        // Load widget after user data is refreshed
        setTimeout(() => this.loadTelegramWidgetForIntegration(), 300);
        
        // Show success message (optional)
        console.log('[Profile] ✅ Bot is now connected and ready!');
      }
    });
  }

  /**
   * Start long polling to check bot started status
   * Called when user clicks "Start bot" button
   */
  startPollingBotStatus(): void {
    // Don't start if already polling
    if (this.isPollingBotStatus()) {
      return;
    }

    // Don't start if bot is already started
    if (this.currentUser()?.bot_started) {
      return;
    }

    console.log('[Profile] Starting long polling for bot status...');
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
          
          if (user?.bot_started) {
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
   * Opens Telegram and starts polling
   */
  onStartBotClick(): void {
    // Start polling when user clicks the button
    this.startPollingBotStatus();
    
    // The link will open Telegram in a new tab
    // Polling will continue in the background
  }
}

