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
export function normalizeToken(token: Token): Token {
  // Also ensure alias fields are set
  if (!token.symbol) token.symbol = token.token_symbol;
  if (!token.name) token.name = token.token_name;
  if (!token.volume24h) token.volume24h = token.daily_volume_usd;
  if (token.isActive === undefined) {
    token.isActive = token.volume_updated_at !== null;
  }

  return token;
}

/**
 * Normalize an array of tokens
 */
export function normalizeTokens(tokens: Token[]): Token[] {
  return tokens.map(normalizeToken);
}

