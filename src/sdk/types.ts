// SDK Types - Clean interfaces for consumers

// Core data types
export interface Candle {
  OpenPrice: number;
  ClosePrice: number;
  HighPrice: number;
  LowPrice: number;
  VolumeIn: number;
  VolumeOut: number;
  Timestamp: number; // seconds
}

export interface RealTimeTrade {
  TradeTime: number;
  USD: number;
  Amount: number;
  Price: number;
}

// Chart data structure
export interface ChartData {
  candles: Candle[];
  lastUpdate: Date | null;
  isLoading: boolean;
  error: string | null;
}

// Configuration interfaces
export interface ChartConfig {
  maxCandles?: number;
  updateInterval?: number;
  autoScroll?: boolean;
}

export interface WebSocketConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeouts: {
    httpRequest: number;
    websocketConnect: number;
  };
  endpoints: {
    historyCandles: string;
    singleCandle: string;
    websocket: string;
  };
}

// Subscription status
export interface SubscriptionStatus {
  isConnected: boolean;
  isSubscribed: boolean;
  subscribeId: string | null;
  lastTradeTime: Date | null;
}

// Callback types
export type ChartUpdateCallback = (data: ChartData) => void;
export type TradeCallback = (trade: RealTimeTrade) => void;
export type ErrorCallback = (error: string) => void;
export type ConnectionCallback = (status: 'connecting' | 'connected' | 'disconnected') => void;

// SDK Events
export interface SDKEvents {
  onChartUpdate: ChartUpdateCallback;
  onTrade: TradeCallback;
  onError: ErrorCallback;
  onConnectionChange: ConnectionCallback;
}

// API Response types (internal)
export interface HistoryCandlesResponse {
  candles: Candle[];
  success: boolean;
  message?: string;
}

export interface SingleCandleResponse {
  candle: Candle | null;
  success: boolean;
  message?: string;
}

// WebSocket message types (internal)
export interface WebSocketTradeMessage {
  type: 'trade';
  data: RealTimeTrade;
}

export interface WebSocketErrorMessage {
  type: 'error';
  message: string;
}

export interface SubscribeRequest {
  action: 'subscribe';
  token_id: string;
}

export interface UnsubscribeRequest {
  action: 'unsubscribe';
  subscribe_id: string;
}

export interface SubscribeResponse {
  action: 'subscribed';
  subscribe_id: string;
  status?: 'success' | 'error';
}

export interface UnsubscribeResponse {
  action: 'unsubscribed';
  status: 'success' | 'error';
  message?: string;
}

export type WebSocketMessage = WebSocketTradeMessage | WebSocketErrorMessage;
export type WebSocketRequest = SubscribeRequest | UnsubscribeRequest;
export type WebSocketResponse = SubscribeResponse | UnsubscribeResponse;

