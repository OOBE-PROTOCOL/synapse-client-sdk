/**
 * ⚡ SYNAPSE ADVANCED SDK - CIRCUIT BREAKER
 * Enterprise-grade circuit breaker with intelligent recovery
 */

import { EventEmitter } from 'eventemitter3';
import type { CircuitBreakerConfig, CircuitState } from './types';

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitState;
  private nextAttempt = 0;
  private requestWindow: number[] = [];

  constructor(config: CircuitBreakerConfig) {
    super();
    
    // Set defaults and merge with provided config
    const defaults: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeout: 60000, // 1 minute
      retryInterval: 30000, // 30 seconds
      monitorWindow: 60000, // 1 minute
      enableFallback: true
    };
    
    this.config = { ...defaults, ...config };

    this.state = {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
      totalRequests: 0
    };
  }

  /**
   * 🔄 Execute request through circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (!this.canAttempt()) {
      if (this.config.enableFallback && fallback) {
        console.log('🔄 Circuit breaker: using fallback');
        return fallback();
      }
      throw new Error(`Circuit breaker is ${this.state.state}`);
    }

    this.state.totalRequests++;
    this.updateRequestWindow();

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * ✅ Handle successful request
   */
  private onSuccess(): void {
    this.state.successCount++;

    if (this.state.state === 'half-open') {
      // If we're in half-open state and got a success, close the circuit
      this.state.state = 'closed';
      this.state.failures = 0;
      this.emit('circuit-closed');
    }

    // Reset failure count on successful request in closed state
    if (this.state.state === 'closed') {
      this.state.failures = Math.max(0, this.state.failures - 1);
    }
  }

  /**
   * ❌ Handle failed request
   */
  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === 'closed' && this.shouldTrip()) {
      this.tripCircuit();
    } else if (this.state.state === 'half-open') {
      // If half-open and we get a failure, go back to open
      this.state.state = 'open';
      this.nextAttempt = Date.now() + this.config.retryInterval;
      this.emit('circuit-opened', { reason: 'half-open-failure' });
    }
  }

  /**
   * 🔍 Check if circuit should trip
   */
  private shouldTrip(): boolean {
    const failureRate = this.calculateFailureRate();
    return this.state.failures >= this.config.failureThreshold || 
           failureRate > 0.5; // 50% failure rate
  }

  /**
   * ⚡ Trip the circuit
   */
  private tripCircuit(): void {
    this.state.state = 'open';
    this.nextAttempt = Date.now() + this.config.timeout;
    this.emit('circuit-opened', { 
      reason: 'threshold-exceeded',
      failures: this.state.failures,
      failureRate: this.calculateFailureRate()
    });
  }

  /**
   * 🔄 Check if request can be attempted
   */
  private canAttempt(): boolean {
    const now = Date.now();

    switch (this.state.state) {
      case 'closed':
        return true;

      case 'open':
        if (now >= this.nextAttempt) {
          this.state.state = 'half-open';
          this.emit('circuit-half-open');
          return true;
        }
        return false;

      case 'half-open':
        return true;

      default:
        return false;
    }
  }

  /**
   * 📊 Calculate failure rate in current window
   */
  private calculateFailureRate(): number {
    const windowStart = Date.now() - this.config.monitorWindow;
    const recentRequests = this.requestWindow.filter(time => time > windowStart);
    
    if (recentRequests.length === 0) return 0;
    
    // This is a simplified calculation - in real implementation,
    // we'd track successes and failures separately
    return this.state.failures / Math.max(1, recentRequests.length);
  }

  /**
   * 📝 Update request time window
   */
  private updateRequestWindow(): void {
    const now = Date.now();
    this.requestWindow.push(now);
    
    // Clean old requests outside monitor window
    const windowStart = now - this.config.monitorWindow;
    this.requestWindow = this.requestWindow.filter(time => time > windowStart);
  }

  /**
   * 📈 Get circuit breaker metrics
   */
  getMetrics() {
    const now = Date.now();
    const windowStart = now - this.config.monitorWindow;
    const recentRequests = this.requestWindow.filter(time => time > windowStart);

    return {
      state: this.state.state,
      failures: this.state.failures,
      successCount: this.state.successCount,
      totalRequests: this.state.totalRequests,
      failureRate: this.calculateFailureRate(),
      recentRequests: recentRequests.length,
      lastFailureTime: this.state.lastFailureTime,
      nextAttemptIn: this.state.state === 'open' ? 
        Math.max(0, this.nextAttempt - now) : 0,
      config: this.config
    };
  }

  /**
   * 🔧 Manual circuit control
   */
  forceOpen(): void {
    this.state.state = 'open';
    this.nextAttempt = Date.now() + this.config.timeout;
    this.emit('circuit-forced-open');
  }

  forceClose(): void {
    this.state.state = 'closed';
    this.state.failures = 0;
    this.state.successCount = 0;
    this.emit('circuit-forced-closed');
  }

  forceHalfOpen(): void {
    this.state.state = 'half-open';
    this.emit('circuit-forced-half-open');
  }

  /**
   * 📊 Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    
    let health: 'healthy' | 'degraded' | 'unhealthy';
    if (metrics.state === 'closed' && metrics.failureRate < 0.1) {
      health = 'healthy';
    } else if (metrics.state === 'half-open' || metrics.failureRate < 0.5) {
      health = 'degraded';
    } else {
      health = 'unhealthy';
    }

    return {
      health,
      state: metrics.state,
      failureRate: metrics.failureRate,
      uptime: metrics.state === 'closed' ? 1 : 0,
      availability: 1 - (metrics.failures / Math.max(1, metrics.totalRequests))
    };
  }

  /**
   * 🧹 Reset circuit breaker state
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
      lastFailureTime: 0,
      successCount: 0,
      totalRequests: 0
    };
    this.requestWindow = [];
    this.nextAttempt = 0;
    this.emit('circuit-reset');
  }

  /**
   * ⚙️ Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * 📊 Advanced analytics
   */
  getAdvancedMetrics() {
    const basic = this.getMetrics();
    const now = Date.now();
    
    // Calculate MTTR (Mean Time To Recovery)
    const mttr = this.state.lastFailureTime > 0 ? 
      (now - this.state.lastFailureTime) / 1000 : 0;

    // Calculate availability over different time windows
    const availability1h = this.calculateAvailability(3600000);
    const availability24h = this.calculateAvailability(86400000);

    return {
      ...basic,
      mttr, // seconds
      availability: {
        current: basic.failureRate < 0.1 ? 1 : 0,
        '1h': availability1h,
        '24h': availability24h
      },
      performance: {
        requestsPerSecond: this.calculateRPS(),
        averageResponseTime: 0, // Would need to track this
        errorBudget: Math.max(0, 1 - (basic.failureRate / 0.1)) // 10% error budget
      }
    };
  }

  private calculateAvailability(windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const recentRequests = this.requestWindow.filter(time => time > windowStart);
    
    if (recentRequests.length === 0) return 1;
    
    // Simplified availability calculation
    return Math.max(0, 1 - (this.state.failures / recentRequests.length));
  }

  private calculateRPS(): number {
    const now = Date.now();
    const windowStart = now - 60000; // Last minute
    const recentRequests = this.requestWindow.filter(time => time > windowStart);
    
    return recentRequests.length / 60; // requests per second
  }
}
