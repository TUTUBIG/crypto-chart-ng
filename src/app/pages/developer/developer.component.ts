import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-developer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './developer.component.html',
  styleUrls: ['./developer.component.scss']
})
export class DeveloperComponent {
  apiExample = `// Install the SDK
npm install @fipulse/crypto-sdk

// Initialize
import { CryptoChartSDK } from '@fipulse/crypto-sdk';

const sdk = new CryptoChartSDK({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.fipulse.com'
});

// Fetch candle data
const candles = await sdk.fetchHistoryCandles(tokenId);

// Subscribe to real-time updates
sdk.connectWebSocket();
sdk.subscribe(tokenId);
sdk.onTrade((trade) => {
  console.log('New trade:', trade);
});`;

  widgetExample = `<!-- Add to your HTML -->
<div id="crypto-chart"></div>

<script src="https://cdn.fipulse.com/widget.js"></script>
<script>
  FiPulseWidget.create({
    container: '#crypto-chart',
    tokenId: 'YOUR_TOKEN_ID',
    theme: 'dark',
    height: 500
  });
</script>`;
}

