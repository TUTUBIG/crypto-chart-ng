import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Token, TokenFilterOptions } from '../../../types/token';
import { TokenApiService } from '../../../services/token-api.service';

@Component({
  selector: 'app-token-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './token-list.component.html',
  styleUrls: ['./token-list.component.scss']
})
export class TokenListComponent implements OnInit {
  @Input() selectedTokenId?: string;
  @Input() className: string = '';
  @Output() onTokenSelect = new EventEmitter<Token>();

  tokens: Token[] = [];
  loading = true;
  error: string | null = null;
  searchQuery = '';
  filterOptions: TokenFilterOptions = {
    search: '',
    isActive: true,
    sortBy: 'token_symbol',
    sortOrder: 'asc',
    limit: 20
  };
  
  private searchTimeout: any;

  constructor(
    private tokenApiService: TokenApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchTokens();
  }

  async fetchTokens(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      
      const tokens = await this.tokenApiService.fetchTokens(this.filterOptions);
      this.tokens = tokens;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to fetch tokens';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async searchTokens(query: string): Promise<void> {
    if (query.length < 2) {
      this.fetchTokens();
      return;
    }

    try {
      this.loading = true;
      const searchResults = await this.tokenApiService.searchTokens(query, 20);
      this.tokens = searchResults;
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
}

