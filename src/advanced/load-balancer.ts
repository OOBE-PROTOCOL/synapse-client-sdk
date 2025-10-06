/**
 * ⚖️ SYNAPSE ADVANCED SDK - INTELLIGENT LOAD BALANCER
 * Advanced load balancing with health monitoring and geo-routing
 */

import { EventEmitter } from 'eventemitter3';
import type { LoadBalancerConfig, UpstreamHealth } from './types';

export class LoadBalancer extends EventEmitter {
  private config: LoadBalancerConfig;
  private upstreams = new Map<string, UpstreamHealth>();
  private currentIndex = 0;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private requestCounts = new Map<string, number>();
  private responseTimeWindow = new Map<string, number[]>();

  constructor(
    config: LoadBalancerConfig,
    initialUpstreams: string[] = []
  ) {
    super();
    
    const defaults: LoadBalancerConfig = {
      strategy: 'adaptive',
      healthCheckInterval: 30000, // 30 seconds
      enableStickySessions: false,
      enableGeoRouting: false
    };
    
    this.config = { ...defaults, ...config };
    
    // Initialize upstreams
    initialUpstreams.forEach(endpoint => {
      this.addUpstream(endpoint);
    });

    this.startHealthChecking();
  }

  /**
   * 🎯 Select best upstream based on strategy
   */
  selectUpstream(sessionId?: string): string | null {
    const healthyUpstreams = Array.from(this.upstreams.values())
      .filter(upstream => upstream.healthy);

    if (healthyUpstreams.length === 0) {
      this.emit('no-healthy-upstreams');
      return null;
    }

    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(healthyUpstreams);
        
      case 'weighted':
        return this.weightedSelection(healthyUpstreams);
        
      case 'least-latency':
        return this.leastLatencySelection(healthyUpstreams);
        
      case 'health-based':
        return this.healthBasedSelection(healthyUpstreams);
        
      case 'adaptive':
        return this.adaptiveSelection(healthyUpstreams, sessionId);
        
      default:
        return healthyUpstreams[0]?.endpoint || null;
    }
  }

  /**
   * 🔄 Round robin selection
   */
  private roundRobinSelection(upstreams: UpstreamHealth[]): string {
    const upstream = upstreams[this.currentIndex % upstreams.length];
    this.currentIndex = (this.currentIndex + 1) % upstreams.length;
    return upstream.endpoint;
  }

  /**
   * ⚖️ Weighted selection
   */
  private weightedSelection(upstreams: UpstreamHealth[]): string {
    const totalWeight = upstreams.reduce((sum, upstream) => sum + upstream.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const upstream of upstreams) {
      random -= upstream.weight;
      if (random <= 0) {
        return upstream.endpoint;
      }
    }
    
    return upstreams[0].endpoint; // Fallback
  }

  /**
   * ⚡ Least latency selection
   */
  private leastLatencySelection(upstreams: UpstreamHealth[]): string {
    return upstreams.reduce((best, current) => 
      current.latency < best.latency ? current : best
    ).endpoint;
  }

  /**
   * 🏥 Health-based selection
   */
  private healthBasedSelection(upstreams: UpstreamHealth[]): string {
    // Score based on latency, error rate, and throughput
    const scored = upstreams.map(upstream => ({
      endpoint: upstream.endpoint,
      score: this.calculateHealthScore(upstream)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0].endpoint;
  }

  /**
   * 🤖 Adaptive selection (AI-enhanced)
   */
  private adaptiveSelection(upstreams: UpstreamHealth[], sessionId?: string): string {
    // Combine multiple factors for intelligent selection
    const now = Date.now();
    
    const scored = upstreams.map(upstream => {
      const baseScore = this.calculateHealthScore(upstream);
      const loadFactor = this.calculateLoadFactor(upstream.endpoint);
      const consistencyBonus = this.calculateConsistencyBonus(upstream.endpoint);
      const geoBonus = this.config.enableGeoRouting ? 
        this.calculateGeoBonus(upstream.endpoint) : 0;
      
      return {
        endpoint: upstream.endpoint,
        score: baseScore * (1 - loadFactor * 0.3) + consistencyBonus + geoBonus
      };
    });

    // Add some randomness to avoid thundering herd
    scored.forEach(item => {
      item.score += Math.random() * 0.1;
    });

    scored.sort((a, b) => b.score - a.score);
    
    // Sticky sessions if enabled
    if (this.config.enableStickySessions && sessionId) {
      const preferredUpstream = this.getPreferredUpstream(sessionId, scored);
      if (preferredUpstream) {
        return preferredUpstream;
      }
    }

    return scored[0].endpoint;
  }

  /**
   * 📊 Calculate health score for upstream
   */
  private calculateHealthScore(upstream: UpstreamHealth): number {
    const latencyScore = Math.max(0, 1 - (upstream.latency / 5000)); // Normalize to 5s max
    const errorScore = Math.max(0, 1 - upstream.errorRate);
    const throughputScore = Math.min(1, upstream.throughput / 1000); // Normalize to 1000 rps
    
    return (latencyScore * 0.4 + errorScore * 0.4 + throughputScore * 0.2);
  }

  /**
   * 📈 Calculate load factor
   */
  private calculateLoadFactor(endpoint: string): number {
    const requests = this.requestCounts.get(endpoint) || 0;
    const maxRequests = Math.max(...Array.from(this.requestCounts.values()), 1);
    return maxRequests > 0 ? requests / maxRequests : 0;
  }

  /**
   * 🎯 Calculate consistency bonus
   */
  private calculateConsistencyBonus(endpoint: string): number {
    const window = this.responseTimeWindow.get(endpoint) || [];
    if (window.length < 5) return 0; // Need some data
    
    const variance = this.calculateVariance(window);
    return Math.max(0, 0.1 - variance / 10000); // Bonus for consistent response times
  }

  /**
   * 🌍 Calculate geo routing bonus
   */
  private calculateGeoBonus(endpoint: string): number {
    // Simplified geo bonus - in reality would use geolocation
    if (endpoint.includes('us-')) return 0.1;
    if (endpoint.includes('eu-')) return 0.05;
    return 0;
  }

  /**
   * 📌 Get preferred upstream for sticky sessions
   */
  private getPreferredUpstream(sessionId: string, scored: Array<{endpoint: string, score: number}>): string | null {
    // Simple hash-based sticky sessions
    const hash = this.hashString(sessionId);
    const index = hash % scored.length;
    const preferred = scored[index];
    
    // Only use if score is reasonable (within 20% of best)
    if (preferred.score > scored[0].score * 0.8) {
      return preferred.endpoint;
    }
    
    return null;
  }

  /**
   * 🏥 Add upstream to pool
   */
  addUpstream(endpoint: string, weight = 1): void {
    if (this.upstreams.has(endpoint)) {
      console.warn(`Upstream ${endpoint} already exists`);
      return;
    }

    const upstream: UpstreamHealth = {
      endpoint,
      healthy: true,
      latency: 0,
      lastCheck: 0,
      errorRate: 0,
      throughput: 0,
      weight
    };

    this.upstreams.set(endpoint, upstream);
    this.requestCounts.set(endpoint, 0);
    this.responseTimeWindow.set(endpoint, []);
    
    this.emit('upstream-added', endpoint);
    
    // Immediate health check
    this.checkUpstreamHealth(endpoint);
  }

  /**
   * 🗑️ Remove upstream from pool
   */
  removeUpstream(endpoint: string): void {
    if (this.upstreams.delete(endpoint)) {
      this.requestCounts.delete(endpoint);
      this.responseTimeWindow.delete(endpoint);
      this.emit('upstream-removed', endpoint);
    }
  }

  /**
   * 📊 Record request metrics
   */
  recordRequest(endpoint: string, latency: number, success: boolean): void {
    const upstream = this.upstreams.get(endpoint);
    if (!upstream) return;

    // Update request count
    this.requestCounts.set(endpoint, (this.requestCounts.get(endpoint) || 0) + 1);

    // Update response time window
    const window = this.responseTimeWindow.get(endpoint) || [];
    window.push(latency);
    if (window.length > 100) window.shift(); // Keep last 100 measurements
    this.responseTimeWindow.set(endpoint, window);

    // Update upstream metrics
    upstream.latency = this.calculateEWMA(upstream.latency, latency, 0.1);
    upstream.errorRate = this.calculateEWMA(upstream.errorRate, success ? 0 : 1, 0.1);
    upstream.throughput = this.calculateThroughput(endpoint);

    this.emit('request-recorded', { endpoint, latency, success });
  }

  /**
   * 🏥 Health checking
   */
  private async checkUpstreamHealth(endpoint: string): Promise<void> {
    const upstream = this.upstreams.get(endpoint);
    if (!upstream) return;

    const startTime = performance.now();
    
    try {
      // Simple HTTP health check
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${endpoint}/health`, {
        signal: controller.signal,
        method: 'GET',
      });
      
      clearTimeout(timeout);
      
      const latency = performance.now() - startTime;
      const wasHealthy = upstream.healthy;
      upstream.healthy = response.ok;
      upstream.latency = this.calculateEWMA(upstream.latency, latency, 0.2);
      upstream.lastCheck = Date.now();

      if (!wasHealthy && upstream.healthy) {
        this.emit('upstream-recovered', endpoint);
      } else if (wasHealthy && !upstream.healthy) {
        this.emit('upstream-failed', endpoint);
      }

    } catch (error) {
      const wasHealthy = upstream.healthy;
      upstream.healthy = false;
      upstream.lastCheck = Date.now();
      
      if (wasHealthy) {
        this.emit('upstream-failed', { endpoint, error });
      }
    }
  }

  /**
   * 🔄 Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(() => {
      for (const endpoint of this.upstreams.keys()) {
        this.checkUpstreamHealth(endpoint);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 📊 Get load balancer metrics
   */
  getMetrics() {
    const upstreams = Array.from(this.upstreams.values());
    const totalRequests = Array.from(this.requestCounts.values())
      .reduce((sum, count) => sum + count, 0);

    return {
      strategy: this.config.strategy,
      totalUpstreams: upstreams.length,
      healthyUpstreams: upstreams.filter(u => u.healthy).length,
      totalRequests,
      upstreams: upstreams.map(upstream => ({
        endpoint: upstream.endpoint,
        healthy: upstream.healthy,
        latency: Math.round(upstream.latency),
        errorRate: Math.round(upstream.errorRate * 100) / 100,
        throughput: Math.round(upstream.throughput),
        weight: upstream.weight,
        requests: this.requestCounts.get(upstream.endpoint) || 0
      })),
      distribution: this.calculateRequestDistribution()
    };
  }

  /**
   * 📈 Calculate request distribution
   */
  private calculateRequestDistribution(): Array<{endpoint: string, percentage: number}> {
    const total = Array.from(this.requestCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    if (total === 0) return [];

    return Array.from(this.requestCounts.entries()).map(([endpoint, count]) => ({
      endpoint,
      percentage: Math.round((count / total) * 100 * 100) / 100
    }));
  }

  // ====== UTILITY METHODS ======

  private calculateEWMA(current: number, newValue: number, alpha: number): number {
    return current * (1 - alpha) + newValue * alpha;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  private calculateThroughput(endpoint: string): number {
    const window = this.responseTimeWindow.get(endpoint) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // This is simplified - in reality we'd track timestamps too
    return window.length; // Requests in last window
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 🧹 Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
