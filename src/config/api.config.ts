// API Configuration for Angular
export const API_CONFIG = {
  // Base URL for API requests
  BASE_URL: 'https://crypto-pump.bigtutu.workers.dev',

  // API Endpoints
  ENDPOINTS: {
    // Historical candle data
    HISTORY_CANDLES: '/candle-chart',

    // Single candle data
    SINGLE_CANDLE: '/single-candle',

    // WebSocket endpoint for real-time data
    WEBSOCKET: 'wss://crypto-pump.bigtutu.workers.dev/ws',
  },

  // Request timeouts (in milliseconds)
  TIMEOUTS: {
    HTTP_REQUEST: 10000, // 10 seconds
    WEBSOCKET_CONNECT: 5000, // 5 seconds
  },

  // Chart configuration
  CHART: {
    MAX_CANDLES: 1440, // Maximum number of candles to keep in memory
    UPDATE_INTERVAL: 60000, // 1 minute - fallback polling when WebSocket is disconnected
    VOLUME_HEIGHT_PERCENTAGE: 10, // 10% of chart height for volume
  },

  // WebSocket configuration
  WEBSOCKET: {
    RECONNECT_DELAY: 1000, // 1 second
    MAX_RECONNECT_ATTEMPTS: 5,
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
  },
};

// Environment-specific configurations
export const ENV_CONFIG = {
  // Development environment
  development: {
    DEBUG: true,
    LOG_LEVEL: 'debug',
  },

  // Production environment
  production: {
    DEBUG: false,
    LOG_LEVEL: 'error',
  },
} as const;

