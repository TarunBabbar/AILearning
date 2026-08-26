/**
 * Bundled sample screens used in --sample mode.
 * Two screens:
 *  - "login"      : already built → Pipeline A (regression validation)
 *  - "checkout"   : still in design → Pipeline B (shift-left test generation)
 *
 * These are *specs* (shared shape), so the whole pipeline runs offline.
 */

import type { Spec } from '../../shared/types/index.ts';

const base = (id: string, name: string): Spec['screen'] => ({
  id,
  name,
  source: 'sample',
  figmaFileKey: 'sample-file',
  frameId: `frame-${id}`,
  designVersion: 'v1.0',
  retrievedAt: new Date().toISOString(),
});

export const LOGIN_SPEC: Spec = {
  schemaVersion: 1,
  kind: 'design',
  screen: base('login', 'Login'),
  viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  elements: [
    {
      id: 'login-header',
      name: 'Page header',
      type: 'TEXT',
      role: 'heading',
      text: 'Welcome back',
      bounds: { x: 120, y: 120, w: 320, h: 40 },
      styles: { color: '#1f2933', fontSize: 32, fontWeight: 700, fontFamily: 'Inter' },
      a11y: { label: 'Welcome back' },
    },
    {
      id: 'login-subheader',
      name: 'Sub header',
      type: 'TEXT',
      role: 'text',
      text: 'Sign in to continue to your workspace',
      bounds: { x: 120, y: 168, w: 360, h: 22 },
      styles: { color: '#52606d', fontSize: 15, fontWeight: 400, fontFamily: 'Inter' },
    },
    {
      id: 'login-email',
      name: 'Email input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 120, y: 224, w: 400, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'Email address', ariaProps: { type: 'email' } },
    },
    {
      id: 'login-password',
      name: 'Password input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 120, y: 288, w: 400, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'Password', ariaProps: { type: 'password' } },
    },
    {
      id: 'login-forgot',
      name: 'Forgot password link',
      type: 'TEXT',
      role: 'link',
      text: 'Forgot your password?',
      bounds: { x: 120, y: 344, w: 180, h: 20 },
      styles: { color: '#3e4c59', fontSize: 14, fontWeight: 500 },
      a11y: { label: 'Forgot your password?' },
    },
    {
      id: 'login-submit',
      name: 'Sign in button',
      type: 'BUTTON',
      role: 'button',
      text: 'Sign in',
      bounds: { x: 120, y: 392, w: 400, h: 48 },
      styles: { color: '#ffffff', bg: '#1a73e8', fontSize: 16, fontWeight: 600, radius: 8 },
      a11y: { label: 'Sign in' },
    },
    {
      id: 'login-logo',
      name: 'Logo',
      type: 'RECTANGLE',
      role: 'image',
      text: '',
      bounds: { x: 120, y: 64, w: 40, h: 40 },
      styles: { radius: 10 },
      a11y: { label: 'Company logo' },
    },
  ],
  interactions: [
    {
      id: 'login-i1',
      trigger: 'click',
      target: 'login-submit',
      expected: 'Form validates and submits credentials',
      context: 'Primary CTA; disabled until fields are non-empty',
    },
    {
      id: 'login-i2',
      trigger: 'click',
      target: 'login-forgot',
      expected: 'Navigates to password reset flow',
      context: 'Supporting link, secondary to primary CTA',
    },
  ],
};

export const CHECKOUT_SPEC: Spec = {
  schemaVersion: 1,
  kind: 'design',
  screen: base('checkout', 'Checkout'),
  viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  elements: [
    {
      id: 'checkout-header',
      name: 'Page header',
      type: 'TEXT',
      role: 'heading',
      text: 'Checkout',
      bounds: { x: 80, y: 48, w: 200, h: 36 },
      styles: { color: '#1f2933', fontSize: 28, fontWeight: 700 },
      a11y: { label: 'Checkout' },
    },
    {
      id: 'checkout-email',
      name: 'Email input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 80, y: 120, w: 420, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'Email address', ariaProps: { type: 'email' } },
    },
    {
      id: 'checkout-card',
      name: 'Card number input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 80, y: 184, w: 420, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'Card number', ariaProps: { autocomplete: 'cc-number' } },
    },
    {
      id: 'checkout-expiry',
      name: 'Expiry input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 80, y: 248, w: 200, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'Expiry date' },
    },
    {
      id: 'checkout-cvc',
      name: 'CVC input',
      type: 'INPUT',
      role: 'input',
      text: '',
      bounds: { x: 300, y: 248, w: 200, h: 44 },
      styles: { color: '#323f4b', fontSize: 15, radius: 6, border: '1px solid #cbd2d9' },
      a11y: { label: 'CVC' },
    },
    {
      id: 'checkout-pay',
      name: 'Pay button',
      type: 'BUTTON',
      role: 'button',
      text: 'Pay $49.00',
      bounds: { x: 80, y: 336, w: 420, h: 48 },
      styles: { color: '#ffffff', bg: '#0f9d58', fontSize: 16, fontWeight: 600, radius: 8 },
      a11y: { label: 'Pay 49 dollars' },
    },
    {
      id: 'checkout-total',
      name: 'Order summary card',
      type: 'RECTANGLE',
      role: 'card',
      text: '',
      bounds: { x: 560, y: 120, w: 380, h: 280 },
      styles: { bg: '#f7f9fc', radius: 12, border: '1px solid #e4e7eb' },
      a11y: { label: 'Order summary' },
    },
  ],
  interactions: [
    {
      id: 'checkout-i1',
      trigger: 'click',
      target: 'checkout-pay',
      expected: 'Payment is processed and order confirmation is shown',
      context: 'Card fields must be valid before submission',
    },
    {
      id: 'checkout-i2',
      trigger: 'input',
      target: 'checkout-card',
      expected: 'Card number is formatted with spaces every 4 digits',
      context: 'Formatting requirement from UX annotations',
    },
  ],
};

export const FIGMA_SAMPLE: Spec[] = [LOGIN_SPEC, CHECKOUT_SPEC];
