import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TokenService } from '../../../services/token.service';
import { Token } from '../../../types/token';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  trendingTokens = signal<Token[]>([]);
  isLoadingTrending = signal(true);
  
  constructor(private tokenService: TokenService) {}
  
  async ngOnInit() {
    await this.loadTrendingTokens();
  }
  
  async loadTrendingTokens() {
    this.isLoadingTrending.set(true);
    try {
      const tokens = await this.tokenService.fetchTrendingTokens(8);
      this.trendingTokens.set(tokens);
    } catch (error) {
      console.error('Error loading trending tokens:', error);
    } finally {
      this.isLoadingTrending.set(false);
    }
  }
  
  formatPrice(price: number | undefined): string {
    if (!price) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2
    }).format(price);
  }
  
  formatVolume(volume: number | undefined): string {
    if (!volume) return '$0';
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  }
  
  formatChange(change: number | undefined): string {
    if (!change) return '0.00%';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
  
  features = [
    {
      icon: '⚡',
      title: 'Real-time Data',
      description: 'WebSocket-powered live price updates with millisecond latency'
    },
    {
      icon: '📊',
      title: 'Professional Charts',
      description: 'Candlestick charts with volume, OHLC data, and customizable themes'
    },
    {
      icon: '🔌',
      title: 'Easy Integration',
      description: 'Drop-in widgets for React, Angular, Vue or vanilla JavaScript'
    },
    {
      icon: '🚀',
      title: 'Developer First',
      description: 'RESTful API, TypeScript SDK, and comprehensive documentation'
    }
  ];

  useCases = [
    {
      title: 'For Developers',
      icon: '💻',
      description: 'Build crypto apps with our powerful SDK and API',
      features: ['RESTful API', 'WebSocket Streaming', 'TypeScript SDK', 'Widget Library'],
      cta: 'View API Docs',
      link: '/developer'
    },
    {
      title: 'For Traders',
      icon: '📈',
      description: 'Track your favorite tokens in real-time',
      features: ['Live Watchlist', 'Price Alerts', 'Multi-token View', 'Export Data'],
      cta: 'Create Watchlist',
      link: '/watch'
    }
  ];
}

