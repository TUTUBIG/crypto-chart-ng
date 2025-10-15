// Token data structure - matches API response
export interface Token {
  id: number;
  chain_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  decimals: number;
  icon_url: string;
  daily_volume_usd: number;
  volume_updated_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Additional fields for UI/display purposes
  tokenId?: string; // Computed from id for compatibility
  symbol?: string; // Alias for token_symbol
  name?: string; // Alias for token_name
  price?: number; // Not in API, computed or fetched separately
  change24h?: number; // Not in API, computed or fetched separately
  volume24h?: number; // Alias for daily_volume_usd
  marketCap?: number; // Not in API, computed or fetched separately
  isActive?: boolean; // Computed based on volume_updated_at
  category?: string; // Not in API, could be derived from chain_id
}

// Token search/filter options
export interface TokenFilterOptions {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'token_symbol' | 'token_name' | 'daily_volume_usd' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  chain_id?: string;
}

// Token creation/update data
export interface TokenCreateData {
  tokenId: string;
  symbol?: string;
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  isActive?: boolean;
}

export interface TokenUpdateData extends Partial<TokenCreateData> {
  tokenId: string;
}

