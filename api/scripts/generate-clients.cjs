const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const schemaTokens = text => JSON.stringify((text.match(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s]/g) || [])
  .filter(token => !token.startsWith('//') && !token.startsWith('/*')));

function clientCurrent(schema, output) {
  try {
    return ['index.js', 'index.d.ts'].every(name => fs.existsSync(path.join(output, name)))
      && schemaTokens(fs.readFileSync(schema, 'utf8')) === schemaTokens(fs.readFileSync(path.join(output, 'schema.prisma'), 'utf8'));
  } catch { return false; }
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  for (const [schema, output] of [['prisma/schema.prisma', 'node_modules/.prisma/client'], ['users/schema.prisma', 'generated/users']]) {
    // Rewriting an unchanged engine fails on Windows while the API holds its DLL open.
    if (clientCurrent(path.join(root, schema), path.join(root, output))) continue;
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'generate', '--schema', schema], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) {
      console.error('Prisma client generation failed. If the schema changed, stop the running API before regenerating.');
      process.exit(result.status || 1);
    }
  }
}

module.exports = { clientCurrent };
