import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import * as ts from 'typescript';

/**
 * User-visible copy must come from the locale catalogs (src/i18n/locales).
 * Scans string literals, template chunks and JSX text (comments are ignored) for
 * Hangul / Kana / CJK ideographs, which would bypass t() for en/ja/ko users.
 */
const MOBILE_ROOT = join(__dirname, '..', '..');
const CJK = /[぀-ヿ㐀-鿿가-힣]/;

/**
 * Intentional, reviewed exceptions (file → exact literal chunks).
 * DateFormatId 'ko' is a stamp format the user picks; it is frozen on sealed cards,
 * so its output and its sample label stay Korean in every UI language.
 */
const ALLOWED: Record<string, string[]> = {
  'src/domain/dates.ts': ['년 ', '월 ', '일'],
  'src/screens/SettingsScreen.tsx': ['YYYY년 M월 D일'],
};

function sourceFiles(): string[] {
  const out: string[] = [join(MOBILE_ROOT, 'App.tsx')];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (full === join(MOBILE_ROOT, 'src', 'i18n', 'locales')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  };
  walk(join(MOBILE_ROOT, 'src'));
  return out;
}

function cjkLiterals(file: string): { line: number; text: string }[] {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    let chunk: string | null = null;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      chunk = node.text;
    } else if (ts.isJsxText(node)) {
      chunk = node.getText(sf).trim();
    }
    if (chunk && CJK.test(chunk)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push({ line: line + 1, text: chunk });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('no hardcoded user-visible copy outside locale catalogs', () => {
  it('App.tsx and src/** use t() instead of Korean/Japanese literals', () => {
    const violations: string[] = [];
    for (const file of sourceFiles()) {
      const rel = relative(MOBILE_ROOT, file).split(sep).join('/');
      const allowed = ALLOWED[rel] ?? [];
      for (const hit of cjkLiterals(file)) {
        if (!allowed.includes(hit.text)) violations.push(`${rel}:${hit.line} ${JSON.stringify(hit.text)}`);
      }
    }
    assert.deepEqual(violations, []);
  });
});
