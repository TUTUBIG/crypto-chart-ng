import { Component, signal, OnDestroy, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CryptoChartComponent } from '../../components/crypto-chart/crypto-chart.component';
import { WatchlistService, WatchlistToken, AlertSettings } from '../../../services/watchlist.service';
import { TokenService } from '../../../services/token.service';
import { Token } from '../../../types/token';

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
export class WatchComponent implements OnInit, OnDestroy {
  // Expose Math for template
  Math = Math;

  // Use the watchlist service
  watchlist = computed(() => this.watchlistService.watchlist());

  popularTokens = signal<PopularToken[]>([]);
  isLoadingTrending = signal(true);
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

  constructor(
    private watchlistService: WatchlistService,
    private tokenService: TokenService
  ) {}

  async ngOnInit() {
    // Load trending tokens from API
    await this.loadTrendingTokens();

    // Auto-rotate carousel
    setInterval(() => {
      this.nextSlide();
    }, 5000);

    // Add ESC key listener for closing modals
    document.addEventListener('keydown', this.handleEscKey.bind(this));
  }

  async loadTrendingTokens() {
    this.isLoadingTrending.set(true);
    try {
      // Fetch hot, pumping, and rising tokens from API
      const [hotTokens, pumpingTokens, risingTokens] = await Promise.all([
        this.tokenService.fetchHotTokens(5).catch(err => {
          console.error('[WatchComponent] Error fetching hot tokens:', err);
          return [];
        }),
        this.tokenService.fetchPumpingTokens(5).catch(err => {
          console.error('[WatchComponent] Error fetching pumping tokens:', err);
          return [];
        }),
        this.tokenService.fetchRisingTokens(5).catch(err => {
          console.error('[WatchComponent] Error fetching rising tokens:', err);
          return [];
        })
      ]);

      // Combine all tokens and remove duplicates
      const allTokens = [...hotTokens, ...pumpingTokens, ...risingTokens];
      const uniqueTokens = Array.from(
        new Map(allTokens.map(token => {
          const tokenId = (token as any).token_id || `${token.chain_id}-${token.token_address}`.toLowerCase();
          return [tokenId, token];
        })).values()
      );

      // Convert Token[] to PopularToken[] format
      const popularTokens: PopularToken[] = uniqueTokens.slice(0, 15).map((token, index) => {
        // Determine trending badge based on which list it came from
        let trending = '🔥 Hot';
        if (pumpingTokens.some(t => 
          ((t as any).token_id || `${t.chain_id}-${t.token_address}`.toLowerCase()) === 
          ((token as any).token_id || `${token.chain_id}-${token.token_address}`.toLowerCase())
        )) {
          trending = '🚀 Pumping';
        } else if (risingTokens.some(t => 
          ((t as any).token_id || `${t.chain_id}-${t.token_address}`.toLowerCase()) === 
          ((token as any).token_id || `${token.chain_id}-${token.token_address}`.toLowerCase())
        )) {
          trending = '📈 Rising';
        }

        return {
          id: (token as any).token_id || `${token.chain_id}-${token.token_address}`.toLowerCase(),
          symbol: token.token_symbol || token.symbol || 'N/A',
          name: token.token_name || token.name || 'Unknown Token',
          price: token.price || 0,
          change24h: token.change24h || (token as any).price_change_rate || 0,
          volume24h: token.daily_volume_usd || token.volume24h || 0,
          trending,
          chainId: token.chain_id || '',
          tokenAddress: token.token_address || ''
        };
      });

      this.popularTokens.set(popularTokens);
    } catch (error) {
      console.error('[WatchComponent] Error loading trending tokens:', error);
      this.popularTokens.set([]);
    } finally {
      this.isLoadingTrending.set(false);
    }
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

  getCarouselSlides(): number[] {
    const maxSlides = Math.ceil(this.popularTokens().length / 3);
    return Array.from({ length: maxSlides }, (_, i) => i);
  }

  nextSlide() {
    if (this.popularTokens().length === 0) return;
    const maxSlide = Math.ceil(this.popularTokens().length / 3) - 1;
    this.currentSlide.update(v => (v >= maxSlide ? 0 : v + 1));
  }

  prevSlide() {
    if (this.popularTokens().length === 0) return;
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
