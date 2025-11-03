import { Injectable, signal } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import { AuthService } from './auth.service';
import { API_CONFIG } from '../config/api.config';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

export interface BotStartedEvent {
  user_id: number;
  telegram_id: string;
  telegram_username?: string;
  bot_started_at: string;
}

export interface CandleUpdateEvent {
  tokenId: string;
  candle: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 3000;
  private reconnectTimer: any = null;
  
  // Connection state
  readonly isConnected = signal<boolean>(false);
  readonly connectionError = signal<string | null>(null);
  
  // WebSocket URL from config
  private readonly WS_URL = API_CONFIG.ENDPOINTS.WEBSOCKET;
  
  constructor(private authService: AuthService) {
    console.log('[WebSocket] Service initialized');
    console.log('[WebSocket] URL:', this.WS_URL);
  }

  /**
   * Connect to WebSocket server
   * Should be called once when app loads
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log('[WebSocket] Connecting to:', this.WS_URL);
    
    try {
      // Include JWT token in connection for authentication
      const token = this.authService.getAccessToken();
      const wsUrl = token ? `${this.WS_URL}?token=${token}` : this.WS_URL;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.isConnected.set(true);
        this.connectionError.set(null);
        this.reconnectAttempts = 0;
        
        // Send initial subscription message
        this.sendMessage({
          type: 'subscribe',
          data: {
            user_id: this.authService.currentUser()?.id,
            channels: ['bot_started', 'candles', 'price_alerts']
          }
        });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.connectionError.set('WebSocket connection error');
      };
      
      this.ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        this.isConnected.set(false);
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        } else {
          console.error('[WebSocket] Max reconnection attempts reached');
          this.connectionError.set('Failed to connect to real-time updates');
        }
      };
      
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.connectionError.set('Failed to establish WebSocket connection');
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      console.log('[WebSocket] Disconnecting...');
      this.ws.close();
      this.ws = null;
      this.isConnected.set(false);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY * Math.min(this.reconnectAttempts, 5);
    
    console.log(`[WebSocket] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  /**
   * Send message to WebSocket server
   */
  sendMessage(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[WebSocket] Message sent:', message);
    } else {
      console.warn('[WebSocket] Cannot send message - not connected');
    }
  }

  /**
   * Get all messages as Observable
   */
  get messages$(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Listen for bot_started events
   * Returns Observable that emits when user starts the bot
   */
  onBotStarted$(): Observable<BotStartedEvent> {
    return this.messages$.pipe(
      filter(msg => msg.type === 'bot_started'),
      map(msg => msg.data as BotStartedEvent)
    );
  }

  /**
   * Listen for candle updates
   * Optionally filter by tokenId
   */
  onCandleUpdate$(tokenId?: string): Observable<CandleUpdateEvent> {
    return this.messages$.pipe(
      filter(msg => msg.type === 'candle_update'),
      map(msg => msg.data as CandleUpdateEvent),
      filter(data => !tokenId || data.tokenId === tokenId)
    );
  }

  /**
   * Listen for price alerts
   */
  onPriceAlert$(): Observable<any> {
    return this.messages$.pipe(
      filter(msg => msg.type === 'price_alert'),
      map(msg => msg.data)
    );
  }

  /**
   * Listen for specific message type
   */
  on$(messageType: string): Observable<any> {
    return this.messages$.pipe(
      filter(msg => msg.type === messageType),
      map(msg => msg.data)
    );
  }
}

