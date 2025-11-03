// API Configuration for Angular
export const API_CONFIG = {
  // Base URL for API requests
  BASE_URL: 'https://api.fipulse.xyz',

  // API Endpoints
  ENDPOINTS: {
    // Historical candle data
    HISTORY_CANDLES: '/candle-chart',

    // Single candle data
    SINGLE_CANDLE: '/single-candle',

    // WebSocket endpoint for real-time data
    WEBSOCKET: 'wss://api.fipulse.xyz/ws',

    // Authentication
    AUTH_SEND_CODE: '/auth/send-code',
    AUTH_REGISTER: '/auth/register',
    AUTH_LOGIN: '/auth/login',
    AUTH_REFRESH: '/auth/refresh',
    AUTH_LOGOUT: '/auth/logout',
    AUTH_ME: '/auth/me',
    AUTH_RESET_PASSWORD: '/auth/reset-password',

    // Tokens
    TOKENS: '/tokens',
    TOKENS_BY_TAG: (tag: string) => `/tokens/tag/${tag}`,
    TOKEN_TAGS: (chainId: string, tokenAddress: string) => `/tokens/${chainId}/${tokenAddress}/tags`,
    TOKEN_TAG_DELETE: (chainId: string, tokenAddress: string, tag: string) => `/tokens/${chainId}/${tokenAddress}/tags/${tag}`,

    // Watched Tokens
    WATCHED_TOKENS: '/watched-tokens',
    WATCHED_TOKEN_BY_ID: (id: number) => `/watched-tokens/${id}`,
    ACTIVE_WATCHED_TOKENS: '/watched-tokens/active/all',

    // User Preferences
    USER_NOTIFICATION_PREFERENCES: '/user/notification-preferences',
    USER_UNLINK_TELEGRAM: '/user/unlink-telegram',
    USER_BIND_TELEGRAM: '/user/bind-telegram', // For Telegram Login Widget binding
    AUTH_TELEGRAM: '/auth/telegram', // For login/register via Telegram
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

