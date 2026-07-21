import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { Urls } from '../data/test-data';

export class CartPage extends BasePage {
  private readonly cartItems: Locator;
  private readonly checkoutButton: Locator;
  private readonly continueShoppingButton: Locator;
  private readonly cartBadge: Locator;

  constructor(page: Page) {
    super(page);
    this.cartItems = page.locator('.cart_item');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
    this.continueShoppingButton = page.getByRole('button', {
      name: 'Continue Shopping',
    });
    this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');
  }

  async goto(): Promise<void> {
    await this.navigate(Urls.CART);
  }

  async clickCheckout(): Promise<void> {
    await this.clickElement(this.checkoutButton);
    await this.page.waitForURL(`**${Urls.CHECKOUT_STEP_ONE}`);
  }

  async clickContinueShopping(): Promise<void> {
    await this.clickElement(this.continueShoppingButton);
  }

  async removeItem(productName: string): Promise<void> {
    const item = this.cartItems.filter({ hasText: productName });
    await item.locator('button').click();
  }

  async expectItemPresent(productName: string): Promise<void> {
    await this.expectVisible(this.cartItems.filter({ hasText: productName }));
  }

  async expectItemNotPresent(productName: string): Promise<void> {
    await this.expectHidden(this.cartItems.filter({ hasText: productName }));
  }

  async expectCartItemCount(count: number): Promise<void> {
    await expect(this.cartItems).toHaveCount(count);
  }

  async expectCartBadgeHidden(): Promise<void> {
    await this.expectHidden(this.cartBadge);
  }

  async expectCartBadgeVisible(): Promise<void> {
    await this.expectVisible(this.cartBadge);
  }
}
