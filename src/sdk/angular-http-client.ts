import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpClient as SDKHttpClient } from '@fipulse/crypto-chart-sdk';

/**
 * Angular HTTP Client adapter for the crypto-chart-sdk
 *
 * This adapter allows the framework-agnostic SDK to use Angular's HttpClient
 * instead of the default fetch-based HTTP client. This is necessary because:
 *
 * 1. The SDK is framework-agnostic and accepts an HttpClient interface
 * 2. Angular applications typically use Angular's HttpClient for HTTP requests
 * 3. This adapter implements the SDK's HttpClient interface using Angular's HttpClient
 *
 * Usage:
 * ```typescript
 * constructor(private httpClient: AngularHttpClient) {}
 *
 * this.sdk = new CryptoChartSDK(
 *   apiConfig,
 *   wsConfig,
 *   chartConfig,
 *   this.httpClient  // Pass the Angular adapter
 * );
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class AngularHttpClient implements SDKHttpClient {
  constructor(private http: HttpClient) {}

  async get(url: string, options?: { params?: Record<string, string>; headers?: Record<string, string> }): Promise<string> {
    const response = await firstValueFrom(
      this.http.get(url, {
        params: options?.params,
        responseType: 'text',
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          ...options?.headers,
        }),
      })
    );
    return response;
  }
}

