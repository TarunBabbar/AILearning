import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { ProductPrices } from '../data/test-data';

export class InventoryPage extends BasePage {
  private readonly inventoryList: Locator;
  private readonly sortDropdown: Locator;
  private readonly cartBadge: Locator;
  private readonly burgerMenu: Locator;
  private readonly logoutLink: Locator;

  constructor(page: Page) {
    super(page);
    this.inventoryList = page.locator('.inventory_list');
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');
    this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');
    this.burgerMenu = page.locator('#react-burger-menu-btn');
    this.logoutLink = page.locator('[data-test="logout-sidebar-link"]');
  }

  async expectInventoryVisible(): Promise<void> {
    await this.expectVisible(this.inventoryList);
  }

  async addToCart(productName: string): Promise<void> {
    const item = this.page
      .locator('.inventory_item')
      .filter({ hasText: productName });
    await item.locator('button').click();
  }

  async getCartBadgeCount(): Promise<string> {
    return this.getText(this.cartBadge);
  }

  async expectCartBadgeCount(expected: string): Promise<void> {
    await this.expectText(this.cartBadge, expected);
  }

  async sortBy(option: string): Promise<void> {
    await this.sortDropdown.selectOption(option);
  }

  async clickProduct(productName: string): Promise<void> {
    await this.page
      .locator('.inventory_item_name')
      .filter({ hasText: productName })
      .click();
  }

  async logout(): Promise<void> {
    await this.burgerMenu.click();
    await this.logoutLink.click();
  }

  async getProductPrices(): Promise<number[]> {
    const prices = await this.page.locator('.inventory_item_price').allTextContents();
    return prices.map((p) => parseFloat(p.replace('$', '')));
  }

  async expectProductsInOrder(expectedPrices: number[]): Promise<void> {
    const actual = await this.getProductPrices();
    for (let i = 0; i < expectedPrices.length; i++) {
      if (actual[i] !== expectedPrices[i]) {
        throw new Error(
          `Price mismatch at index ${i}: expected $${expectedPrices[i]}, got $${actual[i]}`
        );
      }
    }
  }
}
