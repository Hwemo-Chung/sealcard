import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { en } from './locales/en';
import { ko } from './locales/ko';
import { ja } from './locales/ja';

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...leafKeys(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe('i18n key parity', () => {
  it('ko and ja have exactly the same keys as en', () => {
    const enKeys = leafKeys(en as unknown as Record<string, unknown>);
    const koKeys = leafKeys(ko as unknown as Record<string, unknown>);
    const jaKeys = leafKeys(ja as unknown as Record<string, unknown>);
    assert.deepEqual(koKeys, enKeys, 'ko keys differ from en');
    assert.deepEqual(jaKeys, enKeys, 'ja keys differ from en');
  });
});
