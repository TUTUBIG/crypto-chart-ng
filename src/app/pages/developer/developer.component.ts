import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-developer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './developer.component.html',
  styleUrls: ['./developer.component.scss']
})
export class DeveloperComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('widgetContainer', { static: false }) widgetContainer!: ElementRef<HTMLDivElement>;

  // Widget playground parameters
  widgetParams = {
    tokenId: '1-2260fac5e5542a773aa44fbcfedf7c193bc2c599', // BTC
    symbol: 'BTC/USDT',
    showVolume: true,
    priceSeriesType: 'candle' as 'candle' | 'line',
    theme: 'light' as 'light' | 'dark',
    legendStyle: 'complex' as 'none' | 'simple' | 'complex',
    height: 500
  };

  // Preset token options
  tokenPresets = [
    { id: '1-2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC/USDT', name: 'Bitcoin' },
    { id: '1-c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH/USDT', name: 'Ethereum' },
  ];

  widgetInstance: any = null;
  widgetScriptLoaded = false;

  ngOnInit(): void {
    this.loadWidgetScript();
  }

  ngAfterViewInit(): void {
    if (this.widgetScriptLoaded) {
      this.createWidget();
    }
  }

  ngOnDestroy(): void {
    if (this.widgetInstance && typeof this.widgetInstance.destroy === 'function') {
      this.widgetInstance.destroy();
    }
  }

  loadWidgetScript(): void {
    if ((window as any).FiPulseWidget) {
      this.widgetScriptLoaded = true;
      if (this.widgetContainer) {
        this.createWidget();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://widget.fipulse.xyz/widget.iife.js';
    script.onload = () => {
      this.widgetScriptLoaded = true;
      if (this.widgetContainer) {
        this.createWidget();
      }
    };
    script.onerror = () => {
      console.error('Failed to load widget script');
    };
    document.head.appendChild(script);
  }

  createWidget(): void {
    if (!this.widgetContainer || !this.widgetScriptLoaded) return;

    // Clear existing widget
    if (this.widgetInstance && typeof this.widgetInstance.destroy === 'function') {
      this.widgetInstance.destroy();
    }
    this.widgetContainer.nativeElement.innerHTML = '';

    // Get widget API
    const FiPulseWidget = (window as any).FiPulseWidget?.default || (window as any).FiPulseWidget;
    if (!FiPulseWidget || !FiPulseWidget.create) {
      console.error('FiPulseWidget not found');
      return;
    }

    // Create new widget
    try {
      this.widgetInstance = FiPulseWidget.create({
        container: this.widgetContainer.nativeElement,
        tokenId: this.widgetParams.tokenId,
        symbol: this.widgetParams.symbol,
        showVolume: this.widgetParams.showVolume,
        priceSeriesType: this.widgetParams.priceSeriesType,
        theme: this.widgetParams.theme,
        legendStyle: this.widgetParams.legendStyle,
        height: this.widgetParams.height,
        onError: (error: string) => {
          console.error('Widget error:', error);
        },
        onDataUpdate: (data: any) => {
          console.log('Data updated:', data.candles.length, 'candles');
        },
        onTrade: (trade: any) => {
          console.log('New trade:', trade);
        },
        onConnectionChange: (status: string) => {
          console.log('Connection status:', status);
        }
      });
    } catch (error) {
      console.error('Failed to create widget:', error);
    }
  }

  onParamChange(): void {
    this.createWidget();
  }

  selectTokenPreset(preset: any): void {
    this.widgetParams.tokenId = preset.id;
    this.widgetParams.symbol = preset.symbol;
    this.createWidget();
  }

  copyCodeToClipboard(): void {
    const code = this.widgetExample;
    navigator.clipboard.writeText(code).then(() => {
      // Show feedback (you could add a toast notification here)
      const button = document.querySelector('.btn-copy') as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.background = '#10b981';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy code:', err);
    });
  }

  // SDK Documentation
  sdkBookHandling = `
The SDK manages a "data book" - a collection of historical candle data that is:

1. **Fetched via HTTP**: Initial historical data is loaded via REST API
   - Endpoint: GET /candle-chart?tokenId={tokenId}
   - Returns: Array of candle objects with OHLCV data

2. **Maintained in Memory**: The SDK keeps candles in a ChartData object:
   \`\`\`typescript
   interface ChartData {
     candles: Candle[];
     lastUpdate: Date | null;
     isLoading: boolean;
     error: string | null;
   }
   \`\`\`

3. **Updated via WebSocket**: Real-time trades update the latest candle:
   - When a trade arrives, the SDK updates the current candle's:
     - ClosePrice (latest trade price)
     - HighPrice (if trade price > current high)
     - LowPrice (if trade price < current low)
     - VolumeIn/VolumeOut (accumulated)
     - TransactionCount (incremented)

4. **Incremental Updates**: The SDK intelligently handles updates:
   - If only 1 new candle: Updates single candle (efficient)
   - If multiple candles: Replaces entire dataset
   - Maximum candles: Limited to 1440 (24 hours of 1-minute candles)

5. **Data Flow**:
   \`\`\`
   HTTP Request → Historical Candles → ChartData.candles[]
                    ↓
   WebSocket → Real-time Trades → Update Latest Candle
                    ↓
   onChartUpdate() → Chart Rendering
   \`\`\`

6. **Book Management Features**:
   - Auto-scroll to latest candle
   - Efficient incremental updates
   - Error handling and retry logic
   - Connection state management
  `;

  sdkExample = `import { CryptoChartSDK, ChartData, RealTimeTrade } from '@fipulse/crypto-chart-sdk';

// Initialize SDK
const sdk = new CryptoChartSDK(
  {
    baseUrl: 'https://api.fipulse.xyz',
    timeouts: {
      httpRequest: 10000,
      websocketConnect: 5000
    },
    endpoints: {
      historyCandles: '/candle-chart',
      singleCandle: '/single-candle',
      websocket: 'wss://api.fipulse.xyz/ws'
    }
  },
  {
    url: 'wss://api.fipulse.xyz/ws',
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  },
  {
    maxCandles: 1440,
    autoScroll: true
  },
  httpClient
);

// Set up callbacks
sdk.onChartUpdate((data: ChartData) => {
  // data.candles contains the "book" of historical candles
  console.log('Candle book updated:', data.candles.length, 'candles');
  console.log('Latest candle:', data.candles[data.candles.length - 1]);
});

sdk.onTrade((trade: RealTimeTrade) => {
  // Real-time trade updates the latest candle in the book
  console.log('Trade received:', trade.Price);
});

// Connect and subscribe
sdk.connectWebSocket();
await sdk.initialize(tokenId, true);
sdk.subscribe(tokenId);`;

  // Dynamic widget example that syncs with playground params
  get widgetExample(): string {
    const params = this.widgetParams;
    const options: string[] = [];

    // Always include required options
    options.push(`    container: '#chart',`);
    options.push(`    tokenId: '${params.tokenId}',`);

    // Include optional options that are set
    if (params.symbol) {
      options.push(`    symbol: '${params.symbol}',`);
    }

    if (params.showVolume !== undefined) {
      options.push(`    showVolume: ${params.showVolume},`);
    }

    if (params.priceSeriesType) {
      options.push(`    priceSeriesType: '${params.priceSeriesType}',`);
    }

    if (params.theme) {
      options.push(`    theme: '${params.theme}',`);
    }

    if (params.legendStyle && params.legendStyle !== 'none') {
      options.push(`    legendStyle: '${params.legendStyle}',`);
    }

    if (params.height && params.height !== 500) {
      options.push(`    height: ${params.height}`);
    }

    // Remove trailing comma from last option
    if (options.length > 0) {
      const lastOption = options[options.length - 1];
      options[options.length - 1] = lastOption.replace(/,$/, '');
    }

    const optionsCode = options.length > 0 ? options.join('\n') : '    // Add your options here';

    return `<!-- Load widget script -->
<script src="https://widget.fipulse.xyz/widget.iife.js"></script>

<!-- Create widget -->
<script>
  const chart = window.FiPulseWidget.create({
${optionsCode}
  });
</script>`;
  }
}
