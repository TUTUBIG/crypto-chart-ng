import {computed, effect, Injectable, signal} from '@angular/core';
import {Token} from '../types/token';
import {AuthService} from './auth.service';
import {API_CONFIG} from '../config/api.config';

// Backend API response structure
export interface WatchedTokenAPI {
  id: number;
  user_id: number;
  token_id: number;
  notes?: string;
  interval_1m?: number;
  interval_5m?: number;
  interval_15m?: number;
  interval_1h?: number;
  alert_active: boolean;
  created_at: string;
  // Token details from JOIN
  chain_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  decimals: number;
  icon_url?: string;
}

// Frontend display structure
export interface WatchlistToken {
  id: number; // watchlist entry ID (from watched_tokens table)
  token_id: number; // Token database ID - use this for identifying tokens internally
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  tokenAddress: string;
  chainId: string;
  change1m?: number;
  change5m?: number;
  change15m?: number;
  change1h?: number;
  alertEnabled: boolean;
  alertSettings?: AlertSettings;
  notes?: string;
  addedAt: Date;
}

export interface AlertSettings {
  interval_1m?: number;
  interval_5m?: number;
  interval_15m?: number;
  interval_1h?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  // Use a signal for reactive watchlist state
  private watchlistSignal = signal<WatchlistToken[]>([]);
  private isLoadingSignal = signal<boolean>(false);

  // Public readonly signals
  watchlist = this.watchlistSignal.asReadonly();
  isLoading = this.isLoadingSignal.asReadonly();

  // Computed signal for watchlist count
  watchlistCount = computed(() => this.watchlistSignal().length);

  constructor(private authService: AuthService) {
    // Load watchlist when user is authenticated
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadWatchlist();
      } else {
        this.watchlistSignal.set([]);
      }
    });
  }

  /**
   * Convert API response to frontend WatchlistToken
   */
  private mapApiToWatchlistToken(apiToken: WatchedTokenAPI): WatchlistToken {
    // Construct tokenId from chain_id and token_address
    return {
      id: apiToken.id,
      token_id: apiToken.token_id,
      symbol: apiToken.token_symbol,
      name: apiToken.token_name,
      price: 0, // Will be updated via WebSocket
      change24h: 0,
      volume24h: 0,
      tokenAddress: apiToken.token_address,
      chainId: apiToken.chain_id,
      alertEnabled: apiToken.alert_active,
      alertSettings: {
        interval_1m: apiToken.interval_1m,
        interval_5m: apiToken.interval_5m,
        interval_15m: apiToken.interval_15m,
        interval_1h: apiToken.interval_1h,
      },
      notes: apiToken.notes,
      addedAt: new Date(apiToken.created_at),
    };
  }

  /**
   * Load watchlist from API
   */
  async loadWatchlist(): Promise<void> {
    try {
      this.isLoadingSignal.set(true);

      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WATCHED_TOKENS}`
      );

      if (!response.ok) {
        new Error('Failed to load watchlist');
      }

      const result = await response.json();
      const watches = result.data.map((token: WatchedTokenAPI) => this.mapApiToWatchlistToken(token));
      this.watchlistSignal.set(watches);
    } catch (error) {
      console.error('Error loading watchlist:', error);
      this.watchlistSignal.set([]);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  /**
   * Add a token to the watchlist
   */
  async addToken(token: Token | Partial<WatchlistToken>, alertSettings?: AlertSettings, notes?: string): Promise<boolean> {
    try {
      if (!token) {
        console.error('Cannot add token: missing token');
        return false;
      }

      // Check if already in watchlist using token.id
      if (this.isInWatchlist(token.id!)) {
        return false;
      }

      const body: any = {
        token_id:token.id,
        notes,
        interval_1m: alertSettings?.interval_1m,
        interval_5m: alertSettings?.interval_5m,
        interval_15m: alertSettings?.interval_15m,
        interval_1h: alertSettings?.interval_1h,
        alertSettings: true
      };

      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WATCHED_TOKENS}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to add token:', error);
        return false;
      }

      // Reload watchlist to get the new token
      await this.loadWatchlist();
      return true;
    } catch (error) {
      console.error('Error adding token to watchlist:', error);
      return false;
    }
  }

  /**
   * Remove a token from the watchlist by token ID (numeric database ID)
   */
  async removeWatchToken(id: number): Promise<boolean> {
    try {
      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WATCHED_TOKEN_BY_ID(id)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        new Error('Failed to remove token');
      }

      // Update local state using token_id
      this.watchlistSignal.update(list => list.filter(t => t.id !== id));
      return true;
    } catch (error) {
      console.error('Error removing token from watchlist:', error);
      return false;
    }
  }

  /**
   * Check if a token is in the watchlist by token ID (numeric database ID)
   */
  isInWatchlist(tokenId: number): boolean {
    return this.watchlistSignal().some(t => t.token_id === tokenId);
  }

  /**
   * Get a specific token from watchlist by token ID (numeric database ID)
   */
  getToken(tokenId: number): WatchlistToken | undefined {
    return this.watchlistSignal().find(t => t.token_id === tokenId);
  }

  /**
   * Get a specific token from watchlist by API token ID (chain_id-address format)
   * Use this when you need to lookup by the API format string
   */
  getTokenByApiId(tokenId: number): WatchlistToken | undefined {
    return this.watchlistSignal().find(t => t.id === tokenId);
  }

  /**
   * Toggle alert for a token by token ID (numeric database ID)
   */
  async toggleWatchTokenAlert(id: number, alertEnable: boolean): Promise<boolean> {
    try {
      // Calculate the new state (toggled from current)
      const newAlertState = !alertEnable;

      // API expects the watchlist entry ID (id), not token_id
      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WATCHED_TOKEN_BY_ID(id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alert_active: newAlertState,
          }),
        }
      );

      if (!response.ok) {
        new Error('Failed to toggle alert');
      }

      // Update local state to match what was sent to API
      this.watchlistSignal.update(list => {
        return list.map(t => {
          if (t.id === id) {
            return {...t, alertEnabled: newAlertState};
          }
          return t;
        });
      });

      return true;
    } catch (error) {
      console.error('Error toggling alert:', error);
      return false;
    }
  }

  /**
   * Update alert settings for a token by token ID (numeric database ID)
   */
  async updateWatchTokenAlertSettings(id: number, settings: AlertSettings, notes?: string): Promise<boolean> {
    try {

      const body: any = {
        interval_1m: settings.interval_1m,
        interval_5m: settings.interval_5m,
        interval_15m: settings.interval_15m,
        interval_1h: settings.interval_1h,
      };

      if (notes !== undefined) {
        body.notes = notes;
      }

      const response = await this.authService.authenticatedFetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WATCHED_TOKEN_BY_ID(id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        new Error('Failed to update alert settings');
      }

      // Update local state using token_id
      this.watchlistSignal.update(list =>
        list.map(t =>
          (t.id === id)
            ? { ...t, alertSettings: settings, alertEnabled: true, notes }
            : t
        )
      );

      return true;
    } catch (error) {
      console.error('Error updating alert settings:', error);
      return false;
    }
  }

  /**
   * Update token price (for real-time updates) using API token ID format
   * Use this when receiving WebSocket updates that use the chain_id-address format
   */
  updateTokenPrice(tokenId: number, price: number, change24h?: number): void {
    this.watchlistSignal.update(list =>
      list.map(t =>
        (t.id === tokenId)
          ? { ...t, price, ...(change24h !== undefined && { change24h }) }
          : t
      )
    );
  }

  /**
   * Update token interval changes (for real-time updates) using API token ID format
   * Use this when receiving WebSocket updates that use the chain_id-address format
   */
  updateTokenIntervalChanges(tokenId: number, changes: {
    change1m?: number;
    change5m?: number;
    change15m?: number;
    change1h?: number;
  }): void {
    this.watchlistSignal.update(list =>
      list.map(t =>
        (t.id === tokenId)
          ? { ...t, ...changes }
          : t
      )
    );
  }

  /**
   * Clear entire watchlist
   */
  async clearWatchlist(): Promise<void> {
    if (!confirm('Are you sure you want to clear your entire watchlist?')) {
      return;
    }

    try {
      const tokens = this.watchlistSignal();

      // Delete all tokens using id
      await Promise.all(
        tokens.map(token => this.removeWatchToken(token.id))
      );

      this.watchlistSignal.set([]);
    } catch (error) {
      console.error('Error clearing watchlist:', error);
    }
  }

  /**
   * Get watchlist sorted by various criteria
   */
  getSortedWatchlist(sortBy: 'addedAt' | 'symbol' | 'price' | 'change24h' = 'addedAt'): WatchlistToken[] {
    const list = [...this.watchlistSignal()];

    switch (sortBy) {
      case 'symbol':
        return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
      case 'price':
        return list.sort((a, b) => b.price - a.price);
      case 'change24h':
        return list.sort((a, b) => b.change24h - a.change24h);
      case 'addedAt':
      default:
        return list.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    }
  }
}

