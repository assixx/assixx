/**
 * Rate Limit Controller
 * Handles countdown timer and automatic redirect after rate limit expires
 */

import { $$id } from '../../utils/dom-utils.js';

export class RateLimitController {
  private readonly RATE_LIMIT_DURATION = 20 * 1000; // 20 seconds in milliseconds
  private countdownEl: HTMLElement | null = null;
  private rateLimitTimestamp: number = 0;
  private timeLeft: number = 0;
  private timer: NodeJS.Timeout | null = null;

  /**
   * Initialize controller
   */
  public init(): void {
    this.clearAuthTokens();
    this.countdownEl = $$id('countdown');
    this.initializeTimestamp();
    this.startCountdown();
  }

  /**
   * Clear all authentication tokens from storage
   */
  private clearAuthTokens(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    sessionStorage.clear();
  }

  /**
   * Initialize rate limit timestamp
   */
  private initializeTimestamp(): void {
    const storedTimestamp = localStorage.getItem('rateLimitTimestamp');

    if (storedTimestamp === null) {
      // First time on rate limit page - set timestamp
      this.rateLimitTimestamp = Date.now();
      localStorage.setItem('rateLimitTimestamp', this.rateLimitTimestamp.toString());
    } else {
      this.rateLimitTimestamp = Number.parseInt(storedTimestamp, 10);

      // Clean up old timestamp if expired (>20 seconds old)
      if (Date.now() - this.rateLimitTimestamp > this.RATE_LIMIT_DURATION) {
        localStorage.removeItem('rateLimitTimestamp');
        this.rateLimitTimestamp = Date.now();
        localStorage.setItem('rateLimitTimestamp', this.rateLimitTimestamp.toString());
      }
    }
  }

  /**
   * Calculate remaining time in seconds
   */
  private getRemainingTime(): number {
    const elapsed = Date.now() - this.rateLimitTimestamp;
    const remaining = Math.max(0, this.RATE_LIMIT_DURATION - elapsed);
    return Math.floor(remaining / 1000); // Convert to seconds
  }

  /**
   * Update countdown display
   */
  private updateCountdown(): void {
    if (this.countdownEl === null) {
      return;
    }

    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    this.countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (this.timeLeft <= 0) {
      this.handleExpiredRateLimit();
      return;
    }

    this.timeLeft--;
  }

  /**
   * Handle expired rate limit - redirect to login
   */
  private handleExpiredRateLimit(): void {
    if (this.countdownEl !== null) {
      this.countdownEl.textContent = 'Weiterleitung...';
    }

    if (this.timer !== null) {
      clearInterval(this.timer);
    }

    // Clear the timestamp
    localStorage.removeItem('rateLimitTimestamp');

    // Automatically redirect to login after timer expires
    // Important: Only pass ratelimit parameter, not session=expired
    setTimeout(() => {
      window.location.href = '/login?ratelimit=expired';
    }, 1000);
  }

  /**
   * Start countdown timer
   */
  private startCountdown(): void {
    this.timeLeft = this.getRemainingTime();

    if (this.timeLeft > 0) {
      // Start timer if there's time remaining
      this.timer = setInterval(() => {
        this.updateCountdown();
      }, 1000);
      this.updateCountdown(); // Initial call
    } else {
      // Time already expired, redirect immediately
      if (this.countdownEl !== null) {
        this.countdownEl.textContent = 'Weiterleitung...';
      }

      localStorage.removeItem('rateLimitTimestamp');

      setTimeout(() => {
        window.location.href = '/login?ratelimit=expired';
      }, 500);
    }
  }
}
