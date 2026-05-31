/**
 * EarnFi + Synapse — human execution for SAP ecosystem agents.
 *
 * Run: npx tsx examples/earnfi-human-work.ts
 * Env: EARNFI_AGENT_TOKEN, RPC_URL (optional for catalog-only)
 */
import { SynapseAgentKit } from '../src/ai/plugins/registry';
import { createEarnFiPlugin } from '../src/ai/plugins/earnfi';

async function main() {
  const kit = new SynapseAgentKit({
    rpcUrl: process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  }).use(
    createEarnFiPlugin({
      agentToken: process.env.EARNFI_AGENT_TOKEN,
      // wallet + connection required for paid x402 creates:
      // wallet: myWallet,
      // connection: new Connection(process.env.RPC_URL!),
    }),
  );

  console.log(kit.summary());

  const toolMap = kit.getToolMap();
  const catalogTool = [...toolMap.values()].find((t) => t.name.includes('getCatalog'));
  if (catalogTool) {
    const catalog = await catalogTool.invoke({});
    console.log('Catalog sample:', JSON.stringify(catalog).slice(0, 500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
