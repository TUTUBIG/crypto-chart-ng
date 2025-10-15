import { 
  WebSocketConfig,
  WebSocketRequest, 
  TradeCallback,
  ErrorCallback,
  ConnectionCallback
} from './types';
import { deserializeRealTimeTradeDataFromBytes } from '../utils/binary-deserializer';

/**
 * WebSocket Service - Handles real-time data streaming
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private isConnecting = false;
  private connectionTimeout: number | null = null;
  private subscribeId: string | null = null;
  private isSubscribed = false;

  // Callbacks
  private onTradeCallback: TradeCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private onConnectCallback: ConnectionCallback | null = null;
  private onDisconnectCallback: ConnectionCallback | null = null;
  private onSubscriptionCallback: ((subscribeId: string) => void) | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5;
    this.reconnectDelay = config.reconnectDelay || 1000;
  }

  /**
   * Start WebSocket connection
   */
  public startConnection(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    // Delay connection to avoid race conditions
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  private connect(): void {
    if (this.isConnecting) {
      console.log('WebSocket connection already in progress, skipping...');
      return;
    }

    try {
      this.isConnecting = true;
      console.log('Attempting to connect to WebSocket:', this.config.url);
      
      this.ws = new WebSocket(this.config.url);
      
      // Set connection timeout
      this.connectionTimeout = window.setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout, closing...');
          this.ws.close();
        }
      }, 5000); // 5 second timeout
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = this.config.reconnectDelay || 1000;
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this.onConnectCallback?.('connected');
      };

      this.ws.binaryType = 'arraybuffer';

      this.ws.onmessage = (event) => {
        try {
          // Handle binary data from WebSocket
          if (event.data instanceof ArrayBuffer) {
            this.handleBinaryMessage(event.data);
          } else if (event.data instanceof Blob) {
            // Convert Blob to ArrayBuffer
            event.data.arrayBuffer().then(buffer => {
              this.handleBinaryMessage(buffer);
            });
          } else if (typeof event.data === 'string') {
            // Handle text messages (subscription responses)
            this.handleTextMessage(event.data);
          } else {
            console.warn('Received unknown data type from WebSocket:', typeof event.data);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this.onDisconnectCallback?.('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        
        // Clear connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        
        this.onErrorCallback?.('WebSocket connection error');
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private handleBinaryMessage(data: ArrayBuffer): void {
    try {
      console.log('Received binary data:', {
        byteLength: data.byteLength,
        data: Array.from(new Uint8Array(data)).slice(0, 16) // Log first 16 bytes for debugging
      });
      
      // Deserialize binary RealTimeTrade data
      const trade = deserializeRealTimeTradeDataFromBytes(new Uint8Array(data));
      console.log('Received binary RealTimeTrade data:', trade);
      
      // Call the trade callback
      this.onTradeCallback?.(trade);
    } catch (error) {
      console.error('Error deserializing binary WebSocket data:', error);
      console.error('Data details:', {
        byteLength: data.byteLength,
        data: Array.from(new Uint8Array(data))
      });
      this.onErrorCallback?.('Failed to deserialize binary data');
    }
  }

  private handleTextMessage(message: string): void {
    try {
      console.log('Received text message:', message);
      
      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(message);
        
        // Handle JSON subscription response
        if (jsonData.action === 'subscribed' && jsonData.subscribe_id) {
          this.subscribeId = jsonData.subscribe_id;
          this.isSubscribed = true;
          console.log('Subscription successful, ID:', jsonData.subscribe_id);
          this.onSubscriptionCallback?.(jsonData.subscribe_id);
          return;
        }
        
        // Handle JSON unsubscribe response
        if (jsonData.action === 'unsubscribed' && jsonData.status === 'success') {
          this.subscribeId = null;
          this.isSubscribed = false;
          console.log('Unsubscribed successfully');
          this.onSubscriptionCallback?.('');
          return;
        }
        
        // Handle other JSON messages
        console.log('Unknown JSON message:', jsonData);
        
      } catch (parseError) {
        // Not JSON, handle as plain text (backward compatibility)
        
        // Check if it's a subscription response (legacy format)
        if (message.startsWith('subscribe_id:')) {
          const subscribeId = message.replace('subscribe_id:', '');
          this.subscribeId = subscribeId;
          this.isSubscribed = true;
          console.log('Subscription successful, ID:', subscribeId);
          this.onSubscriptionCallback?.(subscribeId);
        } else if (message === 'unsubscribed') {
          this.subscribeId = null;
          this.isSubscribed = false;
          console.log('Unsubscribed successfully');
          this.onSubscriptionCallback?.('');
        } else {
          console.log('Unknown text message:', message);
        }
      }
    } catch (error) {
      console.error('Error handling text message:', error);
      this.onErrorCallback?.('Failed to handle text message');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Add delay before reconnecting to avoid rapid reconnection attempts
      setTimeout(() => {
        if (!this.isConnecting) {
          this.connect();
        }
      }, this.reconnectDelay);
      
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('Max reconnection attempts reached');
      this.onErrorCallback?.('Failed to reconnect after maximum attempts');
    }
  }

  // Public methods for setting callbacks
  public onTrade(callback: TradeCallback): void {
    this.onTradeCallback = callback;
  }

  public onSubscription(callback: (subscribeId: string) => void): void {
    this.onSubscriptionCallback = callback;
  }

  public onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  public onConnect(callback: ConnectionCallback): void {
    this.onConnectCallback = callback;
  }

  public onDisconnect(callback: ConnectionCallback): void {
    this.onDisconnectCallback = callback;
  }

  // Send message to WebSocket
  public send(message: WebSocketRequest | string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(messageStr);
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  // Subscribe to real-time data
  public subscribe(tokenId: string): void {
    const message: WebSocketRequest = {
      action: 'subscribe',
      token_id: tokenId
    };
    console.log('Sending subscription request:', message);
    this.send(message);
  }

  // Unsubscribe from real-time data
  public unsubscribe(): void {
    if (this.subscribeId) {
      const message: WebSocketRequest = {
        action: 'unsubscribe',
        subscribe_id: this.subscribeId
      };
      console.log('Sending unsubscription request:', message);
      this.send(message);
    } else {
      console.warn('No active subscription to unsubscribe from');
    }
  }

  // Get subscription status
  public getSubscriptionStatus(): { isSubscribed: boolean; subscribeId: string | null } {
    return {
      isSubscribed: this.isSubscribed,
      subscribeId: this.subscribeId
    };
  }

  // Disconnect WebSocket
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Reset subscription state
    this.subscribeId = null;
    this.isSubscribed = false;
  }

  // Check if WebSocket is connected
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Update configuration
  public updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
    this.reconnectDelay = this.config.reconnectDelay || 1000;
  }

  // Get current configuration
  public getConfig(): WebSocketConfig {
    return { ...this.config };
  }
}

