import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Candle, ApiConfig } from './types';
import { deserializeCandleDataFromBytes } from '../utils/binary-deserializer';
import { base64ToUint8Array } from './utils';

/**
 * API Service - Handles all HTTP API calls
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private config!: ApiConfig;

  constructor(private http: HttpClient) {}

  /**
   * Initialize the service with configuration
   */
  initialize(config: ApiConfig): void {
    this.config = config;
  }

  /**
   * Fetch historical candles from API
   */
  async fetchHistoryCandles(tokenId: string): Promise<Candle[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.config.baseUrl}/candle-chart`, {
          params: {
            token_id: tokenId,
            time_frame: '300'
          },
          responseType: 'text',
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
          })
        })
      );

      // Check if response data is empty or nil
      if (!response || response.length === 0) {
        console.log('API returned nil/empty data for historical candles');
        return [];
      }

      // Decode base64 string to binary data
      console.log('Decoding base64 historical candles data, length:', response.length);
      const binaryData = base64ToUint8Array(response);

      // Deserialize binary data
      const candles = deserializeCandleDataFromBytes(binaryData);
      console.log("Historical candles received:", candles.length, candles);
      return candles;
    } catch (error) {
      console.error('Error fetching historical candles:', error);
      return [];
    }
  }

  /**
   * Fetch single minute candle from API
   */
  async fetchSingleCandle(tokenId: string): Promise<Candle | null> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.config.baseUrl}/single-candle`, {
          params: {
            token_id: tokenId,
            time_frame: '300'
          },
          responseType: 'text',
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
          })
        })
      );

      // Check if response data is empty or nil
      if (!response || response.length === 0) {
        console.log('API returned nil/empty data for single candle');
        return null;
      }

      // Decode base64 string to binary data
      const binaryData = base64ToUint8Array(response);

      // Deserialize binary data (single candle)
      const candles = deserializeCandleDataFromBytes(binaryData);
      console.log("Single candle received:", candles);

      if (candles.length === 0) {
        console.log('No candle data in response');
        return null;
      }

      return candles[0]; // Return the first (and only) candle
    } catch (error) {
      console.error('Error fetching single candle:', error);
      return null;
    }
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }
}

