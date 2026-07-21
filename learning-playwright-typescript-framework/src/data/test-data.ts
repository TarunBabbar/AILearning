/*
 * SauceDemo Test Data
 * Centralized source for all credentials, products, messages, and URLs.
 */

// ── Credentials ──────────────────────────────────────────────────────────────

export const Credentials = {
  STANDARD_USER: 'standard_user',
  LOCKED_OUT_USER: 'locked_out_user',
  PROBLEM_USER: 'problem_user',
  PERFORMANCE_GLITCH_USER: 'performance_glitch_user',
  ERROR_USER: 'error_user',
  VISUAL_USER: 'visual_user',
  INVALID_USER: 'invalid_user',
  PASSWORD: 'secret_sauce',
  WRONG_PASSWORD: 'wrong_password',
} as const;

// ── Users ────────────────────────────────────────────────────────────────────

export interface TestUser {
  username: string;
  password: string;
  expectedResult: 'success' | 'failure';
  message?: string;
}

export const Users: Record<string, TestUser> = {
  standard: {
    username: Credentials.STANDARD_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'success',
  },
  lockedOut: {
    username: Credentials.LOCKED_OUT_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'failure',
    message: 'Epic sadface: Sorry, this user has been locked out.',
  },
  problem: {
    username: Credentials.PROBLEM_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'success',
  },
  performanceGlitch: {
    username: Credentials.PERFORMANCE_GLITCH_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'success',
  },
  error: {
    username: Credentials.ERROR_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'success',
  },
  visual: {
    username: Credentials.VISUAL_USER,
    password: Credentials.PASSWORD,
    expectedResult: 'success',
  },
  invalid: {
    username: Credentials.INVALID_USER,
    password: Credentials.WRONG_PASSWORD,
    expectedResult: 'failure',
    message:
      'Epic sadface: Username and password do not match any user in this service',
  },
};

// ── Products ─────────────────────────────────────────────────────────────────

export const Products = {
  BACKPACK: 'Sauce Labs Backpack',
  BIKE_LIGHT: 'Sauce Labs Bike Light',
  BOLT_T_SHIRT: 'Sauce Labs Bolt T-Shirt',
  FLEECE_JACKET: 'Sauce Labs Fleece Jacket',
  ONESIE: 'Sauce Labs Onesie',
  RED_T_SHIRT: 'Test.allTheThings() T-Shirt (Red)',
} as const;

export const ProductPrices: Record<string, string> = {
  [Products.BACKPACK]: '$29.99',
  [Products.BIKE_LIGHT]: '$9.99',
  [Products.BOLT_T_SHIRT]: '$15.99',
  [Products.FLEECE_JACKET]: '$49.99',
  [Products.ONESIE]: '$7.99',
  [Products.RED_T_SHIRT]: '$15.99',
};

// ── Checkout Info ────────────────────────────────────────────────────────────

export const CheckoutInfo = {
  FIRST_NAME: 'John',
  LAST_NAME: 'Doe',
  ZIP_CODE: '12345',
} as const;

// ── Error Messages ───────────────────────────────────────────────────────────

export const ErrorMessages = {
  INVALID_CREDENTIALS:
    'Epic sadface: Username and password do not match any user in this service',
  LOCKED_OUT: 'Epic sadface: Sorry, this user has been locked out.',
  FIRST_NAME_REQUIRED: 'Error: First Name is required',
  LAST_NAME_REQUIRED: 'Error: Last Name is required',
  ZIP_CODE_REQUIRED: 'Error: Postal Code is required',
} as const;

// ── URLs ─────────────────────────────────────────────────────────────────────

export const Urls = {
  BASE: 'https://www.saucedemo.com',
  INVENTORY: '/inventory.html',
  CART: '/cart.html',
  CHECKOUT_STEP_ONE: '/checkout-step-one.html',
  CHECKOUT_STEP_TWO: '/checkout-step-two.html',
  CHECKOUT_COMPLETE: '/checkout-complete.html',
};

export const SortOptions = {
  AZ: 'az',
  ZA: 'za',
  PRICE_LOW_HIGH: 'lohi',
  PRICE_HIGH_LOW: 'hilo',
} as const;
