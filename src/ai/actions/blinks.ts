/**
 * @module ai/actions/blinks
 * @description Solana Blinks — URL generation and social metadata.
 *
 * Blinks are shareable URLs that render as interactive cards in
 * wallets, social media, and messaging apps. This module generates
 * Blink URLs and HTML metadata for social previews.
 *
 * @example
 * ```ts
 * import { BlinkGenerator } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const blinks = new BlinkGenerator({
 *   actionUrl: 'https://myagent.xyz/api/actions/jupiter-swap',
 * });
 *
 * // Generate a shareable Blink URL
 * const url = blinks.createUrl({ inputMint: 'SOL', outputMint: 'USDC', amount: '1000000000' });
 * // → "https://dial.to/?action=solana-action:https://myagent.xyz/api/actions/jupiter-swap?inputMint=SOL&outputMint=USDC&amount=1000000000"
 *
 * // Generate social metadata HTML
 * const meta = blinks.createMetadata({
 *   title: 'Swap SOL → USDC',
 *   description: 'One-click swap powered by Jupiter',
 *   image: 'https://myagent.xyz/preview.png',
 * });
 * ```
 *
 * @since 1.3.0
 */

import type { BlinkConfig, BlinkMetadata, ActionDefinition, ActionServerConfig } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Constants
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Default Blink resolver URL (dial.to by Dialect).
 * @since 1.3.0
 */
export const DEFAULT_RESOLVER_URL = 'https://dial.to';

/**
 * @description Solana Action URL scheme prefix.
 * @since 1.3.0
 */
export const ACTION_SCHEME = 'solana-action:';

/* ═══════════════════════════════════════════════════════════════
 *  BlinkGenerator
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Generates Blink URLs, social metadata, and embeddable HTML
 * for Solana Actions.
 *
 * A Blink wraps a Solana Action URL in a resolver service (like dial.to)
 * that renders an interactive card with wallet signing capability.
 *
 * @since 1.3.0
 */
export class BlinkGenerator {
  private readonly resolverUrl: string;
  private readonly actionUrl: string;
  private readonly cluster: string;

  /**
   * @param {BlinkConfig} config - Blink configuration
   */
  constructor(config: BlinkConfig) {
    this.resolverUrl = (config.resolverUrl ?? DEFAULT_RESOLVER_URL).replace(/\/$/, '');
    this.actionUrl = config.actionUrl;
    this.cluster = config.cluster ?? 'mainnet-beta';
  }

  /**
   * @description Generate a shareable Blink URL.
   *
   * Format: `https://dial.to/?action=solana-action:<actionUrl>?params&cluster=<cluster>`
   *
   * @param {Record<string, string | number>} [params] - Query parameters to include
   * @returns {string} Blink URL
   *
   * @example
   * ```ts
   * const url = blinks.createUrl({ inputMint: 'SOL', outputMint: 'USDC', amount: '1e9' });
   * // Share this URL on Twitter, Discord, etc.
   * ```
   *
   * @since 1.3.0
   */
  createUrl(params?: Record<string, string | number>): string {
    let actionUrl = this.actionUrl;

    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        qs.set(key, String(value));
      }
      const separator = actionUrl.includes('?') ? '&' : '?';
      actionUrl += `${separator}${qs.toString()}`;
    }

    const blinkUrl = new URL(this.resolverUrl);
    blinkUrl.searchParams.set('action', `${ACTION_SCHEME}${actionUrl}`);
    if (this.cluster !== 'mainnet-beta') {
      blinkUrl.searchParams.set('cluster', this.cluster);
    }

    return blinkUrl.toString();
  }

  /**
   * @description Generate social metadata for a Blink.
   *
   * Returns OpenGraph and Twitter Card metadata that can be inserted
   * into an HTML page's `<head>` for rich social previews.
   *
   * @param {object} opts - Metadata options
   * @param {string} opts.title - Page title
   * @param {string} opts.description - Page description
   * @param {string} opts.image - Preview image URL (1200×630 recommended)
   * @param {Record<string, string | number>} [opts.params] - Action parameters for the URL
   * @returns {BlinkMetadata} Social metadata object
   *
   * @example
   * ```ts
   * const meta = blinks.createMetadata({
   *   title: 'Swap SOL → USDC',
   *   description: 'Powered by Jupiter & Synapse',
   *   image: 'https://myagent.xyz/og-image.png',
   * });
   * ```
   *
   * @since 1.3.0
   */
  createMetadata(opts: {
    title: string;
    description: string;
    image: string;
    params?: Record<string, string | number>;
  }): BlinkMetadata {
    return {
      url: this.createUrl(opts.params),
      title: opts.title,
      description: opts.description,
      image: opts.image,
      twitterCard: 'summary_large_image',
      ogType: 'website',
    };
  }

  /**
   * @description Generate HTML meta tags for social previews.
   *
   * @param {BlinkMetadata} metadata - Metadata from {@link createMetadata}
   * @returns {string} HTML string of `<meta>` tags
   *
   * @example
   * ```ts
   * const html = blinks.toMetaTags(metadata);
   * // Insert into <head> of your HTML page
   * ```
   *
   * @since 1.3.0
   */
  toMetaTags(metadata: BlinkMetadata): string {
    const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');

    return [
      `<meta property="og:title" content="${esc(metadata.title)}" />`,
      `<meta property="og:description" content="${esc(metadata.description)}" />`,
      `<meta property="og:image" content="${esc(metadata.image)}" />`,
      `<meta property="og:url" content="${esc(metadata.url)}" />`,
      `<meta property="og:type" content="${metadata.ogType ?? 'website'}" />`,
      `<meta name="twitter:card" content="${metadata.twitterCard ?? 'summary_large_image'}" />`,
      `<meta name="twitter:title" content="${esc(metadata.title)}" />`,
      `<meta name="twitter:description" content="${esc(metadata.description)}" />`,
      `<meta name="twitter:image" content="${esc(metadata.image)}" />`,
    ].join('\n');
  }

  /**
   * @description Generate a full HTML page that hosts the Blink.
   *
   * The page includes social meta tags and a redirect to the Blink resolver.
   * Useful for creating shareable landing pages.
   *
   * @param {BlinkMetadata} metadata - Metadata from {@link createMetadata}
   * @returns {string} Complete HTML page string
   *
   * @example
   * ```ts
   * const html = blinks.toHtmlPage(metadata);
   * // Serve as response for the Blink URL's landing page
   * ```
   *
   * @since 1.3.0
   */
  toHtmlPage(metadata: BlinkMetadata): string {
    const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(metadata.title)}</title>
  ${this.toMetaTags(metadata)}
  <meta http-equiv="refresh" content="0;url=${esc(metadata.url)}" />
</head>
<body>
  <p>Redirecting to <a href="${esc(metadata.url)}">${esc(metadata.title)}</a>…</p>
</body>
</html>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Convenience: createBlinkFromAction
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create a {@link BlinkGenerator} directly from an
 * {@link ActionDefinition} and {@link ActionServerConfig}.
 *
 * @param {ActionDefinition} action - Action definition
 * @param {ActionServerConfig} serverConfig - Action server config
 * @param {Partial<BlinkConfig>} [blinkConfig] - Optional Blink overrides
 * @returns {BlinkGenerator} Configured Blink generator
 *
 * @example
 * ```ts
 * const blinks = createBlinkFromAction(swapAction, serverConfig);
 * const url = blinks.createUrl({ amount: '1000000' });
 * ```
 *
 * @since 1.3.0
 */
export function createBlinkFromAction(
  action: ActionDefinition,
  serverConfig: ActionServerConfig,
  blinkConfig?: Partial<BlinkConfig>,
): BlinkGenerator {
  const baseUrl = serverConfig.baseUrl.replace(/\/$/, '');
  const prefix = serverConfig.pathPrefix ?? '/api/actions';
  const actionUrl = `${baseUrl}${prefix}/${action.id}`;

  return new BlinkGenerator({
    actionUrl,
    resolverUrl: blinkConfig?.resolverUrl,
    cluster: blinkConfig?.cluster,
  });
}
