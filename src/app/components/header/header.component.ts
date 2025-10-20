import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  isMobileMenuOpen = signal(false);
  
  // Get authentication state from AuthService
  isLoggedIn = computed(() => this.authService.isAuthenticated());
  currentUser = computed(() => this.authService.currentUser());

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
    this.isMobileMenuOpen.set(false);
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
    this.isMobileMenuOpen.set(false);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
    this.isMobileMenuOpen.set(false);
  }

  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }
}

