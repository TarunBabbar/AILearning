import * as AjvNs from 'ajv';
import * as addFormatsNs from 'ajv-formats';
import type { Spec } from '../types/index.ts';

export const SCHEMA_VERSION = 1 as const;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const AjvCtor = (AjvNs as unknown as { default?: unknown }).default ?? AjvNs;
const addFormats = (addFormatsNs as unknown as { default?: unknown }).default ?? addFormatsNs;

/**
 * Validates a spec (design or impl) against the shared JSON schema.
 * Used as a gate: no agent output may proceed to the next stage unless it validates.
 */
export async function validateSpec(spec: unknown, kind: 'design' | 'impl'): Promise<ValidationResult> {
  const { default: schema } = await import('../schemas/design-spec.schema.json', { with: { type: 'json' } });
  const AjvClass = AjvCtor as new (opts: Record<string, unknown>) => {
    compile(schema: unknown): (data: unknown) => boolean;
    errors: Array<{ instancePath: string; message?: string }> | null;
  };
  const ajv = new AjvClass({ allErrors: true, strict: false });
  (addFormats as (a: unknown) => void)(ajv);
  const validate = ajv.compile(schema);

  // kind must match the spec's declared kind
  if (spec && typeof spec === 'object' && (spec as Spec).kind && (spec as Spec).kind !== kind) {
    return { valid: false, errors: [`kind mismatch: expected "${kind}", got "${(spec as Spec).kind}"`] };
  }

  const ok = validate(spec);
  if (ok) return { valid: true, errors: [] };

  const errors = ((validate as unknown as { errors: Array<{ instancePath: string; message?: string }> | null }).errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
  );
  return { valid: false, errors };
}
