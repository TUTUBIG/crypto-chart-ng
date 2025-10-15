// SDK Utilities

/**
 * Convert timestamp from seconds to milliseconds for chart library
 */
export const convertTimestampToMs = (timestamp: number): number => {
  return timestamp * 1000;
};

/**
 * Convert milliseconds back to seconds
 */
export const convertMsToTimestamp = (ms: number): number => {
  return Math.floor(ms / 1000);
};

/**
 * Format price for display
 */
export const formatPrice = (price: number, decimals: number = 2): string => {
  return price.toFixed(decimals);
};

/**
 * Format volume for display
 */
export const formatVolume = (volume: number, decimals: number = 2): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(decimals)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(decimals)}K`;
  }
  return volume.toFixed(decimals);
};

/**
 * Helper function to decode base64 to Uint8Array
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  try {
    // Remove any whitespace and decode
    const cleanBase64 = base64.replace(/\s/g, '');
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Error decoding base64:', error);
    throw new Error('Failed to decode base64 data');
  }
};

/**
 * Calculate price change percentage
 */
export const calculatePriceChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Calculate price change color class
 */
export const getPriceChangeColor = (change: number): string => {
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return 'neutral';
};

