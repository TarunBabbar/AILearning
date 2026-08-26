import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec } from '../shared/schemas/validate.ts';
import { LOGIN_SPEC, CHECKOUT_SPEC } from '../agents/design-extraction/sample-data.ts';

test('valid design specs pass validation', async () => {
  const r1 = await validateSpec(LOGIN_SPEC, 'design');
  assert.equal(r1.valid, true, r1.errors.join('; '));
  const r2 = await validateSpec(CHECKOUT_SPEC, 'design');
  assert.equal(r2.valid, true, r2.errors.join('; '));
});

test('impl spec with kind mismatch is rejected', async () => {
  const r = await validateSpec({ ...LOGIN_SPEC, kind: 'design' }, 'impl');
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('kind mismatch')));
});

test('broken spec (missing required element fields) is rejected', async () => {
  const broken = structuredClone(LOGIN_SPEC);
  // remove a required property from the first element
  delete (broken.elements[0] as unknown as Record<string, unknown>).bounds;
  const r = await validateSpec(broken, 'design');
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0, 'expected schema errors');
});

test('spec with invalid role is rejected', async () => {
  const broken = structuredClone(LOGIN_SPEC);
  (broken.elements[0] as { role: string }).role = 'not-a-real-role';
  const r = await validateSpec(broken, 'design');
  assert.equal(r.valid, false);
});
