import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Token, TokenFilterOptions, TokenCreateData, TokenUpdateData } from '../types/token';
import { API_CONFIG } from '../config/api.config';
import { normalizeTokens, normalizeToken, constructTokenId } from '../utils/token-utils';

/**
 * Token API Service - Handles token-related API calls
 */
@Injectable({
  providedIn: 'root'
})
export class TokenApiService {
  constructor(private http: HttpClient) {}

  /**
   * Fetch all available tokens
   */
  async fetchTokens(filterOptions: TokenFilterOptions = {}): Promise<Token[]> {
    try {
      let params = new HttpParams();
      if (filterOptions.search) params = params.set('search', filterOptions.search);
      if (filterOptions.category) params = params.set('category', filterOptions.category);
      if (filterOptions.isActive !== undefined) params = params.set('isActive', filterOptions.isActive.toString());
      if (filterOptions.page) params = params.set('page', filterOptions.page.toString());
      if (filterOptions.limit) params = params.set('limit', filterOptions.limit.toString());
      if (filterOptions.sortBy) params = params.set('sortBy', filterOptions.sortBy);
      if (filterOptions.sortOrder) params = params.set('sortOrder', filterOptions.sortOrder);
      if (filterOptions.chain_id) params = params.set('chain_id', filterOptions.chain_id);

      const response = await firstValueFrom(
        this.http.get<any>(`${API_CONFIG.BASE_URL}/tokens`, { params })
      );

      // Handle both response formats: direct array or nested in tokens property
      const tokens = Array.isArray(response) ? response : (response.tokens || []);
      // Ensure all tokens have proper tokenId format
      return normalizeTokens(tokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return mock data for development
      return this.getMockTokens(filterOptions);
    }
  }

  /**
   * Fetch a single token by ID
   */
  async fetchTokenById(tokenId: string): Promise<Token | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<Token>(`${API_CONFIG.BASE_URL}/tokens/${tokenId}`)
      );
      return response ? normalizeToken(response) : null;
    } catch (error) {
      console.error('Error fetching token:', error);
      // Return mock data for development
      return this.getMockTokenById(tokenId);
    }
  }

  /**
   * Search tokens by query
   */
  async searchTokens(query: string, limit: number = 10): Promise<Token[]> {
    try {
      const params = new HttpParams()
        .set('search', query)
        .set('limit', limit.toString());

      const response = await firstValueFrom(
        this.http.get<any>(`${API_CONFIG.BASE_URL}/tokens`, { params })
      );
      // Handle both response formats: direct array or nested in tokens property
      const tokens = Array.isArray(response) ? response : (response.tokens || []);
      // Ensure all tokens have proper tokenId format
      return normalizeTokens(tokens);
    } catch (error) {
      console.error('Error searching tokens:', error);
      // Return mock search results for development
      return this.getMockSearchResults(query, limit);
    }
  }

  /**
   * Create a new token
   */
  async createToken(tokenData: TokenCreateData): Promise<Token> {
    try {
      const response = await firstValueFrom(
        this.http.post<Token>(`${API_CONFIG.BASE_URL}/tokens`, tokenData)
      );
      return response;
    } catch (error) {
      console.error('Error creating token:', error);
      throw new Error('Failed to create token');
    }
  }

  /**
   * Update an existing token
   */
  async updateToken(tokenId: string, tokenData: TokenUpdateData): Promise<Token> {
    try {
      const response = await firstValueFrom(
        this.http.put<Token>(`${API_CONFIG.BASE_URL}/tokens/${tokenId}`, tokenData)
      );
      return response;
    } catch (error) {
      console.error('Error updating token:', error);
      throw new Error('Failed to update token');
    }
  }

  /**
   * Delete a token
   */
  async deleteToken(tokenId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${API_CONFIG.BASE_URL}/tokens/${tokenId}`)
      );
      return true;
    } catch (error) {
      console.error('Error deleting token:', error);
      throw new Error('Failed to delete token');
    }
  }

  // Mock data for development - matches API structure
  private getMockTokens(filterOptions: TokenFilterOptions): Token[] {
    // Helper to create mock token with proper tokenId format
    const createMockToken = (
      id: number,
      chain_id: string,
      token_address: string,
      token_symbol: string,
      token_name: string,
      daily_volume_usd: number,
      price: number,
      change24h: number
    ): Token => ({
      id,
      chain_id,
      token_address,
      token_symbol,
      token_name,
      decimals: 18,
      icon_url: '',
      daily_volume_usd,
      volume_updated_at: '2024-01-15T10:30:00Z',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      // Computed fields for UI - using utility function
      tokenId: constructTokenId(chain_id, token_address),
      symbol: token_symbol,
      name: token_name,
      price,
      change24h,
      volume24h: daily_volume_usd,
      marketCap: price * daily_volume_usd / 100, // Rough estimate
      isActive: true,
      category: 'cryptocurrency'
    });

    const mockTokens: Token[] = [
      createMockToken(1, '1', '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', 'BTC', 'Bitcoin', 28500000000, 43250.50, 2.45),
      createMockToken(2, '1', '0x2Ebd53d035150f328bd754D6DC66B99B0eDB89aa', 'MET', 'MET', 9413.151128, 0.85, 3.21),
      createMockToken(3, '1', '0xA0b86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c', 'ETH', 'Ethereum', 15200000000, 2650.75, -1.23),
      createMockToken(4, '1', '0xB0c86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c4c', 'SOL', 'Solana', 2100000000, 98.45, 5.67),
      createMockToken(5, '1', '0xC0d86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c4c', 'ADA', 'Cardano', 850000000, 0.52, 3.21),
      createMockToken(6, '1', '0xD0e86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c4c', 'DOT', 'Polkadot', 420000000, 7.85, -0.45),
      createMockToken(7, '1', '0xE0f86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c4c', 'MATIC', 'Polygon', 680000000, 0.89, 4.12),
      createMockToken(8, '1', '0xF0g86a33E6441c8C06DdD4D4c4c4c4c4c4c4c4c4c4c', 'AVAX', 'Avalanche', 950000000, 35.20, 1.89)
    ];

    // Apply filters
    let filteredTokens = mockTokens;

    if (filterOptions.search) {
      const searchLower = filterOptions.search.toLowerCase();
      filteredTokens = filteredTokens.filter(token => 
        token.token_symbol?.toLowerCase().includes(searchLower) ||
        token.token_name?.toLowerCase().includes(searchLower) ||
        token.token_address?.toLowerCase().includes(searchLower)
      );
    }

    if (filterOptions.chain_id) {
      filteredTokens = filteredTokens.filter(token => token.chain_id === filterOptions.chain_id);
    }

    if (filterOptions.isActive !== undefined) {
      filteredTokens = filteredTokens.filter(token => {
        const isActive = token.volume_updated_at !== null;
        return isActive === filterOptions.isActive;
      });
    }

    // Apply sorting
    const sortBy = filterOptions.sortBy || 'token_symbol';
    const sortOrder = filterOptions.sortOrder || 'asc';
    
    filteredTokens.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const page = filterOptions.page || 1;
    const limit = filterOptions.limit || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return filteredTokens.slice(startIndex, endIndex);
  }

  private getMockTokenById(tokenId: string): Token | null {
    const mockTokens = this.getMockTokens({});
    return mockTokens.find(token => token.tokenId === tokenId) || null;
  }

  private getMockSearchResults(query: string, limit: number): Token[] {
    const mockTokens = this.getMockTokens({});
    const searchLower = query.toLowerCase();
    
    return mockTokens
      .filter(token => 
        token.token_symbol?.toLowerCase().includes(searchLower) ||
        token.token_name?.toLowerCase().includes(searchLower)
      )
      .slice(0, limit);
  }
}

