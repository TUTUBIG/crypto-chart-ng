import {
  Component,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  Output,
  EventEmitter,
  AfterViewInit,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  UTCTimestamp,
  CandlestickSeries,
  HistogramSeries,
  HistogramData,
  ColorType
} from 'lightweight-charts';
import {
  CryptoChartSDK,
  ChartData,
  Candle,
  RealTimeTrade
} from '@fipulse/crypto-chart-sdk';
import { formatVolume } from '@fipulse/crypto-chart-sdk';
import { AngularHttpClient } from '../../../sdk/angular-http-client';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-crypto-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './crypto-chart.component.html',
  styleUrls: ['./crypto-chart.component.scss']
})
export class CryptoChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLDivElement>;

  // Required props
  @Input() tokenId!: string; // API token ID format: {chain_id}-{lowercase_token_address}

  // Optional display props
  @Input() symbol!: string;
  @Input() title?: string;
  @Input() height?: number; // Optional - will use container height if not provided
  @Input() width?: number; // Optional - will use container width if not provided

  // Widget configuration
  @Input() showControls: boolean = false;
  @Input() showStatus: boolean = false;
  @Input() showVolume: boolean = false;
  @Input() autoConnect: boolean = true;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() customLogoUrl?: string; // Custom logo URL to replace TradingView attribution logo

  // Event emitters
  @Output() onError = new EventEmitter<string>();
  @Output() onDataUpdate = new EventEmitter<ChartData>();
  @Output() onTrade = new EventEmitter<RealTimeTrade>();
  @Output() onConnectionChange = new EventEmitter<'connecting' | 'connected' | 'disconnected'>();

  // Component state
  chart: IChartApi | null = null;
  candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  volumeSeries: ISeriesApi<'Histogram'> | null = null;
  sdk: CryptoChartSDK | null = null;
  legendElement: HTMLElement | null = null;
  chartData: ChartData = {
    candles: [],
    lastUpdate: null,
    isLoading: true,
    error: null
  };
  currentPrice: number | null = null;
  priceChange: number | null = null;
  priceDirection: 'up' | 'down' | null = null;
  isWebSocketConnected: boolean = false;
  chartTheme: 'light' | 'dark' = 'light'; // Internal chart theme (independent of widget theme)
  private previousPrice: number | null = null;
  private previousCandleCount: number = 0;
  private isInitialLoad: boolean = true;
  private isInitialized: boolean = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private httpClient: AngularHttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeSDK();
  }

  ngAfterViewInit(): void {
    // Initialize chart theme from widget theme
    this.chartTheme = this.theme;
    this.initializeChart();
    this.setupResizeObserver();
    if (this.sdk) {
      this.loadTokenData(this.tokenId);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.legendElement && this.legendElement.parentElement) {
      this.legendElement.parentElement.removeChild(this.legendElement);
      this.legendElement = null;
    }
    if (this.sdk) {
      this.sdk.destroy();
    }
    if (this.chart) {
      this.chart.remove();
    }
  }

  private initializeSDK(): void {
    console.log('Step 1: Creating SDK instance and WebSocket connection');

    this.sdk = new CryptoChartSDK(
      {
        baseUrl: API_CONFIG.BASE_URL,
        timeouts: {
          httpRequest: API_CONFIG.TIMEOUTS.HTTP_REQUEST,
          websocketConnect: API_CONFIG.TIMEOUTS.WEBSOCKET_CONNECT
        },
        endpoints: {
          historyCandles: API_CONFIG.ENDPOINTS.HISTORY_CANDLES,
          singleCandle: API_CONFIG.ENDPOINTS.SINGLE_CANDLE,
          websocket: API_CONFIG.ENDPOINTS.WEBSOCKET
        }
      },
      {
        url: API_CONFIG.ENDPOINTS.WEBSOCKET,
        reconnectDelay: API_CONFIG.WEBSOCKET.RECONNECT_DELAY,
        maxReconnectAttempts: API_CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS,
        heartbeatInterval: API_CONFIG.WEBSOCKET.HEARTBEAT_INTERVAL
      },
      {
        maxCandles: API_CONFIG.CHART.MAX_CANDLES,
        autoScroll: true
      },
      this.httpClient
    );

    // Set up SDK callbacks
    console.log('🔧 Setting up SDK callbacks');
    this.sdk.onChartUpdate((data: ChartData) => {
      console.log('🔄 SDK callback triggered: onChartUpdate with', data.candles.length, 'candles');
      this.handleChartUpdate(data);
    });
    this.sdk.onTrade((trade: RealTimeTrade) => {
      console.log('🔄 SDK callback triggered: onTrade with price', trade.Price);
      this.handleTrade(trade);
    });
    this.sdk.onError((error: string) => this.handleError(error));
    this.sdk.onConnectionChange((status: 'connecting' | 'connected' | 'disconnected') => this.handleConnectionChange(status));

    // Step 2: Connect to WebSocket immediately
    console.log('Step 2: Connecting to WebSocket...');
    this.sdk.connectWebSocket();
  }

  private initializeChart(): void {
    if (!this.chartContainer) return;

    const isDark = this.chartTheme === 'dark';
    const containerEl = this.chartContainer.nativeElement;

    // Create new chart
    this.chart = createChart(containerEl, {
      layout: {
        background: { color: isDark ? '#1a1a1a' : '#ffffff' },
        textColor: isDark ? '#ffffff' : '#333333',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
        horzLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDark ? '#666666' : '#cccccc',
          width: 1,
        },
        horzLine: {
          color: isDark ? '#666666' : '#cccccc',
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? '#444444' : '#cccccc',
        scaleMargins: {
          top: 0.3,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: isDark ? '#444444' : '#cccccc',
        timeVisible: true,
      }
    });

    // Create candlestick series
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: isDark ? '#00d4aa' : '#26a69a',
      downColor: isDark ? '#ff6b6b' : '#ef5350',
      borderVisible: false,
      wickUpColor: isDark ? '#00d4aa' : '#26a69a',
      wickDownColor: isDark ? '#ff6b6b' : '#ef5350',
    },0);

    // Create volume series using panes (separate price scale)
    if (this.showVolume) {
      // Create volume series with its own price scale (creates separate pane)
      this.volumeSeries = this.chart.addSeries(HistogramSeries, {
        color: isDark ? '#26a69a80' : '#26a69a40', // Default color (will be overridden per data point)
        priceFormat: {
          type: 'volume',
        },
      },1);
      this.chart.panes()[0].setStretchFactor(0.9)
      this.chart.panes()[1].setStretchFactor(0.1)
    }

    // Setup legend using lightweight-charts crosshair API
    const legend = document.createElement('div');
    legend.style = `position: absolute;
      left: 12px;
      top: 12px;
      z-index: 10;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      pointer-events: none;
      user-select: none;
      padding: 10px 14px;
      background: ${isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      border-radius: 8px;
      box-shadow: 0 2px 12px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'};
      min-width: 180px;`;
    containerEl.appendChild(legend);
  }

  private setupLegend(): void {
    if (!this.chartContainer || !this.chart) return;

    const containerEl = this.chartContainer.nativeElement;
    const isDark = this.chartTheme === 'dark';

    // Create legend element
    this.legendElement = document.createElement('div');
    this.legendElement.className = 'chart-legend';
    this.legendElement.style.cssText = `
      position: absolute;
      left: 12px;
      top: 12px;
      z-index: 10;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      pointer-events: none;
      user-select: none;
      padding: 10px 14px;
      background: ${isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      border-radius: 8px;
      box-shadow: 0 2px 12px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'};
      min-width: 180px;
    `;
    containerEl.appendChild(this.legendElement);

    // Subscribe to crosshair moves to update legend
    this.chart.subscribeCrosshairMove((param) => {
      this.updateLegend(param);
    });

    // Initial legend update
    this.updateLegend(null);
  }

  private updateLegend(crosshairParam: any): void {
    if (!this.legendElement || !this.chart) return;

    const isDark = this.chartTheme === 'dark';

    // Get token name
    const tokenName = this.title || this.symbol || 'Token';

    // Get real-time price
    const price = this.currentPrice !== null ? this.formatPrice(this.currentPrice) : '--';

    // Get 24h rate
    const rate24h = this.priceChange !== null ? this.formatPercentage(this.priceChange) : '--';
    const rateColor = this.priceChange !== null
      ? (this.priceChange >= 0
        ? (isDark ? '#00d4aa' : '#26a69a')
        : (isDark ? '#ff6b6b' : '#ef5350'))
      : (isDark ? '#999' : '#666');

    // Get OHLC and Volume from crosshair if available
    let ohlcHtml = '';
    let candleChangeHtml = '';
    let candleFluctuationHtml = '';

    if (crosshairParam && crosshairParam.time && crosshairParam.seriesData && this.candlestickSeries) {
      const data = crosshairParam.seriesData.get(this.candlestickSeries) as CandlestickData | undefined;
      if (data) {
        // Find the corresponding candle to get volume and calculate metrics
        let volume = null;
        let matchingCandle: Candle | undefined;
        const crosshairTime = crosshairParam.time as number;

        // Match crosshair time with candle timestamp (accounting for timezone conversion)
        matchingCandle = this.chartData.candles.find((candle: Candle) => {
          const utcTimestamp = candle.Timestamp;
          const utcDate = new Date(utcTimestamp * 1000);
          const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
          const localTimestamp = utcTimestamp - timezoneOffsetSeconds;
          // Match within 60 seconds tolerance (for minute candles)
          return Math.abs(localTimestamp - crosshairTime) < 60;
        });

        if (matchingCandle) {
          volume = matchingCandle.VolumeIn; // Use VolumeIn (USD volume)

          // Calculate price change rate for this candle (open to close)
          const candleChange = matchingCandle.OpenPrice > 0
            ? ((matchingCandle.ClosePrice - matchingCandle.OpenPrice) / matchingCandle.OpenPrice) * 100
            : 0;
          const candleChangeFormatted = this.formatPercentage(candleChange);
          const candleChangeColor = candleChange >= 0
            ? (isDark ? '#00d4aa' : '#26a69a')
            : (isDark ? '#ff6b6b' : '#ef5350');

          candleChangeHtml = `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: ${isDark ? '#999' : '#666'}; font-size: 11px;">Change:</span>
              <span style="font-weight: 500; font-size: 11px; color: ${candleChangeColor};">${candleChangeFormatted}</span>
            </div>
          `;

          // Calculate price fluctuation (violation rate) for this candle
          // Fluctuation = (high - low) / open * 100
          const candleFluctuation = matchingCandle.OpenPrice > 0
            ? ((matchingCandle.HighPrice - matchingCandle.LowPrice) / matchingCandle.OpenPrice) * 100
            : 0;
          const candleFluctuationFormatted = this.formatPercentage(candleFluctuation);
          const fluctuationColor = isDark ? '#ffa726' : '#ff9800'; // Orange color

          candleFluctuationHtml = `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: ${isDark ? '#999' : '#666'}; font-size: 11px;">Fluctuation:</span>
              <span style="font-weight: 500; font-size: 11px; color: ${fluctuationColor};">${candleFluctuationFormatted}</span>
            </div>
          `;
        }

        const openColor = isDark ? '#999' : '#666';
        const highColor = isDark ? '#00d4aa' : '#26a69a';
        const lowColor = isDark ? '#ff6b6b' : '#ef5350';
        const closeColor = isDark ? '#64b5f6' : '#2196f3';
        const volumeColor = isDark ? '#999' : '#666';

        const volumeHtml = volume !== null
          ? `<div><span style="color: ${volumeColor};">V</span> <span style="color: ${isDark ? '#fff' : '#333'};">$${formatVolume(volume)}</span></div>`
          : '';

        ohlcHtml = `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isDark ? '#333' : '#e0e0e0'};">
            <div style="display: flex; gap: 12px; font-size: 11px; flex-wrap: wrap; margin-bottom: 6px;">
              <div><span style="color: ${openColor};">O</span> <span style="color: ${isDark ? '#fff' : '#333'};">${this.formatPrice(data.open)}</span></div>
              <div><span style="color: ${highColor};">H</span> <span style="color: ${highColor};">${this.formatPrice(data.high)}</span></div>
              <div><span style="color: ${lowColor};">L</span> <span style="color: ${lowColor};">${this.formatPrice(data.low)}</span></div>
              <div><span style="color: ${closeColor};">C</span> <span style="color: ${closeColor};">${this.formatPrice(data.close)}</span></div>
              ${volumeHtml}
            </div>
            ${candleChangeHtml}
            ${candleFluctuationHtml}
          </div>
        `;
      }
    }

    // Update legend HTML
    const textColor = isDark ? '#fff' : '#333';
    const labelColor = isDark ? '#999' : '#666';
    const priceColor = this.priceDirection === 'up'
      ? (isDark ? '#00d4aa' : '#26a69a')
      : this.priceDirection === 'down'
      ? (isDark ? '#ff6b6b' : '#ef5350')
      : (isDark ? '#64b5f6' : '#2196f3');

    this.legendElement.innerHTML = `
      <div style="font-weight: 700; font-size: 14px; color: ${textColor}; margin-bottom: 4px;">${tokenName}</div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="color: ${labelColor}; font-size: 12px;">Price:</span>
        <span style="font-weight: 600; font-size: 16px; color: ${priceColor};">$${price}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="color: ${labelColor}; font-size: 11px;">24h:</span>
          <span style="font-weight: 500; font-size: 11px; color: ${rateColor};">${rate24h}</span>
        </div>
      </div>
      ${ohlcHtml}
    `;
  }

  private setupResizeObserver(): void {
    if (!this.chartContainer) return;

    const containerEl = this.chartContainer.nativeElement;

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === containerEl) {
          this.resizeChart();
        }
      }
    });

    this.resizeObserver.observe(containerEl);
  }

  private resizeChart(): void {
    if (!this.chart || !this.chartContainer) return;

    const containerEl = this.chartContainer.nativeElement;
    const containerRect = containerEl.getBoundingClientRect();

    // Use provided width/height or container dimensions
    const newWidth = this.width || containerRect.width || 800;
    const newHeight = this.height || containerRect.height || 600;

    // Only resize if dimensions are valid
    if (newWidth > 0 && newHeight > 0) {
      this.chart.applyOptions({
        width: newWidth,
        height: newHeight,
      });
    }
  }

  private async loadTokenData(tokenId: string): Promise<void> {
    if (!this.sdk) {
      console.error('SDK not initialized');
      return;
    }

    console.log('Step 3: Loading data for tokenId:', tokenId);

    // Reset to initial load mode for new token
    this.isInitialLoad = true;
    this.previousCandleCount = 0;

    try {
      // Show loading state
      console.log('Step 4: Showing skeleton chart (loading state)');
      this.chartData = { candles: [], lastUpdate: null, isLoading: true, error: null };

      // Unsubscribe from previous token if any
      this.sdk.unsubscribe();

      // Step 5: Fetch historical candlestick data
      console.log('Step 5: Fetching historical candlestick data for tokenId:', tokenId);
      await this.sdk.initialize(tokenId, false); // false = don't connect WebSocket (already connected)
      console.log('Step 6: Historical data fetched, rendering candlesticks');

      // At this point, the chart should have data and be rendered
      this.isInitialized = true;

      // Step 7: Wait for WebSocket connection and subscribe to real-time data
      if (this.autoConnect) {
        setTimeout(async () => {
          if (!this.sdk) return;

          console.log('Step 7: Waiting for WebSocket connection...');
          const isConnected = await this.waitForWebSocketConnection(this.sdk);

          if (isConnected && this.sdk) {
            console.log('Step 8: WebSocket connected, subscribing to real-time data for tokenId:', tokenId);
            this.sdk.subscribe(tokenId);
          } else {
            console.error('Step 8: Failed to connect to WebSocket, cannot subscribe');
            this.chartData = {
              ...this.chartData,
              error: 'WebSocket connection failed. Real-time updates unavailable.'
            };
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to load token data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load token data';
      this.chartData = { ...this.chartData, error: errorMessage, isLoading: false };
    }
  }

  private async waitForWebSocketConnection(sdk: CryptoChartSDK, maxWaitMs: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkConnection = () => {
        const status = sdk.getSubscriptionStatus();
        if (status.isConnected) {
          console.log('WebSocket is connected and ready');
          resolve(true);
          return;
        }

        if (Date.now() - startTime > maxWaitMs) {
          console.error('WebSocket connection timeout');
          resolve(false);
          return;
        }

        // Check again in 100ms
        setTimeout(checkConnection, 100);
      };

      checkConnection();
    });
  }

  private handleChartUpdate(data: ChartData): void {
    console.log('📥 Component: Received chart update from SDK with', data.candles.length, 'candles');

    if (data.candles.length > 0) {
      const latestCandle = data.candles[data.candles.length - 1];
      console.log('   Latest candle in update:', {
        timestamp: latestCandle.Timestamp,
        open: latestCandle.OpenPrice,
        high: latestCandle.HighPrice,
        low: latestCandle.LowPrice,
        close: latestCandle.ClosePrice
      });
    }

    // Ensure loading is set to false when we receive data
    const updatedData = {
      ...data,
      isLoading: data.candles.length === 0 && !data.error
    };

    this.chartData = updatedData;

    // Determine if this is an incremental update or full refresh
    const previousCount = this.previousCandleCount;
    const currentCount = updatedData.candles.length;
    const candleCountDiff = currentCount - previousCount;

    console.log('   Candle count: previous =', previousCount, ', current =', currentCount, ', diff =', candleCountDiff);

    // Define threshold for incremental updates
    const MAX_INCREMENTAL_CANDLES = 50;

      // Incremental update: Allow same count (update), new candles, or gaps
      const isIncrementalUpdate = !this.isInitialLoad &&
                                  currentCount > 0 &&
                                  candleCountDiff >= 0 &&
                                  candleCountDiff <= MAX_INCREMENTAL_CANDLES;

      if (isIncrementalUpdate && updatedData.candles.length > 0) {
        if (candleCountDiff === 0) {
          // Update existing candle (same timestamp, updated OHLC values)
          const latestCandle = updatedData.candles[updatedData.candles.length - 1];
          this.updateSingleCandle(latestCandle);
          console.log('📊 Chart: Updated existing candle at', latestCandle.Timestamp, 'Close:', latestCandle.ClosePrice);
        } else if (candleCountDiff === 1) {
          // Add single new candle (new timestamp)
          const latestCandle = updatedData.candles[updatedData.candles.length - 1];
          this.updateSingleCandle(latestCandle);
          console.log('➕ Chart: Added NEW candle at', latestCandle.Timestamp, 'Close:', latestCandle.ClosePrice, 'Total:', currentCount);
        } else if (candleCountDiff > 1 && candleCountDiff <= MAX_INCREMENTAL_CANDLES) {
          // Multiple new candles added - do full refresh to ensure proper rendering
          // Using full refresh for multiple candles is more reliable than incremental updates
          console.log(`➕ Chart: Adding ${candleCountDiff} new candles via full refresh`);
          this.updateChart(updatedData);
          console.log(`➕ Chart: Added ${candleCountDiff} new candles. Total: ${currentCount}`);
        } else {
          // Large gap detected - do full refresh
          this.updateChart(updatedData);
          console.log(`📊 Chart: Large gap refresh - added ${candleCountDiff} new candles`);
        }
      } else {
        // Full refresh
        this.updateChart(updatedData);
        this.isInitialLoad = false;
        console.log('📊 Chart: Full refresh with', currentCount, 'candles');
      }

    this.previousCandleCount = currentCount;

    // Calculate price change and volume
    if (updatedData.candles.length > 0) {
      const latestCandle = updatedData.candles[updatedData.candles.length - 1];
      const firstCandle = updatedData.candles[0];

      // Update current price if not already updated by real-time trade
      this.currentPrice = latestCandle.ClosePrice;

      // Initialize previous price ref if not set
      if (this.previousPrice === null) {
        this.previousPrice = latestCandle.ClosePrice;
      }

      // Calculate price change from the first candle (24h change)
      const change = ((latestCandle.ClosePrice - firstCandle.OpenPrice) / firstCandle.OpenPrice) * 100;
      this.priceChange = change;
    }

    // Update legend when data changes
    this.updateLegend(null);

    this.onDataUpdate.emit(updatedData);
    this.cdr.detectChanges();
  }

  private handleTrade(trade: RealTimeTrade): void {
    console.log('💰 Real-time trade received in UI:', trade.Price);

    // Update current price immediately
    const newPrice = trade.Price;
    const oldPrice = this.previousPrice;

    this.currentPrice = newPrice;
    this.previousPrice = newPrice;

    // Determine price direction
    if (oldPrice !== null && newPrice !== oldPrice) {
      this.priceDirection = newPrice > oldPrice ? 'up' : 'down';

      // Reset direction after animation
      setTimeout(() => {
        this.priceDirection = null;
        this.cdr.detectChanges();
      }, 1000);
    }

    // Update legend when price changes
    this.updateLegend(null);

    // Update the latest candle on the chart with real-time trade data
    if (this.chartData.candles.length > 0) {
      const latestCandle = this.chartData.candles[this.chartData.candles.length - 1];

      // Calculate the minute timestamp for the trade
      const tradeMinuteTimestamp = Math.floor(trade.TradeTime / 60) * 60;
      const latestCandleTimestamp = latestCandle.Timestamp;

      // Check if trade belongs to the current candle
      // Note: SDK handles candle creation, component only visualizes
      const timeDiff = tradeMinuteTimestamp - latestCandleTimestamp;

      console.log('💰 Component: Processing trade with timeDiff:', timeDiff, 'seconds');

      // Only handle exact matches or very recent trades (within 2 minutes)
      // Let SDK handle everything else (SDK has authoritative data)
      const isExactOrVeryRecent = timeDiff >= 0 && timeDiff <= 120;

      if (isExactOrVeryRecent) {
        console.log('✅ Component: Trade within range - updating visualization immediately');
        // Update the latest candle with the trade data for immediate visual feedback
        const updatedCandle: Candle = {
          ...latestCandle,
          ClosePrice: trade.Price,
          HighPrice: Math.max(latestCandle.HighPrice, trade.Price),
          LowPrice: Math.min(latestCandle.LowPrice, trade.Price),
          VolumeIn: latestCandle.VolumeIn + trade.USD,
          VolumeOut: latestCandle.VolumeOut + trade.Amount,
          TransactionCount: (latestCandle.TransactionCount || 0) + 1, // Increment transaction count
        };

        // Update the candle in the chart data
        this.chartData.candles[this.chartData.candles.length - 1] = updatedCandle;

        // Update the chart visualization immediately
        this.updateSingleCandle(updatedCandle);

        console.log('📊 Component: Updated candle visualization:', {
          price: trade.Price,
          timestamp: tradeMinuteTimestamp,
          candleTimestamp: latestCandleTimestamp
        });
      } else if (timeDiff > 120) {
        console.log('⏭️  Component: Trade outside range (timeDiff > 120s) - SDK should handle this');
        console.log('    SDK will create new candle and trigger handleChartUpdate()');
        // Don't update anything here - wait for SDK to create new candle and notify
      } else {
        console.log('⚠️  Component: Trade is older than latest candle (timeDiff < 0) - ignoring');
      }
    }

    this.onTrade.emit(trade);
    this.cdr.detectChanges();
  }

  private handleError(error: string): void {
    console.error('SDK Error:', error);
    this.onError.emit(error);
  }

  private handleConnectionChange(status: 'connecting' | 'connected' | 'disconnected'): void {
    console.log('Connection status changed:', status);
    this.isWebSocketConnected = status === 'connected';
    this.onConnectionChange.emit(status);
    this.cdr.detectChanges();
  }

  private convertCandleToChartData(candle: Candle): CandlestickData {
    // Convert UTC timestamp to local time for display
    // Lightweight Charts displays timestamps in UTC, so we adjust by timezone offset
    const utcTimestamp = candle.Timestamp;
    const utcDate = new Date(utcTimestamp * 1000); // Create Date from UTC timestamp
    // Get timezone offset in minutes and convert to seconds
    const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
    // Adjust timestamp: subtract offset to convert UTC to local time
    // (getTimezoneOffset returns positive for timezones behind UTC, so we subtract)
    const localTimestamp = utcTimestamp - timezoneOffsetSeconds;

    return {
      time: localTimestamp as UTCTimestamp,
      open: candle.OpenPrice,
      high: candle.HighPrice,
      low: candle.LowPrice,
      close: candle.ClosePrice,
    };
  }

  private convertCandleToVolumeData(candle: Candle): HistogramData {
    // Convert UTC timestamp to local time for display (same as candlestick)
    const utcTimestamp = candle.Timestamp;
    const utcDate = new Date(utcTimestamp * 1000);
    const timezoneOffsetSeconds = utcDate.getTimezoneOffset() * 60;
    const localTimestamp = utcTimestamp - timezoneOffsetSeconds;

    // Determine color based on price direction (green for up, red for down)
    const isUp = candle.ClosePrice >= candle.OpenPrice;
    const isDark = this.chartTheme === 'dark';
    const color = isUp
      ? (isDark ? '#00d4aa80' : '#26a69a40')
      : (isDark ? '#ff6b6b80' : '#ef535040');

    return {
      time: localTimestamp as UTCTimestamp,
      value: candle.VolumeIn, // Use VolumeIn (USD volume)
      color: color,
    };
  }

  private updateChart(data: ChartData): void {
    if (!this.candlestickSeries || data.candles.length === 0) return;

    const chartData = data.candles.map((c: Candle) => this.convertCandleToChartData(c));
    this.candlestickSeries.setData(chartData);

    // Update volume series if enabled
    if (this.showVolume && this.volumeSeries) {
      const volumeData = data.candles.map((c: Candle) => this.convertCandleToVolumeData(c));
      this.volumeSeries.setData(volumeData);
    }

    if (this.chart && chartData.length > 0) {
      this.chart.timeScale().scrollToRealTime();
    }
  }

  private updateSingleCandle(candle: Candle): void {
    if (!this.candlestickSeries) {
      console.error('❌ Cannot update candle: candlestickSeries is null');
      return;
    }

    const candleData = this.convertCandleToChartData(candle);
    console.log('📈 Updating chart with candle data:', {
      time: candleData.time,
      open: candleData.open,
      high: candleData.high,
      low: candleData.low,
      close: candleData.close
    });

    // Update current price from candle close price
    this.currentPrice = candle.ClosePrice;

    // Update legend when candle updates
    this.updateLegend(null);

    this.candlestickSeries.update(candleData);

    // Update volume series if enabled
    if (this.showVolume && this.volumeSeries) {
      const volumeData = this.convertCandleToVolumeData(candle);
      this.volumeSeries.update(volumeData);
    }

    if (this.chart) {
      this.chart.timeScale().scrollToRealTime();
    }
  }

  refreshData(): void {
    if (this.tokenId) {
      this.loadTokenData(this.tokenId);
    }
  }

  cleanupOldData(olderThanHours: number = 24): void {
    if (this.sdk) {
      this.sdk.cleanupOldData(olderThanHours);
    }
  }

  formatPrice(price: number | null): string {
    if (price === null) return '--';
    return price.toFixed(2);
  }

  formatPercentage(percentage: number | null): string {
    if (percentage === null) return '--';
    return `${percentage.toFixed(2)}%`;
  }

  /**
   * Toggle chart theme (can be called from parent component)
   */
  toggleTheme(): void {
    // Only toggle chart theme, not widget theme
    this.chartTheme = this.chartTheme === 'light' ? 'dark' : 'light';

    // Update chart theme if chart exists
    if (this.chart) {
      const isDark = this.chartTheme === 'dark';
      this.chart.applyOptions({
        layout: {
          background: { color: isDark ? '#1a1a1a' : '#ffffff' },
          textColor: isDark ? '#ffffff' : '#333333',
        },
        grid: {
          vertLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
          horzLines: { color: isDark ? '#2a2a2a' : '#f0f0f0' },
        },
        crosshair: {
          vertLine: {
            color: isDark ? '#666666' : '#cccccc',
          },
          horzLine: {
            color: isDark ? '#666666' : '#cccccc',
          },
        },
        rightPriceScale: {
          borderColor: isDark ? '#444444' : '#cccccc',
        },
        leftPriceScale: {
          visible: this.showVolume,
          borderColor: isDark ? '#444444' : '#cccccc',
        },
        timeScale: {
          borderColor: isDark ? '#444444' : '#cccccc',
        },
      });

      // Update candlestick series colors
      if (this.candlestickSeries) {
        this.candlestickSeries.applyOptions({
          upColor: isDark ? '#00d4aa' : '#26a69a',
          downColor: isDark ? '#ff6b6b' : '#ef5350',
          wickUpColor: isDark ? '#00d4aa' : '#26a69a',
          wickDownColor: isDark ? '#ff6b6b' : '#ef5350',
        });
      }

      // Update volume series colors if enabled
      // Since volume colors are set per data point, refresh the volume data with new colors
      if (this.showVolume && this.volumeSeries) {
        // Update volume price scale border color
        this.volumeSeries.priceScale().applyOptions({
          borderColor: isDark ? '#444444' : '#cccccc',
        });

        // Refresh volume data with new theme colors
        if (this.chartData.candles.length > 0) {
          const volumeData = this.chartData.candles.map((c: Candle) => this.convertCandleToVolumeData(c));
          this.volumeSeries.setData(volumeData);
        }
      }

      // Update legend background color
      if (this.legendElement) {
        this.legendElement.style.background = isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        this.legendElement.style.boxShadow = isDark ? '0 2px 12px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.15)';
      }

      // Update legend content with new theme colors
      this.updateLegend(null);
    }
  }
}

