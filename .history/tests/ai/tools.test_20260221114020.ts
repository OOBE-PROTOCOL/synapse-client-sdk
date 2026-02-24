/**
 * Tests for AI Tools — LangChain tool registration and execution.
 *
 * Verifies:
 * - All 53 Zod schemas are registered in agentRpcMethods
 * - createExecutableSolanaTools() creates tools with correct names
 * - Tool execution calls the mock transport with correct method
 * - include/exclude filters work
 * - Error handling returns JSON error objects (never throws)
 * - Tool descriptions contain meaningful info
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { agentRpcMethods, createExecutableSolanaTools, type SolanaToolkit } from '../../src/ai/tools';
import { MockSynapseClient } from './_helpers';

/* ═══════════════════════════════════════════════════════════════
 *  Zod schema registry
 * ═══════════════════════════════════════════════════════════════ */

describe('agentRpcMethods — Zod Schema Registry', () => {
  it('should register exactly 53 methods', () => {
    expect(agentRpcMethods.length).toBe(53);
  });

  it('every method has name, input, output, and description', () => {
    for (const m of agentRpcMethods) {
      expect(m.name).toBeTruthy();
      expect(m.input).toBeDefined();
      expect(m.output).toBeDefined();
      expect(m.description).toBeTruthy();
    }
  });

  it('method names are unique', () => {
    const names = agentRpcMethods.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes well-known methods', () => {
    const names = new Set(agentRpcMethods.map(m => m.name));
    const mustHave = [
      'getBalance', 'getAccountInfo', 'getSlot', 'getBlockHeight',
      'getTransaction', 'sendTransaction', 'getLatestBlockhash',
      'getVersion', 'getHealth', 'getEpochInfo',
    ];
    for (const method of mustHave) {
      expect(names.has(method), `Missing method: ${method}`).toBe(true);
    }
  });

  it('getBalance schema accepts valid input', () => {
    const getBalance = agentRpcMethods.find(m => m.name === 'getBalance')!;
    const result = getBalance.input.safeParse({
      pubkey: '11111111111111111111111111111111',
    });
    expect(result.success).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  createExecutableSolanaTools()
 * ═══════════════════════════════════════════════════════════════ */

describe('createExecutableSolanaTools()', () => {
  let client: MockSynapseClient;
  let toolkit: SolanaToolkit;

  beforeAll(() => {
    client = new MockSynapseClient();
    // Cast as any because MockSynapseClient satisfies the structural shape
    toolkit = createExecutableSolanaTools(client as any);
  });

  it('creates a tool for every registered method', () => {
    expect(toolkit.tools.length).toBe(53);
    expect(Object.keys(toolkit.toolMap).length).toBe(53);
  });

  it('tool names use "solana_" prefix by default', () => {
    for (const tool of toolkit.tools) {
      expect(tool.name).toMatch(/^solana_/);
    }
  });

  it('toolMap keys match method names (without prefix)', () => {
    const names = new Set(agentRpcMethods.map(m => m.name));
    for (const key of Object.keys(toolkit.toolMap)) {
      expect(names.has(key), `Unexpected toolMap key: ${key}`).toBe(true);
    }
  });

  it('allows custom prefix', () => {
    const custom = createExecutableSolanaTools(client as any, { prefix: 'rpc_' });
    for (const tool of custom.tools) {
      expect(tool.name).toMatch(/^rpc_/);
    }
  });

  it('include filter restricts tools', () => {
    const filtered = createExecutableSolanaTools(client as any, {
      include: ['getBalance', 'getSlot'],
    });
    expect(filtered.tools.length).toBe(2);
    expect(Object.keys(filtered.toolMap)).toEqual(expect.arrayContaining(['getBalance', 'getSlot']));
  });

  it('exclude filter removes tools', () => {
    const filtered = createExecutableSolanaTools(client as any, {
      exclude: ['getBalance'],
    });
    expect(filtered.tools.length).toBe(52);
    expect(filtered.toolMap['getBalance']).toBeUndefined();
  });

  it('include + exclude work together', () => {
    const filtered = createExecutableSolanaTools(client as any, {
      include: ['getBalance', 'getSlot', 'getVersion'],
      exclude: ['getSlot'],
    });
    expect(filtered.tools.length).toBe(2);
    expect(filtered.toolMap['getSlot']).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  Tool execution
 * ═══════════════════════════════════════════════════════════════ */

describe('Tool execution via mock transport', () => {
  let client: MockSynapseClient;
  let toolkit: SolanaToolkit;

  beforeAll(() => {
    client = new MockSynapseClient();
    client.stub('getBalance', { context: { slot: 42 }, value: 999_000_000 });
    client.stub('getSlot', 777_777);
    toolkit = createExecutableSolanaTools(client as any);
  });

  it('getBalance tool invokes transport.request with correct method', async () => {
    const getBalanceTool = toolkit.toolMap['getBalance'];
    const result = await getBalanceTool.invoke({ pubkey: '11111111111111111111111111111111' });

    // The tool returns a JSON string
    const parsed = JSON.parse(result as string);
    expect(parsed.value).toBe(999_000_000);
    expect(parsed.context.slot).toBe(42);

    // Verify the transport was called
    const call = client.transport.callLog.find(c => c.method === 'getBalance');
    expect(call).toBeDefined();
  });

  it('getSlot tool returns the slot number', async () => {
    const getSlotTool = toolkit.toolMap['getSlot'];
    const result = await getSlotTool.invoke({});
    const parsed = JSON.parse(result as string);
    expect(parsed).toBe(777_777);
  });

  it('returns JSON error on transport failure (never throws)', async () => {
    const failClient = new MockSynapseClient();
    // Override request to throw
    failClient.transport.request = async () => { throw new Error('Connection refused'); };
    const failToolkit = createExecutableSolanaTools(failClient as any);

    const result = await failToolkit.toolMap['getBalance'].invoke({ pubkey: 'abc' });
    const parsed = JSON.parse(result as string);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection refused');
  });

  it('tools produce pretty JSON by default', async () => {
    const result = await toolkit.toolMap['getBalance'].invoke({ pubkey: 'abc' }) as string;
    // Pretty JSON has newlines and indentation
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('prettyJson: false produces compact JSON', async () => {
    const compact = createExecutableSolanaTools(client as any, { prettyJson: false });
    const result = await compact.toolMap['getBalance'].invoke({ pubkey: 'abc' }) as string;
    expect(result).not.toContain('\n');
  });
});
