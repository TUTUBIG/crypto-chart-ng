import { Candle, RealTimeTrade } from '../sdk/types';

/**
 * Deserializes binary candle data from the format used in the Go implementation
 * 
 * Binary format:
 * - First 4 bytes: count of candles (little-endian uint32)
 * - For each candle (64 bytes):
 *   - 8 bytes: Timestamp (little-endian int64)
 *   - 8 bytes: OpenPrice (little-endian float64)
 *   - 8 bytes: ClosePrice (little-endian float64)
 *   - 8 bytes: HighPrice (little-endian float64)
 *   - 8 bytes: LowPrice (little-endian float64)
 *   - 8 bytes: VolumeIn (little-endian float64)
 *   - 8 bytes: VolumeOut (little-endian float64)
 */
export function deserializeCandleData(data: ArrayBufferLike): Candle[] {
  const view = new DataView(data);
  let offset = 0;

  // Read count of candles (4 bytes, little-endian uint32)
  const count = view.getUint32(offset, true); // true = little-endian
  offset += 4;

  // Validate expected size
  const expectedSize = 4 + count * 64;
  if (data.byteLength !== expectedSize) {
    throw new Error(`Invalid data size: expected ${expectedSize}, got ${data.byteLength}`);
  }

  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    // Read Timestamp (8 bytes, little-endian int64)
    const timestamp = view.getBigInt64(offset, true);
    offset += 8;

    // Read OpenPrice (8 bytes, little-endian float64)
    const openPrice = view.getFloat64(offset, true);
    offset += 8;

    // Read ClosePrice (8 bytes, little-endian float64)
    const closePrice = view.getFloat64(offset, true);
    offset += 8;

    // Read HighPrice (8 bytes, little-endian float64)
    const highPrice = view.getFloat64(offset, true);
    offset += 8;

    // Read LowPrice (8 bytes, little-endian float64)
    const lowPrice = view.getFloat64(offset, true);
    offset += 8;

    // Read VolumeIn (8 bytes, little-endian float64)
    const volumeUSD = view.getFloat64(offset, true);
    offset += 8;

    // Read VolumeOut (8 bytes, little-endian float64)
    const volume = view.getFloat64(offset, true);
    offset += 8;

    candles.push({
      Timestamp: Number(timestamp), // Convert BigInt to number
      OpenPrice: openPrice,
      ClosePrice: closePrice,
      HighPrice: highPrice,
      LowPrice: lowPrice,
      VolumeIn: volumeUSD,
      VolumeOut: volume,
    });
  }

  return candles;
}

/**
 * Deserializes binary RealTimeTrade data from WebSocket
 * 
 * Binary format for RealTimeTrade (24 bytes):
 * - 8 bytes: TradeTime (little-endian int64)
 * - 8 bytes: AmountIn (little-endian float64)
 * - 8 bytes: AmountOut (little-endian float64)
 * - Price is calculated as AmountIn / AmountOut
 */
export function deserializeRealTimeTradeData(data: ArrayBufferLike): RealTimeTrade {
  console.log('Deserializing RealTimeTrade data:', {
    byteLength: data.byteLength,
    data: Array.from(new Uint8Array(data))
  });
  
  const view = new DataView(data);
  let offset = 0;

  // Validate size (24 bytes for one RealTimeTrade)
  if (data.byteLength !== 24) {
    throw new Error(`Invalid RealTimeTrade data size: expected 24, got ${data.byteLength}`);
  }

  try {
    // Read TradeTime (8 bytes, little-endian int64)
    const tradeTime = view.getBigInt64(offset, true);
    console.log('TradeTime:', tradeTime);
    offset += 8;

    // Read used (8 bytes, little-endian float64)
    const usd = view.getFloat64(offset, true);
    console.log('USD:', usd);
    offset += 8;

    // Read amount (8 bytes, little-endian float64)
    const amount = view.getFloat64(offset, true);
    console.log('Amount:', amount);
    offset += 8;

    const result = {
      TradeTime: Number(tradeTime), // Convert BigInt to number
      USD: usd,
      Amount: amount,
      Price: usd / amount,
    };
    
    console.log('Deserialized RealTimeTrade:', result);
    return result;
  } catch (error) {
    console.error('Error during deserialization:', error);
    throw error;
  }
}

/**
 * Deserializes binary candle data from a Uint8Array
 */
export function deserializeCandleDataFromBytes(data: Uint8Array): Candle[] {
  return deserializeCandleData(data.buffer);
}

/**
 * Deserializes binary RealTimeTrade data from a Uint8Array
 */
export function deserializeRealTimeTradeDataFromBytes(data: Uint8Array): RealTimeTrade {
  return deserializeRealTimeTradeData(data.buffer);
}

/**
 * Deserializes binary candle data from a base64 string
 */
export function deserializeCandleDataFromBase64(base64Data: string): Candle[] {
  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return deserializeCandleDataFromBytes(bytes);
}

/**
 * Creates mock binary data for testing (matches Go format)
 */
export function createMockBinaryData(candles: Candle[]): ArrayBuffer {
  const buffer = new ArrayBuffer(4 + candles.length * 64);
  const view = new DataView(buffer);
  let offset = 0;

  // Write count (4 bytes, little-endian uint32)
  view.setUint32(offset, candles.length, true);
  offset += 4;

  // Write each candle (64 bytes each)
  for (const candle of candles) {
    // Write Timestamp (8 bytes, little-endian int64)
    view.setBigInt64(offset, BigInt(candle.Timestamp), true);
    offset += 8;

    // Write OpenPrice (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.OpenPrice, true);
    offset += 8;

    // Write ClosePrice (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.ClosePrice, true);
    offset += 8;

    // Write HighPrice (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.HighPrice, true);
    offset += 8;

    // Write LowPrice (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.LowPrice, true);
    offset += 8;

    // Write VolumeIn (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.VolumeIn, true);
    offset += 8;

    // Write VolumeOut (8 bytes, little-endian float64)
    view.setFloat64(offset, candle.VolumeOut, true);
    offset += 8;
  }

  return buffer;
}

