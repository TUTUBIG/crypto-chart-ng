import {
  Candle,
  RealTimeTrade,
  ChartData,
  ChartConfig,
  WebSocketConfig,
  ApiConfig,
  SubscriptionStatus,
  ChartUpdateCallback,
  TradeCallback,
  ErrorCallback,
  ConnectionCallback
} from './types';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';

/**
 * CryptoChartSDK - Main SDK class that orchestrates data fetching and real-time updates
 */
export class CryptoChartSDK {
  private apiService: ApiService;
  private wsService: WebSocketService;
  private chartConfig: ChartConfig;

  // State
  private candles: Candle[] = [];
  private lastUpdate: Date | null = null;
  private isLoading = false;
  private error: string | null = null;
  private currentTokenId: string | null = null;
  private updateInterval: number | null = null;

  // Callbacks
  private onChartUpdateCallback: ChartUpdateCallback | null = null;
  private onTradeCallback: TradeCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private onConnectionChangeCallback: ConnectionCallback | null = null;

  constructor(
    apiService: ApiService,
    apiConfig: ApiConfig,
    wsConfig: WebSocketConfig,
    chartConfig: ChartConfig = {}
  ) {
    this.apiService = apiService;
    this.apiService.initialize(apiConfig);
    this.wsService = new WebSocketService(wsConfig);
    this.chartConfig = {
      maxCandles: 1000,
      updateInterval: 60000, // 1 minute
      autoScroll: true,
      ...chartConfig
    };

    this.setupWebSocketCallbacks();
  }

  /**
   * Initialize the SDK with a token ID
   * @param tokenId - The token ID to initialize with
   * @param connectWebSocket - Whether to connect to WebSocket immediately (default: true)
   */
  async initialize(tokenId: string, connectWebSocket: boolean = true): Promise<void> {
    // Set token ID FIRST, before any async operations
    console.log('[SDK] Setting currentTokenId to:', tokenId);
    this.currentTokenId = tokenId;
    this.isLoading = true;
    this.error = null;

    // Clear old candles immediately to prevent trades from updating wrong token's data
    console.log('[SDK] Clearing old candles (had', this.candles.length, 'candles)');
    this.candles = [];

    try {
      // Fetch historical data
      console.log('[SDK] Fetching historical candles for tokenId:', this.currentTokenId);
      const historicalCandles = await this.apiService.fetchHistoryCandles(tokenId);
      console.log('[SDK] Received', historicalCandles.length, 'candles');
      this.candles = historicalCandles;
      this.lastUpdate = new Date();

      // Verify token ID is still set after async operation
      console.log('[SDK] After fetching, currentTokenId is:', this.currentTokenId);

      // Set up periodic updates
      this.startPeriodicUpdates();

      this.notifyChartUpdate();

      // Start WebSocket connection (optional, can be deferred)
      if (connectWebSocket) {
        console.log('[SDK] Starting WebSocket connection...');
        this.wsService.startConnection();
      } else {
        console.log('[SDK] Skipping WebSocket connection (will connect later)');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to initialize SDK';
      this.notifyError(this.error);
    } finally {
      this.isLoading = false;
      console.log('[SDK] Initialize complete. currentTokenId:', this.currentTokenId);
    }
  }

  /**
   * Connect to WebSocket (call this after initialize if you passed connectWebSocket: false)
   */
  connectWebSocket(): void {
    console.log('[SDK] Starting WebSocket connection...');
    this.wsService.startConnection();
  }

  /**
   * Subscribe to real-time data
   * @param tokenId - Optional token ID to subscribe to (uses currentTokenId if not provided)
   */
  subscribe(tokenId?: string): void {
    const targetTokenId = tokenId || this.currentTokenId;
    console.log('[SDK] subscribe() called. tokenId param:', tokenId, 'currentTokenId:', this.currentTokenId, 'using:', targetTokenId);

    if (!targetTokenId) {
      console.error('[SDK] subscribe() failed: No token ID set');
      this.notifyError('No token ID set. Call initialize() first.');
      return;
    }

    if (!this.wsService.isConnected()) {
      console.error('[SDK] subscribe() failed: WebSocket not connected');
      this.notifyError('WebSocket is not connected');
      return;
    }

    // Update currentTokenId if a specific tokenId was provided
    if (tokenId) {
      console.log('[SDK] Updating currentTokenId from', this.currentTokenId, 'to', tokenId);
      this.currentTokenId = tokenId;
    }

    console.log('[SDK] Subscribing to tokenId:', targetTokenId);
    this.wsService.subscribe(targetTokenId);
  }

  /**
   * Unsubscribe from real-time data
   */
  unsubscribe(): void {
    this.wsService.unsubscribe();
  }

  /**
   * Get current chart data
   */
  getChartData(): ChartData {
    return {
      candles: [...this.candles],
      lastUpdate: this.lastUpdate,
      isLoading: this.isLoading,
      error: this.error
    };
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(): SubscriptionStatus {
    const wsStatus = this.wsService.getSubscriptionStatus();
    return {
      isConnected: this.wsService.isConnected(),
      isSubscribed: wsStatus.isSubscribed,
      subscribeId: wsStatus.subscribeId,
      lastTradeTime: this.lastUpdate
    };
  }

  /**
   * Update chart configuration
   */
  updateChartConfig(newConfig: Partial<ChartConfig>): void {
    this.chartConfig = { ...this.chartConfig, ...newConfig };

    // Update max candles if changed
    if (newConfig.maxCandles && this.candles.length > newConfig.maxCandles) {
      this.candles = this.candles.slice(-newConfig.maxCandles);
      this.notifyChartUpdate();
    }

    // Update interval if changed
    if (newConfig.updateInterval !== undefined) {
      this.startPeriodicUpdates();
    }
  }

  /**
   * Update API configuration
   */
  updateApiConfig(newConfig: Partial<ApiConfig>): void {
    this.apiService.updateConfig(newConfig);
  }

  /**
   * Update WebSocket configuration
   */
  updateWebSocketConfig(newConfig: Partial<WebSocketConfig>): void {
    this.wsService.updateConfig(newConfig);
  }

  /**
   * Set event callbacks
   */
  onChartUpdate(callback: ChartUpdateCallback): void {
    this.onChartUpdateCallback = callback;
  }

  onTrade(callback: TradeCallback): void {
    this.onTradeCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  onConnectionChange(callback: ConnectionCallback): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Manually clean up old data
   * Removes candles that cannot be updated (too old or exceed max limit)
   * @param olderThanHours - Remove candles older than this many hours (default: 24)
   */
  cleanupOldData(olderThanHours: number = 24): void {
    if (this.candles.length === 0) return;

    const beforeCount = this.candles.length;
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (olderThanHours * 60 * 60);

    // Remove old candles
    this.candles = this.candles.filter(candle => candle.Timestamp >= cutoffTimestamp);

    // Also enforce max candles limit
    const maxCandles = this.chartConfig.maxCandles || 1000;
    if (this.candles.length > maxCandles) {
      this.candles = this.candles.slice(-maxCandles);
    }

    const removedCount = beforeCount - this.candles.length;
    if (removedCount > 0) {
      console.log(`🗑️  [SDK] Manual cleanup: Removed ${removedCount} old candles (kept ${this.candles.length})`);
      this.notifyChartUpdate();
    } else {
      console.log(`✓ [SDK] No old data to clean up (all ${this.candles.length} candles are recent)`);
    }
  }

  /**
   * Cleanup and disconnect
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.wsService.disconnect();
    this.candles = [];
    this.lastUpdate = null;
    this.isLoading = false;
    this.error = null;
    this.currentTokenId = null;
  }

  // Private methods

  private setupWebSocketCallbacks(): void {
    this.wsService.onTrade((trade: RealTimeTrade) => {
      this.handleRealTimeTrade(trade);
      this.onTradeCallback?.(trade);
    });

    this.wsService.onError((error: string) => {
      this.error = error;
      this.notifyError(error);
    });

    this.wsService.onConnect(() => {
      this.notifyConnectionChange('connected');
    });

    this.wsService.onDisconnect(() => {
      this.notifyConnectionChange('disconnected');
    });

    this.wsService.onSubscription((subscribeId: string) => {
      console.log('Subscription status changed:', subscribeId ? 'subscribed' : 'unsubscribed');
    });
  }

  private handleRealTimeTrade(trade: RealTimeTrade): void {
    console.log('📊 [SDK] Real-time trade received:', {
      tradeTime: trade.TradeTime,
      price: trade.Price,
      usd: trade.USD,
      amount: trade.Amount,
      currentCandleCount: this.candles.length
    });
    const now = new Date();
    this.lastUpdate = now;

    // If no candles exist yet, trades are still being captured by the trade callback
    // but we can't update candles until they're loaded
    if (this.candles.length === 0) {
      console.log('⚠️  [SDK] No candles loaded yet - trade received but cannot update candles (data still loading)');
      // Don't return - let the trade callback fire so UI can update price display
      // The candle will be updated by the next periodic refresh
      return;
    }

    // Calculate the minute timestamp for the trade (round down to nearest minute)
    const tradeMinuteTimestamp = Math.floor(trade.TradeTime / 60) * 60;
    const latestCandle = this.candles[this.candles.length - 1];
    const latestCandleTimestamp = latestCandle.Timestamp;

    console.log('🕐 [SDK] Timestamp comparison:', {
      tradeTime: trade.TradeTime,
      tradeMinuteTimestamp: tradeMinuteTimestamp,
      latestCandleTimestamp: latestCandleTimestamp,
      difference: tradeMinuteTimestamp - latestCandleTimestamp,
      match: tradeMinuteTimestamp === latestCandleTimestamp
    });

    // Check if trade belongs to the latest candle or is within a reasonable time window
    // Allow trades that are in the current minute or slightly ahead (up to 2 minutes)
    const timeDiff = tradeMinuteTimestamp - latestCandleTimestamp;
    const isCurrentOrRecentCandle = timeDiff >= 0 && timeDiff <= 120; // Within 2 minutes

    if (isCurrentOrRecentCandle) {
      // Update existing candle with trade data
      const updatedCandle: Candle = {
        ...latestCandle,
        ClosePrice: trade.Price, // Update close price with trade price
        HighPrice: Math.max(latestCandle.HighPrice, trade.Price), // Update high if trade price is higher
        LowPrice: Math.min(latestCandle.LowPrice, trade.Price), // Update low if trade price is lower
        VolumeIn: latestCandle.VolumeIn + trade.USD, // Add to volume in
        VolumeOut: latestCandle.VolumeOut + trade.Amount, // Add to volume out
      };

      // Replace the latest candle with updated one
      this.candles[this.candles.length - 1] = updatedCandle;

      console.log('✅ [SDK] Updated latest candle with trade:', {
        tradeTime: trade.TradeTime,
        tradeMinuteTimestamp: tradeMinuteTimestamp,
        candleTimestamp: latestCandleTimestamp,
        newClosePrice: trade.Price,
        oldClosePrice: latestCandle.ClosePrice,
        timeDiff: timeDiff
      });

      // Notify chart to update
      this.notifyChartUpdate();
    } else if (timeDiff < 0) {
      // Trade is older than our oldest relevant data
      // Cannot update oldest data, so remove stale candles
      console.log('🗑️  [SDK] Trade is too old - removing outdated candles:', {
        tradeMinuteTimestamp: tradeMinuteTimestamp,
        latestCandleTimestamp: latestCandleTimestamp,
        timeDiff: timeDiff
      });

      // Remove candles that are older than what we should keep
      // Keep only recent candles within a reasonable timeframe
      const cutoffTimestamp = tradeMinuteTimestamp - (60 * 60); // Keep 1 hour of data minimum
      const beforeCount = this.candles.length;
      this.candles = this.candles.filter(candle => candle.Timestamp >= cutoffTimestamp);

      if (this.candles.length !== beforeCount) {
        console.log(`🗑️  [SDK] Removed ${beforeCount - this.candles.length} outdated candles (kept ${this.candles.length})`);
        this.notifyChartUpdate();
      }
    } else {
      // Trade is too far in the future (>2min ahead)
      console.log('⏭️  [SDK] Ignoring future trade - too far ahead:', {
        tradeMinuteTimestamp: tradeMinuteTimestamp,
        latestCandleTimestamp: latestCandleTimestamp,
        timeDiff: timeDiff
      });
      return;
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.chartConfig.updateInterval && this.currentTokenId) {
      this.updateInterval = window.setInterval(async () => {
        await this.fetchLatestCandle();
      }, this.chartConfig.updateInterval);
    }
  }

  private async fetchLatestCandle(): Promise<void> {
    if (!this.currentTokenId) return;

    try {
      console.log('🔄 [SDK] Fetching latest candle for tokenId:', this.currentTokenId);
      const newCandle = await this.apiService.fetchSingleCandle(this.currentTokenId);

      if (!newCandle) {
        console.log('⚠️  [SDK] No new candle data received from API');
        return;
      }

      console.log('📊 [SDK] Received candle:', {
        timestamp: newCandle.Timestamp,
        close: newCandle.ClosePrice,
        open: newCandle.OpenPrice,
        high: newCandle.HighPrice,
        low: newCandle.LowPrice
      });

      // Check if we already have a candle for this timestamp
      const existingIndex = this.candles.findIndex(
        candle => candle.Timestamp === newCandle.Timestamp
      );

      if (existingIndex >= 0) {
        // Update existing candle (same time period, new data)
        const oldCandle = this.candles[existingIndex];
        this.candles[existingIndex] = newCandle;
        console.log(`📝 [SDK] Updated existing candle at index ${existingIndex}:`, {
          timestamp: newCandle.Timestamp,
          oldClose: oldCandle.ClosePrice,
          newClose: newCandle.ClosePrice
        });
      } else {
        // Add new candle (new time period)
        this.candles.push(newCandle);
        console.log(`➕ [SDK] Added NEW candle at index ${this.candles.length - 1}:`, {
          timestamp: newCandle.Timestamp,
          close: newCandle.ClosePrice,
          totalCandles: this.candles.length
        });

        // Ensure candles are sorted by timestamp (ascending)
        this.candles.sort((a, b) => a.Timestamp - b.Timestamp);
        console.log(`📊 [SDK] Candles sorted, total count: ${this.candles.length}`);
      }

      // Remove old data that cannot be updated
      // Keep only recent candles within the configured limit
      const maxCandles = this.chartConfig.maxCandles || 1000;
      if (this.candles.length > maxCandles) {
        const beforeCount = this.candles.length;
        this.candles = this.candles.slice(-maxCandles);
        console.log(`🗑️  [SDK] Pruned ${beforeCount - this.candles.length} old candles (keeping latest ${maxCandles})`);
      }

      // Also remove candles that are too old (older than 24 hours)
      const cutoffTimestamp = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      const beforePruneCount = this.candles.length;
      this.candles = this.candles.filter(candle => candle.Timestamp >= cutoffTimestamp);
      if (this.candles.length !== beforePruneCount) {
        console.log(`🗑️  [SDK] Removed ${beforePruneCount - this.candles.length} stale candles (older than 24h)`);
      }

      this.lastUpdate = new Date();
      this.notifyChartUpdate();
    } catch (err) {
      console.error('❌ [SDK] Error fetching latest candle:', err);
    }
  }

  private notifyChartUpdate(): void {
    const chartData = this.getChartData();
    console.log('🔔 SDK: Notifying chart update with', chartData.candles.length, 'candles');
    if (chartData.candles.length > 0) {
      const latestCandle = chartData.candles[chartData.candles.length - 1];
      console.log('   Latest candle:', {
        timestamp: latestCandle.Timestamp,
        close: latestCandle.ClosePrice,
        high: latestCandle.HighPrice,
        low: latestCandle.LowPrice
      });
    }
    this.onChartUpdateCallback?.(chartData);
  }

  private notifyError(error: string): void {
    this.onErrorCallback?.(error);
  }

  private notifyConnectionChange(status: 'connecting' | 'connected' | 'disconnected'): void {
    this.onConnectionChangeCallback?.(status);
  }
}

