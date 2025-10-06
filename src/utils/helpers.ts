/**
 * Synapse Client SDK - Utility Functions
 * This module provides various utility functions for the Synapse Client SDK,
 * including validation, performance monitoring, stress testing, diagnostics,
 * and rate limit information retrieval.
 */
import { PublicKey } from '@solana/web3.js';
import type { SynapseClient } from '../client';
import {  SynapseConstants } from './constant';


/**
 * @name SynapseUtils
 * @description A collection of utility functions for the Synapse Client SDK
 * @class SynapseUtils
 * @method isValidSolanaAddress
 * @method isValidApiKey
 * @method monitorPerformance
 * @method runStressTest
 * @method diagnostics
 * @method getRateLimitInfo
 */
export class SynapseUtils {
  constructor(private client: SynapseClient) {}

  /**
   *  Validate Solana address using @solana/web3.js PublicKey
   */
  static isValidSolanaAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    
    try {
      // Use Solana's PublicKey class for proper validation
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   *  @name isValidApiKey
   *  Validate API key format
   */
  async isValidApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || typeof apiKey !== 'string') return false;

    const response = await fetch(`${SynapseConstants.SERVER_BASE_URL}/validate-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return data.valid === true;
    } else {
      return false;
    }
  }

  /**
   * @name monitorPerformance
   *  Performance monitor
   */
  async monitorPerformance(duration: number = 60000): Promise<void> {
    console.log('🔍 Starting performance monitoring...');
    
    const startTime = Date.now();
    const initialStats = this.client.getStats();
    
    const interval = setInterval(async () => {
      const currentStats = this.client.getStats();
      const elapsed = Date.now() - startTime;
      
      const rps = Math.round(
        (currentStats.requestCount - initialStats.requestCount) * 1000 / elapsed
      );
      
      console.log(` [${Math.round(elapsed/1000)}s] RPS: ${rps}, Latency: ${Math.round(currentStats.averageLatency)}ms, Errors: ${currentStats.errorCount}`);
      
      if (elapsed >= duration) {
        clearInterval(interval);
        console.log('✅ Performance monitoring completed');
      }
    }, 5000);
  }

  /**
   * Stress test runner
   */
  async runStressTest(options: {
    requests: number;
    concurrency: number;
    method?: string;
    params?: any[];
  }): Promise<{
    totalRequests: number;
    successfulRequests: number;
    averageLatency: number;
    requestsPerSecond: number;
    errorRate: number;
  }> {
    const { requests, concurrency, method = 'getSlot', params = [] } = options;
    
    console.log(`Starting stress test: ${requests} requests, ${concurrency} concurrent`);
    
    const startTime = performance.now();
    const results: Array<{ success: boolean; latency: number }> = [];
    
    // Execute requests in batches to control concurrency
    for (let i = 0; i < requests; i += concurrency) {
      const batchSize = Math.min(concurrency, requests - i);
      const batchPromises = Array(batchSize).fill(null).map(async () => {
        const reqStart = performance.now();
        try {
          await this.client.call(method, params);
          return { success: true, latency: performance.now() - reqStart };
        } catch {
          return { success: false, latency: performance.now() - reqStart };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Progress indicator
      if (i % (concurrency * 10) === 0) {
        console.log(`📈 Progress: ${Math.round((i / requests) * 100)}%`);
      }
    }
    
    const totalTime = performance.now() - startTime;
    const successfulRequests = results.filter(r => r.success).length;
    const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const requestsPerSecond = Math.round(requests * 1000 / totalTime);
    const errorRate = Math.round((1 - successfulRequests / requests) * 100);
    
    const report = {
      totalRequests: requests,
      successfulRequests,
      averageLatency: Math.round(averageLatency),
      requestsPerSecond,
      errorRate
    };
    
    console.log('>> Stress Test Results:');
    console.log(`    Successful: ${successfulRequests}/${requests} (${100 - errorRate}%)`);
    console.log(`    RPS: ${requestsPerSecond}`);
    console.log(`    Avg Latency: ${Math.round(averageLatency)}ms`);
    console.log(`    Total Time: ${Math.round(totalTime)}ms`);
    
    return report;
  }

  /**
   *  Gateway diagnostics
   */
  async diagnostics(): Promise<{
    gatewayHealth: boolean;
    upstreams: any[];
    performance: any;
    clientStats: any;
  }> {
    try {
      const [health, performance, clientStats] = await Promise.all([
        this.client.healthCheck(),
        this.client.getGatewayMetrics().catch(() => null),
        this.client.getStats()
      ]);

      return {
        gatewayHealth: health,
        upstreams: performance?.upstreams || [],
        performance: {
          version: performance?.gateway?.version,
          uptime: performance?.gateway?.uptime,
          memory: performance?.memory
        },
        clientStats
      };
    } catch (error: any) {
      throw new Error(`>> Diagnostics failed: ${error.message}`);
    }
  }

  /**
   *  Rate limit info
   */
  async getRateLimitInfo(): Promise<{
    plan: string;
    remaining: number;
    resetTime: number;
  } | null> {
    try {
      // Make a light request to get headers
      const response = await fetch(this.client['config'].endpoint + '/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.client['config'].apiKey
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSlot',
          params: []
        })
      });

      const plan = response.headers.get('x-synapse-plan');
      const remaining = response.headers.get('x-synapse-quota-remaining');
      const resetTime = response.headers.get('x-synapse-quota-reset');

      if (plan && remaining) {
        return {
          plan,
          remaining: parseInt(remaining),
          resetTime: resetTime ? parseInt(resetTime) : 0
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}

/**
 *  Static utility functions
 */
export class SynapseHelpers {
  /**
   * Convert lamports to SOL
   */
  static lamportsToSol(lamports: number): number {
    return lamports / 1_000_000_000;
  }

  /**
   * Convert SOL to lamports
   */
  static solToLamports(sol: number): number {
    return Math.floor(sol * 1_000_000_000);
  }

  /**
   * Format duration
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  /**
   * Format large numbers
   */
  static formatNumber(num: number): string {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  }

  /**
   * Check if signature format is valid
   */
  static isValidSignature(signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    return signature.length >= 86 && signature.length <= 88;
  }

  /**
   * Get commitment level priority
   */
  static getCommitmentPriority(commitment: string): number {
    const priorities = { processed: 1, confirmed: 2, finalized: 3 };
    return priorities[commitment as keyof typeof priorities] || 2;
  }
}
