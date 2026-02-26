#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to ESM imports.
 *
 * - Bare relative imports (`'./foo'`) get `.js` appended.
 * - If the resolved `.js` path does not exist but a **directory** with an
 *   `index.js` does, the import is rewritten to `'./foo/index.js'`.
 * - Imports that already end in `.js` are left untouched.
 *
 * This ensures Node.js ESM *and* webpack/Next.js compatibility.
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESM_DIR = join(__dirname, '..', 'dist', 'esm');

/**
 * Given the directory of the *importing* file and a bare relative specifier,
 * return the correct `.js`-suffixed specifier.
 */
function resolveSpecifier(importingDir, specifier) {
  // Already has .js — leave it alone
  if (specifier.endsWith('.js')) return specifier;

  const asFile = join(importingDir, specifier + '.js');
  const asDir  = join(importingDir, specifier, 'index.js');

  if (existsSync(asFile)) {
    return specifier + '.js';
  }
  if (existsSync(asDir)) {
    return specifier + '/index.js';
  }
  // Fallback: append .js and hope for the best
  return specifier + '.js';
}

async function fixImportsInFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const dir = dirname(filePath);

  let fixedContent = content;

  // Fix: from './path' / from '../path'
  fixedContent = fixedContent.replace(
    /from\s+['"](\.\.?\/[^'"]*?)(?<!\.js)['"]/g,
    (_match, spec) => `from '${resolveSpecifier(dir, spec)}'`
  );

  // Fix: import('./path')
  fixedContent = fixedContent.replace(
    /import\s*\(\s*['"](\.\.?\/[^'"]*?)(?<!\.js)['"]\s*\)/g,
    (_match, spec) => `import('${resolveSpecifier(dir, spec)}')`
  );

  if (content !== fixedContent) {
    await writeFile(filePath, fixedContent, 'utf-8');
    return true;
  }
  return false;
}

async function processDirectory(dir) {
  let fixed = 0;
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      fixed += await processDirectory(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const wasFixed = await fixImportsInFile(fullPath);
      if (wasFixed) {
        fixed++;
        console.log(`  Fixed: ${fullPath.replace(ESM_DIR, 'dist/esm')}`);
      }
    }
  }

  return fixed;
}

console.log('Fixing ESM imports (.js extensions + directory/index resolution)...\n');

try {
  const fixedCount = await processDirectory(ESM_DIR);
  console.log(`\nDone — fixed ${fixedCount} files`);
  process.exit(0);
} catch (error) {
  console.error('Error fixing ESM imports:', error);
  process.exit(1);
}
