#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to ESM imports
 * This ensures Node.js ESM compatibility while keeping source files clean
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESM_DIR = join(__dirname, '..', 'dist', 'esm');

async function fixImportsInFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  
  // Fix all relative imports/exports to add .js extension
  let fixedContent = content;
  
  // Fix: export { X } from './path'
  fixedContent = fixedContent.replace(
    /from\s+['"](\.\.[\/\\][^'"]*|\.\/[^'"]*?)(?<!\.js)['"]/g,
    (match, path) => `from '${path}.js'`
  );
  
  // Fix: import('./path')
  fixedContent = fixedContent.replace(
    /import\s*\(\s*['"](\.\.[\/\\][^'"]*|\.\/[^'"]*?)(?<!\.js)['"]\s*\)/g,
    (match, path) => `import('${path}.js')`
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
        console.log(`✓ Fixed: ${fullPath.replace(ESM_DIR, 'dist/esm')}`);
      }
    }
  }
  
  return fixed;
}

console.log('🔧 Fixing ESM imports by adding .js extensions...\n');

try {
  const fixedCount = await processDirectory(ESM_DIR);
  console.log(`\n✅ Fixed ${fixedCount} files with .js extensions`);
  process.exit(0);
} catch (error) {
  console.error('❌ Error fixing ESM imports:', error);
  process.exit(1);
}
