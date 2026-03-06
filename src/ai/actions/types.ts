/**
 * @module ai/actions/types
 * @description Solana Actions & Blinks — Type definitions.
 *
 * Implements the [Solana Actions specification](https://solana.com/docs/advanced/actions):
 * - `actions.json`      — CORS routing metadata
 * - `GET /api/action`   → Action definition (label, icon, links)
 * - `POST /api/action`  → Execute action, return transaction
 *
 * Plus custom extensions for x402 integration and tool monetization.
 *
 * @since 1.3.0
 */

/* ═══════════════════════════════════════════════════════════════
 *  Solana Actions Spec Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Action type as defined by the Solana Actions specification.
 * @since 1.3.0
 */
export type ActionType = 'action' | 'completed' | 'external-link';

/**
 * @description A parameter that the action accepts from the user.
 * @since 1.3.0
 */
export interface ActionParameter {
  /** Parameter name (used as query param key). */
  name: string;
  /** Human-readable label shown to the user. */
  label: string;
  /** Whether this parameter is required. @default true */
  required?: boolean;
  /**
   * Parameter type hint.
   * @default 'text'
   */
  type?: 'text' | 'number' | 'email' | 'url' | 'date' | 'select' | 'textarea' | 'checkbox';
  /** Pattern validation (regex). */
  pattern?: string;
  /** Validation error message. */
  patternDescription?: string;
  /** Min value (for number). */
  min?: number;
  /** Max value (for number). */
  max?: number;
  /** Options for select type. */
  options?: Array<{ label: string; value: string }>;
}

/**
 * @description A linked action — an interactive button or form in a Blink.
 * @since 1.3.0
 */
export interface LinkedAction {
  /** The URL to POST to when the user clicks this action. */
  href: string;
  /** Button label. */
  label: string;
  /** Parameters the action accepts. */
  parameters?: ActionParameter[];
}

/**
 * @description Response from `GET /api/action` — the action metadata.
 * This is what wallets/Blink renderers display to the user.
 * @since 1.3.0
 */
export interface ActionGetResponse {
  /** Action type. */
  type: ActionType;
  /** Icon URL (absolute, square aspect ratio recommended). */
  icon: string;
  /** Action title. */
  title: string;
  /** Descriptive text shown to the user. */
  description: string;
  /** Primary action label (button text). */
  label: string;
  /** Whether the action is currently disabled. */
  disabled?: boolean;
  /** Message shown when the action is disabled. */
  error?: { message: string };
  /** Linked actions (multiple buttons/forms). */
  links?: {
    actions: LinkedAction[];
  };
}

/**
 * @description Request body sent to `POST /api/action`.
 * @since 1.3.0
 */
export interface ActionPostRequest {
  /** User's wallet public key (base58). */
  account: string;
}

/**
 * @description Response from `POST /api/action`.
 * Contains a base64-encoded transaction for the wallet to sign.
 * @since 1.3.0
 */
export interface ActionPostResponse {
  /** Type of the post-action state. */
  type?: ActionType;
  /** Base64-encoded serialized transaction. */
  transaction: string;
  /** Optional message to display after signing. */
  message?: string;
  /** Optional redirect URL after signing. */
  links?: {
    next?: {
      type: ActionType;
      href: string;
    };
  };
}

/**
 * @description `actions.json` file content — routing rules for Blink resolution.
 * @since 1.3.0
 */
export interface ActionsJson {
  rules: ActionsJsonRule[];
}

/**
 * @description A single rule in `actions.json`.
 * @since 1.3.0
 */
export interface ActionsJsonRule {
  /** URL path pattern to match (supports wildcards). */
  pathPattern: string;
  /** API endpoint URL that serves the action. */
  apiPath: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Extended Types (Synapse SDK)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Handler function invoked when a user triggers an action.
 * Should return a serialized transaction (base64) or throw on error.
 *
 * @param {ActionContext} ctx - Execution context
 * @returns {Promise<ActionPostResponse>} Response with transaction
 * @since 1.3.0
 */
export type ActionHandler = (ctx: ActionContext) => Promise<ActionPostResponse>;

/**
 * @description Context passed to an {@link ActionHandler}.
 * @since 1.3.0
 */
export interface ActionContext {
  /** User's wallet public key. */
  account: string;
  /** Query parameters from the action URL. */
  params: Record<string, string>;
  /** The action definition. */
  action: ActionDefinition;
  /** Request headers (for x402 payment verification). */
  headers: Record<string, string>;
}

/**
 * @description A complete action definition registered with the {@link ActionServer}.
 * @since 1.3.0
 */
export interface ActionDefinition {
  /** Unique action ID (used in URL paths). */
  id: string;
  /** Action type. @default 'action' */
  type?: ActionType;
  /** Icon URL. */
  icon: string;
  /** Action title. */
  title: string;
  /** Action description. */
  description: string;
  /** Primary button label. */
  label: string;
  /** Whether the action is currently disabled. */
  disabled?: boolean;
  /** Disabled message. */
  disabledMessage?: string;
  /** Accepted parameters. */
  parameters?: ActionParameter[];
  /** Linked sub-actions. */
  linkedActions?: LinkedAction[];
  /** Handler function invoked on POST. */
  handler: ActionHandler;
  /**
   * If `true`, the action requires x402 payment before execution.
   * @default false
   */
  requiresPayment?: boolean;
  /**
   * Price in lamports/micro-units (for paid actions).
   */
  price?: bigint;
  /**
   * Custom metadata for the action.
   */
  metadata?: Record<string, unknown>;
}

/**
 * @description Configuration for the {@link ActionServer}.
 * @since 1.3.0
 */
export interface ActionServerConfig {
  /** Base URL where actions are hosted (e.g. `"https://myagent.xyz"`). */
  baseUrl: string;
  /** URL path prefix for action endpoints. @default '/api/actions' */
  pathPrefix?: string;
  /**
   * Icon URL used as default for actions without a custom icon.
   * @default `${baseUrl}/icon.png`
   */
  defaultIcon?: string;
  /**
   * CORS allowed origins.
   * @default ['*']
   */
  corsOrigins?: string[];
  /**
   * Custom headers added to every response.
   */
  extraHeaders?: Record<string, string>;
}

/**
 * @description Configuration for Blink URL generation.
 * @since 1.3.0
 */
export interface BlinkConfig {
  /** Blink resolver base URL. @default 'https://dial.to' */
  resolverUrl?: string;
  /** The Action URL to wrap in a Blink. */
  actionUrl: string;
  /** Cluster. @default 'mainnet-beta' */
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet';
}

/**
 * @description Social metadata for a Blink (OpenGraph, Twitter Cards).
 * @since 1.3.0
 */
export interface BlinkMetadata {
  /** Blink URL (shareable). */
  url: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description: string;
  /** Image URL for social preview. */
  image: string;
  /** Twitter card type. @default 'summary_large_image' */
  twitterCard?: string;
  /** OpenGraph type. @default 'website' */
  ogType?: string;
}
