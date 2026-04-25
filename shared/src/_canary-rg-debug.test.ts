import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Canary: rg + PATH', () => {
  it('rg is in PATH and finds rate-limit goto', () => {
    const cmd = `rg --files-with-matches --glob '*.svelte' -e 'goto\\([^)]*\\x27/login' '${process.cwd()}/frontend/src' 2>&1`;
    let result;
    try {
      result = execSync(cmd, { encoding: 'utf-8' }).trim();
    } catch (e: any) {
      result = `ERROR(status=${e.status}): ${e.stderr || e.stdout}`;
    }
    console.log('CWD:', process.cwd());
    console.log('PATH:', process.env.PATH);
    console.log('RESULT:', result);
    expect(result).toContain('rate-limit');
  });
});
