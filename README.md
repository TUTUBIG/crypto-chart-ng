# Crypto Chart - Angular

A real-time cryptocurrency chart application built with Angular 20 and Lightweight Charts, featuring WebSocket integration for live price updates.

## Features

- 📊 **Real-time Candlestick Charts** - View live cryptocurrency price data
- 🔄 **WebSocket Integration** - Real-time trade updates via WebSocket
- 📈 **Price Display** - Live price updates with visual indicators
- 🎨 **Theme Support** - Light and dark themes
- ⚡ **High Performance** - Optimized chart rendering with Lightweight Charts
- 🔧 **Modular SDK** - Clean, reusable SDK architecture
- 🪙 **Token Management** - Browse, search, and manage crypto tokens
- 📋 **Token List** - Searchable and filterable token directory
- 💹 **Market Data** - Real-time price, volume, and change tracking

## Project Structure

```
crypto-chart-ng/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── crypto-chart/        # Crypto chart component
│   │   │   ├── token-list/          # Token list component
│   │   │   └── token-management/    # Token management component
│   │   ├── app.ts                    # Main app component
│   │   ├── app.config.ts             # App configuration
│   │   └── ...
│   ├── sdk/                          # Crypto Chart SDK
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── api.service.ts            # API service
│   │   ├── websocket.service.ts      # WebSocket service
│   │   ├── crypto-chart-sdk.ts       # Main SDK class
│   │   └── index.ts                  # SDK exports
│   ├── services/
│   │   └── token-api.service.ts      # Token API service
│   ├── types/
│   │   └── token.ts                  # Token interfaces
│   ├── config/
│   │   └── api.config.ts             # API configuration
│   ├── utils/
│   │   ├── binary-deserializer.ts    # Binary data deserializer
│   │   └── token-utils.ts            # Token utilities
│   └── components/
│       ├── TokenList.css             # Token list styles
│       └── TokenManagement.css       # Token management styles
├── package.json
├── README.md
└── TOKEN_MANAGEMENT.md               # Token management documentation
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

1. **Install dependencies:**

```bash
cd /Users/alvin/WebstormProjects/crypto-chart-ng
npm install
```

2. **Start the development server:**

```bash
npm start
```

or

```bash
ng serve
```

3. **Open your browser:**

Navigate to `http://localhost:4200/`

The application will automatically reload when you make changes to the source files.

## Building for Production

To build the project for production:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## SDK Usage

The Crypto Chart SDK can be used independently in any Angular application:

```typescript
import { CryptoChartSDK, ApiService } from './sdk';
import { API_CONFIG } from './config/api.config';

// In your component
constructor(private apiService: ApiService) {
  // Initialize SDK
  const sdk = new CryptoChartSDK(
    this.apiService,
    {
      baseUrl: API_CONFIG.BASE_URL,
      timeouts: API_CONFIG.TIMEOUTS,
      endpoints: API_CONFIG.ENDPOINTS
    },
    {
      url: API_CONFIG.ENDPOINTS.WEBSOCKET,
      reconnectDelay: API_CONFIG.WEBSOCKET.RECONNECT_DELAY,
      maxReconnectAttempts: API_CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS
    }
  );
  
  // Set up callbacks
  sdk.onChartUpdate((data) => console.log('Chart updated:', data));
  sdk.onTrade((trade) => console.log('New trade:', trade));
  
  // Initialize with a token
  await sdk.initialize('TOKEN_ID');
  sdk.subscribe('TOKEN_ID');
}
```

## Component Usage

### Crypto Chart Component

To use the Crypto Chart component in your Angular application:

```typescript
import { CryptoChartComponent } from './components/crypto-chart/crypto-chart.component';

@Component({
  // ...
  imports: [CryptoChartComponent]
})
export class YourComponent {
  tokenId = '9BB6NFEcjBCtnCJFwb1hVKKN72NCkWygNDdZBr3opump';
}
```

```html
<app-crypto-chart 
  [tokenId]="tokenId"
  [width]="800"
  [height]="600"
  [theme]="'light'"
  [autoConnect]="true"
  (onError)="handleError($event)">
</app-crypto-chart>
```

### Token Management Component

For a complete token browsing and chart viewing experience:

```typescript
import { TokenManagementComponent } from './components/token-management/token-management.component';

@Component({
  imports: [TokenManagementComponent]
})
export class YourComponent {}
```

```html
<app-token-management></app-token-management>
```

See [TOKEN_MANAGEMENT.md](./TOKEN_MANAGEMENT.md) for detailed documentation.

## Configuration

### API Configuration

Edit `src/config/api.config.ts` to customize API endpoints and settings:

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://crypto-pump.bigtutu.workers.dev/',
  ENDPOINTS: {
    HISTORY_CANDLES: '/candle-chart',
    SINGLE_CANDLE: '/single-candle',
    WEBSOCKET: 'wss://crypto-pump.bigtutu.workers.dev/ws',
  },
  // ... more configuration
};
```

## Key Features Explained

### Real-time Updates

The application uses WebSocket to receive real-time trade data:
- Subscribes to token-specific price feeds
- Updates the chart in real-time as trades occur
- Handles WebSocket reconnection automatically

### Chart Updates

The chart intelligently handles updates:
- **Incremental updates**: When a single candle changes
- **Batch updates**: When multiple candles need refreshing
- **Full refresh**: When switching tokens or large gaps detected

### Price Display

The top-left corner shows:
- Current price with live updates
- Price change percentage
- Visual indicators (▲/▼) for price movement

## Technologies Used

- **Angular 20** - Modern web framework
- **Lightweight Charts** - High-performance charting library
- **RxJS** - Reactive programming
- **TypeScript** - Type-safe JavaScript
- **SCSS** - Styling

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
ng lint
```

### Code Formatting

The project uses Prettier for code formatting. Configuration is in `package.json`.

## Troubleshooting

### WebSocket Connection Issues

If you encounter WebSocket connection problems:
1. Check the WebSocket URL in `src/config/api.config.ts`
2. Verify network connectivity
3. Check browser console for error messages

### Chart Not Displaying

If the chart doesn't appear:
1. Ensure `lightweight-charts` is installed
2. Check that the component is properly imported
3. Verify the token ID is valid

## License

This project is provided as-is for demonstration purposes.

## Support

For issues and questions, please check the console logs for detailed error messages.
