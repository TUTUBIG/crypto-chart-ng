import { Component, signal, VERSION } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TokenManagementComponent } from './components/token-management/token-management.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TokenManagementComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Crypto Chart - Angular');
  protected readonly version = VERSION.full;
}
