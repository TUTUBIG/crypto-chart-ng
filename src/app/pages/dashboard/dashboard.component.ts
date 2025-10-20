import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: Date;
  lastUsed: Date | null;
  requestsToday: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  apiKeys = signal<ApiKey[]>([
    {
      id: '1',
      name: 'Production API',
      key: 'fp_live_xxxxxxxxxxxxxxxx',
      created: new Date('2025-01-01'),
      lastUsed: new Date(),
      requestsToday: 15423
    }
  ]);

  stats = [
    { label: 'API Calls Today', value: '15,423', icon: '📊', change: '+12%' },
    { label: 'WebSocket Connections', value: '234', icon: '🔌', change: '+5%' },
    { label: 'Success Rate', value: '99.9%', icon: '✅', change: '0%' },
    { label: 'Avg Latency', value: '87ms', icon: '⚡', change: '-3%' }
  ];
}

