import { Component, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CryptoChartComponent } from '../../components/crypto-chart/crypto-chart.component';
import { WatchlistService, WatchlistToken, AlertSettings } from '../../../services/watchlist.service';

interface PopularToken {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  trending: string;
  chainId: string;
  tokenAddress: string;
}

@Component({
  selector: 'app-watch',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CryptoChartComponent],
  templateUrl: './watch.component.html',
  styleUrls: ['./watch.component.scss']
})
export class WatchComponent implements OnDestroy {
  // Expose Math for template
  Math = Math;

  // Use the watchlist service
  watchlist = computed(() => this.watchlistService.watchlist());

  popularTokens = signal<PopularToken[]>([
    { id: '1', symbol: 'SOL', name: 'Solana', price: 152.34, change24h: 5.67, volume24h: 2456789123, trending: '🔥 Hot', chainId: '1399811149', tokenAddress: 'So11111111111111111111111111111111111111112' },
    { id: '2', symbol: 'BTC', name: 'Bitcoin', price: 43250.50, change24h: 2.34, volume24h: 28567891234, trending: '📈 Rising', chainId: '1', tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    { id: '3', symbol: 'ETH', name: 'Ethereum', price: 2280.75, change24h: 3.21, volume24h: 15678912345, trending: '⚡ Volatile', chainId: '1', tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { id: '4', symbol: 'BONK', name: 'Bonk', price: 0.000012, change24h: 12.45, volume24h: 456789123, trending: '🚀 Pumping', chainId: '1399811149', tokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { id: '5', symbol: 'WIF', name: 'Dogwifhat', price: 2.34, change24h: 8.90, volume24h: 234567891, trending: '🔥 Hot', chainId: '1399811149', tokenAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' }
  ]);

  currentSlide = signal(0);
  showSettingsDialog = signal(false);
  showChartModal = signal(false);
  selectedToken = signal<WatchlistToken | null>(null);
  chartToken = signal<WatchlistToken | null>(null);
  isChartLoading = signal(true);

  // Alert settings form
  alertForm = {
    interval_1m: null as number | null,
    interval_5m: null as number | null,
    interval_15m: null as number | null,
    interval_1h: null as number | null,
    notes: '' as string
  };

  constructor(private watchlistService: WatchlistService) {}

  ngOnInit() {
    // Auto-rotate carousel
    setInterval(() => {
      this.nextSlide();
    }, 5000);

    // Add ESC key listener for closing modals
    document.addEventListener('keydown', this.handleEscKey.bind(this));
  }

  ngOnDestroy() {
    // Ensure body scroll is restored on component destroy
    document.body.style.overflow = '';
    // Remove ESC key listener
    document.removeEventListener('keydown', this.handleEscKey.bind(this));
  }

  handleEscKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showChartModal()) {
        this.closeChart();
      } else if (this.showSettingsDialog()) {
        this.closeSettings();
      }
    }
  }

  nextSlide() {
    const maxSlide = Math.ceil(this.popularTokens().length / 3) - 1;
    this.currentSlide.update(v => (v >= maxSlide ? 0 : v + 1));
  }

  prevSlide() {
    const maxSlide = Math.ceil(this.popularTokens().length / 3) - 1;
    this.currentSlide.update(v => (v <= 0 ? maxSlide : v - 1));
  }

  async toggleAlert(watch: WatchlistToken) {
    await this.watchlistService.toggleWatchTokenAlert(watch.id,watch.alertEnabled);
  }

  async removeToken(tokenId: number) {
    if (confirm('Remove this token from your watchlist?')) {
      await this.watchlistService.removeWatchToken(tokenId);
    }
  }

  openSettings(token: WatchlistToken) {
    this.selectedToken.set(token);
    if (token.alertSettings) {
      this.alertForm = {
        interval_1m: token.alertSettings.interval_1m || null,
        interval_5m: token.alertSettings.interval_5m || null,
        interval_15m: token.alertSettings.interval_15m || null,
        interval_1h: token.alertSettings.interval_1h || null,
        notes: token.notes || ''
      };
    } else {
      // Reset form
      this.alertForm = {
        interval_1m: null,
        interval_5m: null,
        interval_15m: null,
        interval_1h: null,
        notes: ''
      };
    }
    this.showSettingsDialog.set(true);
  }

  closeSettings() {
    this.showSettingsDialog.set(false);
    this.selectedToken.set(null);
  }

  async saveSettings() {
    const token = this.selectedToken();
    if (!token) return;

    const settings: AlertSettings = {
      interval_1m: this.alertForm.interval_1m || undefined,
      interval_5m: this.alertForm.interval_5m || undefined,
      interval_15m: this.alertForm.interval_15m || undefined,
      interval_1h: this.alertForm.interval_1h || undefined,
    };

    const success = await this.watchlistService.updateWatchTokenAlertSettings(
      token.id,
      settings,
      this.alertForm.notes
    );

    if (success) {
      this.closeSettings();
    } else {
      alert('Failed to save settings. Please try again.');
    }
  }

  async addToWatchlist(token: PopularToken) {
    // Convert PopularToken to a format compatible with addToken
    const success = await this.watchlistService.addToken({
      id: parseInt(token.id),
      symbol: token.symbol,
      name: token.name,
      price: token.price,
      change24h: token.change24h,
      volume24h: token.volume24h,
      tokenAddress: token.tokenAddress,
      chainId: token.chainId
    } as any);

    if (success) {
      alert(`${token.symbol} added to watchlist!`);
    } else {
      alert(`Failed to add ${token.symbol}. It may already be in your watchlist.`);
    }
  }

  openChart(token: WatchlistToken) {
    this.chartToken.set(token);
    this.showChartModal.set(true);
    this.isChartLoading.set(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Simulate chart loading (in real app, this would be triggered by chart component)
    setTimeout(() => {
      this.isChartLoading.set(false);
    }, 1500);
  }

  closeChart() {
    this.showChartModal.set(false);
    this.chartToken.set(null);
    this.isChartLoading.set(true);
    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Build API tokenId from chainId and tokenAddress
   * API expects format: "chainId-tokenAddress"
   */
  getApiTokenId(token: WatchlistToken): string {
    return `${token.chainId}-${token.tokenAddress.substring(2).toLowerCase()}`;
  }
}
