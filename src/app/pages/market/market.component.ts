import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TokenManagementComponent } from '../../components/token-management/token-management.component';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, TokenManagementComponent],
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss']
})
export class MarketComponent {
  // Market page uses the existing token-management component
  // which already has token selection and chart display
}

