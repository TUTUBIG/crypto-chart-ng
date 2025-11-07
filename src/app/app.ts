import { Component, OnInit, OnDestroy } from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { WebSocketService } from '../services/websocket.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, RouterLink],
  template: `
    <div class="app">
      <app-header />
      <main class="app-content">
        <router-outlet />
      </main>
      <footer class="app-footer">
        <div class="footer-container">
          <div class="footer-content">
            <div class="footer-brand">
              <span class="footer-logo">⚡ FiPulse</span>
              <p class="footer-tagline">Real-time crypto data infrastructure</p>
            </div>
            <div class="footer-links">
              <div class="footer-section">
                <h4>Product</h4>
                <a routerLink="/market">Market</a>
                <a routerLink="/watch">Watchlist</a>
                <a routerLink="/developer">API Docs</a>
              </div>
              <div class="footer-section">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
              </div>
              <div class="footer-section">
                <h4>Support</h4>
                <a href="#">Help Center</a>
                <a href="#">Contact</a>
                <a href="#">Status</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; 2025 FiPulse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  `,
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  constructor(
    private wsService: WebSocketService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('[App] Initializing application...');

    // Check if user is authenticated and fetch fresh profile data
    if (this.authService.isAuthenticated()) {
      console.log('[App] User is authenticated, fetching profile...');
      const result = await this.authService.fetchUserProfile();
      if (result.success) {
        console.log('[App] User profile loaded successfully');
      } else {
        console.warn('[App] Failed to load user profile:', result.error);
      }
    }

    // Connect to WebSocket
    console.log('[App] Initializing global WebSocket connection...');
    this.wsService.connect();
  }

  ngOnDestroy(): void {
    console.log('[App] Disconnecting global WebSocket...');
    this.wsService.disconnect();
  }
}
