import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Token } from '../../../types/token';
import { TokenListComponent } from '../token-list/token-list.component';
import { CryptoChartComponent } from '../crypto-chart/crypto-chart.component';
import { getApiTokenId } from '../../../utils/token-utils';

@Component({
  selector: 'app-token-management',
  standalone: true,
  imports: [CommonModule, TokenListComponent, CryptoChartComponent],
  templateUrl: './token-management.component.html',
  styleUrls: ['./token-management.component.scss']
})
export class TokenManagementComponent {
  @ViewChild(CryptoChartComponent, { static: false }) chartComponent?: CryptoChartComponent;
  
  currentToken = signal<Token | null>(null);
  widgetConfig = signal<{
    tokenId: string;
    symbol: string;
    title: string;
  } | null>(null);
  showChart = signal<boolean>(false);
  chartTheme: 'light' | 'dark' = 'light';

  handleTokenClick(token: Token): void {
    this.currentToken.set(token);
    
    // Hide the chart when a token is clicked
    this.showChart.set(false);
    
    // Clear the widget configuration
    this.widgetConfig.set(null);
  }
  
  showChartForToken(token: Token): void {
    this.currentToken.set(token);
    
    // Create fixed widget configuration
    // Use getApiTokenId to construct the API format (chain_id-address) for chart/WebSocket calls
    const tokenId = getApiTokenId(token);
    
    const config = {
      tokenId, // API format for candle-chart and WebSocket
      symbol: `${token.token_symbol || token.symbol}/USDT`,
      title: `${token.token_name || token.name} Chart`
    };
    this.widgetConfig.set(config);
    this.showChart.set(true);
  }

  onChartError(error: string): void {
    console.error('Chart Error:', error);
  }

  onChartDataUpdate(data: any): void {
    console.log('Chart Data:', data.candles?.length, 'candles');
  }

  onChartTrade(trade: any): void {
    console.log('Chart Trade:', trade.Price);
  }

  onChartConnectionChange(status: string): void {
    console.log('Chart Status:', status);
  }

  toggleChartTheme(): void {
    // Update local theme state first
    this.chartTheme = this.chartTheme === 'light' ? 'dark' : 'light';
    
    // Toggle chart theme if chart component exists
    if (this.chartComponent) {
      this.chartComponent.toggleTheme();
    }
  }
}

