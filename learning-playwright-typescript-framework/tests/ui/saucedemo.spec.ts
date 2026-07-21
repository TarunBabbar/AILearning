/**
 * SauceDemo E2E UI Tests
 * All 10 test cases from saucedemo.md implemented using Page Object Model.
 *
 * @smoke   - Case 1 (Full Checkout)
 * @regression - Cases 2-10
 */

import { test, expect } from '../src/fixtures/test.fixture';
import {
  Credentials,
  Products,
  ProductPrices,
  CheckoutInfo,
  ErrorMessages,
  Urls,
  SortOptions,
} from '../src/data/test-data';

// ── Case 1: Standard User Successful Checkout ────────────────────────────────

test('Case 1 | Standard user completes full checkout @smoke', async ({
  loginPage,
  inventoryPage,
  cartPage,
  checkoutPage,
}) => {
  await loginPage.goto();
  await loginPage.loginAs(Credentials.STANDARD_USER, Credentials.PASSWORD);
  await loginPage.expectURL(Urls.INVENTORY);

  await inventoryPage.addToCart(Products.BACKPACK);
  await cartPage.goto();
  await cartPage.expectItemPresent(Products.BACKPACK);

  await cartPage.clickCheckout();
  await checkoutPage.fillCustomerInfo(
    CheckoutInfo.FIRST_NAME,
    CheckoutInfo.LAST_NAME,
    CheckoutInfo.ZIP_CODE
  );
  await checkoutPage.clickContinue();
  await checkoutPage.clickFinish();

  await checkoutPage.expectConfirmationMessage('Thank you for your order!');
});

// ── Case 2: Invalid Login ────────────────────────────────────────────────────

test('Case 2 | Invalid credentials show error @regression', async ({
  loginPage,
  page,
}) => {
  await loginPage.goto();
  await loginPage.loginAs(Credentials.INVALID_USER, Credentials.WRONG_PASSWORD);
  await loginPage.expectLoginError(ErrorMessages.INVALID_CREDENTIALS);

  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await expect(page).toHaveURL(Urls.BASE);
});

// ── Case 3: Locked Out User ──────────────────────────────────────────────────

test('Case 3 | Locked out user cannot login @regression', async ({
  loginPage,
  page,
}) => {
  await loginPage.goto();
  await loginPage.loginAs(Credentials.LOCKED_OUT_USER, Credentials.PASSWORD);
  await loginPage.verifyLockedOutError();

  await expect(page).not.toHaveURL(Urls.INVENTORY);
});

// ── Case 4: Add Multiple Products to Cart ────────────────────────────────────

test('Case 4 | Add multiple items to cart @regression', async ({
  loginPage,
  inventoryPage,
  cartPage,
}) => {
  await loginPage.loginAsStandardUser();
  await inventoryPage.addToCart(Products.BACKPACK);
  await inventoryPage.addToCart(Products.BIKE_LIGHT);
  await inventoryPage.addToCart(Products.BOLT_T_SHIRT);

  await cartPage.goto();
  await cartPage.expectCartItemCount(3);
  await cartPage.expectItemPresent(Products.BACKPACK);
  await cartPage.expectItemPresent(Products.BIKE_LIGHT);
  await cartPage.expectItemPresent(Products.BOLT_T_SHIRT);
});

// ── Case 5: Remove Product From Cart ─────────────────────────────────────────

test('Case 5 | Remove item from cart @regression', async ({
  loginPage,
  inventoryPage,
  cartPage,
}) => {
  await loginPage.loginAsStandardUser();
  await inventoryPage.addToCart(Products.BACKPACK);

  await cartPage.goto();
  await cartPage.removeItem(Products.BACKPACK);
  await cartPage.expectItemNotPresent(Products.BACKPACK);
  await cartPage.expectCartBadgeHidden();
});

// ── Case 6: Product Sorting (Price Low to High) ──────────────────────────────

test('Case 6 | Sort products by price low to high @regression', async ({
  loginPage,
  inventoryPage,
  page,
}) => {
  await loginPage.loginAsStandardUser();

  await inventoryPage.sortBy(SortOptions.PRICE_LOW_HIGH);
  const prices = await inventoryPage.getProductPrices();

  expect(prices[0]).toBe(7.99);
  for (let i = 1; i < prices.length; i++) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});

// ── Case 7: Checkout Validation Required Fields ──────────────────────────────

test('Case 7 | Checkout requires first name @regression', async ({
  loginPage,
  inventoryPage,
  cartPage,
  checkoutPage,
}) => {
  await loginPage.loginAsStandardUser();
  await inventoryPage.addToCart(Products.BACKPACK);

  await cartPage.goto();
  await cartPage.clickCheckout();
  await checkoutPage.clickContinue();

  await checkoutPage.expectErrorVisible(ErrorMessages.FIRST_NAME_REQUIRED);
});

// ── Case 8: Continue Shopping ────────────────────────────────────────────────

test('Case 8 | Continue Shopping returns to inventory @regression', async ({
  loginPage,
  inventoryPage,
  cartPage,
}) => {
  await loginPage.loginAsStandardUser();
  await inventoryPage.addToCart(Products.BACKPACK);

  await cartPage.goto();
  await cartPage.clickContinueShopping();
  await inventoryPage.expectURL(Urls.INVENTORY);
  await inventoryPage.expectInventoryVisible();
});

// ── Case 9: Logout ───────────────────────────────────────────────────────────

test('Case 9 | User can logout successfully @regression', async ({
  loginPage,
  inventoryPage,
  page,
}) => {
  await loginPage.loginAsStandardUser();

  await inventoryPage.logout();
  await loginPage.expectURL(Urls.BASE);
  await loginPage.expectLoginPageVisible();
});

// ── Case 10: Product Details Navigation ──────────────────────────────────────

test('Case 10 | Product details page shows correct info @regression', async ({
  loginPage,
  inventoryPage,
  page,
}) => {
  await loginPage.loginAsStandardUser();

  await inventoryPage.clickProduct(Products.BACKPACK);
  await loginPage.expectURL(/inventory-item\.html/);

  await expect(page.locator('[data-test="inventory-item-name"]')).toHaveText(
    Products.BACKPACK
  );
  await expect(
    page.locator('.inventory_details_price')
  ).toBeVisible();
  await expect(
    page.locator('.inventory_details_desc')
  ).toBeVisible();

  await page.locator('button').filter({ hasText: 'Add to cart' }).click();
  await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText(
    '1'
  );
});
