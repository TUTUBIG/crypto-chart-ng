import {ChangeDetectorRef, Component, computed, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Token, TokenFilterOptions} from '../../../types/token';
import {TokenService} from '../../../services/token.service';
import {WatchlistService} from '../../../services/watchlist.service';

@Component({
  selector: 'app-token-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './token-list.component.html',
  styleUrls: ['./token-list.component.scss']
})
export class TokenListComponent implements OnInit {
  @Input() selectedTokenId?: number;
  @Input() className: string = '';
  @Output() onTokenSelect = new EventEmitter<Token>();

  tokens: Token[] = [];
  loading = true;
  error: string | null = null;
  searchQuery = '';
  filterOptions: TokenFilterOptions = {
    search: '',
    isActive: true,
    sortBy: 'daily_volume_usd',
    sortOrder: 'desc',
    limit: 20
  };

  // Watchlist count for display
  watchlistCount = computed(() => this.watchlistService.watchlistCount());

  private searchTimeout: any;

  constructor(
    private tokenApiService: TokenService,
    private cdr: ChangeDetectorRef,
    public watchlistService: WatchlistService
  ) {}

  ngOnInit(): void {
    this.fetchTokens();
  }

  async fetchTokens(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      this.tokens = await this.tokenApiService.fetchTokens(this.filterOptions);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch tokens';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async searchTokens(query: string): Promise<void> {
    if (query.length < 2) {
      await this.fetchTokens();
      return;
    }

    try {
      this.loading = true;
      this.tokens = await this.tokenApiService.searchTokens(query, 20);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Search failed';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  handleSearchChange(query: string): void {
    this.searchQuery = query;

    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce search
    this.searchTimeout = setTimeout(() => {
      if (query) {
        this.searchTokens(query);
      } else {
        this.fetchTokens();
      }
    }, 300);
  }

  handleFilterChange(newFilter: Partial<TokenFilterOptions>): void {
    this.filterOptions = { ...this.filterOptions, ...newFilter };
    this.fetchTokens();
  }

  handleTokenClick(token: Token): void {
    this.onTokenSelect.emit(token);
  }

  formatPrice(price: number | undefined): string {
    if (price === undefined) return '--';
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatPercentage(percentage: number | undefined): string {
    if (percentage === undefined) return '--';
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  }

  formatVolume(volume: number | undefined): string {
    if (volume === undefined) return '--';
    if (volume >= 1000000000) {
      return `$${(volume / 1000000000).toFixed(1)}B`;
    } else if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    }
    return `$${volume.toFixed(0)}`;
  }

  isInWatchlist(token: Token): boolean {
    // Use numeric token.id for internal tracking
    return this.watchlistService.isInWatchlist(token.id);
  }

  async toggleWatchlist(event: Event, token: Token): Promise<void> {
    event.stopPropagation(); // Prevent card click

    // Use numeric token.id for internal tracking
    if (this.watchlistService.isInWatchlist(token.id)) {
      await this.watchlistService.removeWatchToken(token.id);
    } else {
      const added = await this.watchlistService.addToken(token);
      if (added) {
        // Optional: Show success feedback
        console.log(`Added ${token.token_symbol || token.symbol} to watchlist`);
      }
    }

    this.cdr.detectChanges();
  }
}

