import { Token } from '../types/token';

/**
 * Construct the API token ID format: {chain_id}-{lowercase(token_address)}
 * This format is ONLY used for API calls (candle-chart, WebSocket)
 * Do NOT use this for internal state management - use token.id instead
 */
export function constructApiTokenId(chainId: string, tokenAddress: string): string {
  // Remove '0x' prefix if present and convert to lowercase
  const cleanAddress = tokenAddress.toLowerCase().replace(/^0x/i, '');
  return `${chainId}-${cleanAddress}`;
}

/**
 * Get the API token ID from a Token object
 * Use this when making API calls that require the chain_id-address format
 */
export function getApiTokenId(token: Token): string {
  return constructApiTokenId(token.chain_id, token.token_address);
}

/**
 * Ensure a token has the proper tokenId field for API calls
 * If tokenId is missing, construct it from chain_id and token_address
 *
 * NOTE: Use token.id (number) for internal state management and lookups.
 * Only use token.tokenId (string) when making API calls to candle-chart or WebSocket.
 */
export function normalizeToken(token: any): Token {
  // Map API response fields to Token interface
  const normalized: any = { ...token };
  
  // Map price_change_rate to change24h (for tagged tokens from KV)
  if (normalized.price_change_rate !== undefined && normalized.change24h === undefined) {
    normalized.change24h = normalized.price_change_rate;
  }
  
  // Store token_id if present (from KV storage)
  if (normalized.token_id) {
    (normalized as any).token_id = normalized.token_id;
  }
  
  // Generate numeric id if missing (for compatibility with Token interface)
  // Use a simple hash of token_id or chain_id + token_address
  if (!normalized.id && normalized.token_id) {
    // Simple hash function to generate numeric id from token_id
    let hash = 0;
    const str = normalized.token_id;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    normalized.id = Math.abs(hash);
  } else if (!normalized.id && normalized.chain_id && normalized.token_address) {
    // Fallback: generate id from chain_id + token_address
    const idStr = `${normalized.chain_id}-${normalized.token_address}`;
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      const char = idStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    normalized.id = Math.abs(hash);
  }
  
  // Also ensure alias fields are set
  if (!normalized.symbol) normalized.symbol = normalized.token_symbol;
  if (!normalized.name) normalized.name = normalized.token_name;
  if (!normalized.volume24h) normalized.volume24h = normalized.daily_volume_usd;
  if (normalized.isActive === undefined) {
    normalized.isActive = normalized.volume_updated_at !== null;
  }

  return normalized as Token;
}

/**
 * Normalize an array of tokens
 */
export function normalizeTokens(tokens: Token[]): Token[] {
  return tokens.map(normalizeToken);
}

