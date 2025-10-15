import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Token } from '../../../types/token';
import { TokenListComponent } from '../token-list/token-list.component';
import { CryptoChartComponent } from '../crypto-chart/crypto-chart.component';
import { constructTokenId } from '../../../utils/token-utils';

@Component({
  selector: 'app-token-management',
  standalone: true,
  imports: [CommonModule, TokenListComponent, CryptoChartComponent],
  templateUrl: './token-management.component.html',
  styleUrls: ['./token-management.component.scss']
})
export class TokenManagementComponent {
  currentToken = signal<Token | null>(null);
  widgetConfig = signal<{
    tokenId: string;
    symbol: string;
    title: string;
  } | null>(null);
  showChart = signal<boolean>(false);

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
    // Ensure tokenId is in the correct format: {chain_id}-{lowercase(token_address)}
    const tokenId = token.tokenId || constructTokenId(token.chain_id, token.token_address);
    
    const config = {
      tokenId,
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
}

