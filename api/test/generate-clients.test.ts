import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { clientCurrent } = require('../scripts/generate-clients.cjs');

test('unchanged clients avoid regeneration; missing output and schema changes require it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'course-radar-client-'));
  try {
    const schema = join(directory, 'schema.prisma');
    const output = join(directory, 'client');
    writeFileSync(schema, 'schema version 1');
    assert.equal(clientCurrent(schema, output), false);
    mkdirSync(output);
    writeFileSync(join(output, 'schema.prisma'), 'schema version 1');
    writeFileSync(join(output, 'index.js'), 'generated');
    assert.equal(clientCurrent(schema, output), false);
    writeFileSync(join(output, 'index.d.ts'), 'generated types');
    assert.equal(clientCurrent(schema, output), true);
    writeFileSync(join(output, 'schema.prisma'), '// Generated formatting\n schema   version  1\r\n');
    assert.equal(clientCurrent(schema, output), true);
    writeFileSync(schema, 'schema version 2');
    assert.equal(clientCurrent(schema, output), false);
    writeFileSync(schema, 'name String @default("A B")');
    writeFileSync(join(output, 'schema.prisma'), 'name String @default("AB")');
    assert.equal(clientCurrent(schema, output), false);
    writeFileSync(schema, 'fo String');
    writeFileSync(join(output, 'schema.prisma'), 'f oString');
    assert.equal(clientCurrent(schema, output), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
