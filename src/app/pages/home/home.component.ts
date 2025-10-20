import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  
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

