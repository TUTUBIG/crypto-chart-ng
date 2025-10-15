import { Token } from '../types/token';

/**
 * Construct the proper token ID format: {chain_id}-{lowercase(token_address)}
 * This is the format expected by the candle-chart API
 */
export function constructTokenId(chainId: string, tokenAddress: string): string {
  // Remove '0x' prefix if present and convert to lowercase
  const cleanAddress = tokenAddress.toLowerCase().replace(/^0x/i, '');
  return `${chainId}-${cleanAddress}`;
}

/**
 * Ensure a token has the proper tokenId field
 * If tokenId is missing, construct it from chain_id and token_address
 */
export function normalizeToken(token: Token): Token {
  if (!token.tokenId) {
    token.tokenId = constructTokenId(token.chain_id, token.token_address);
  }
  
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

