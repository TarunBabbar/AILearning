import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { Urls, ErrorMessages } from '../data/test-data';

export class LoginPage extends BasePage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.errorMessage = page.locator('[data-test="error"]');
  }

  async goto(): Promise<void> {
    await this.navigate(Urls.BASE);
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.fillField(this.usernameInput, username);
    await this.fillField(this.passwordInput, password);
    await this.clickElement(this.loginButton);
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.errorMessage);
  }

  async expectLoginPageVisible(): Promise<void> {
    await this.expectVisible(this.loginButton);
    await this.expectVisible(this.usernameInput);
    await this.expectVisible(this.passwordInput);
  }

  async expectLoginError(expectedMessage: string): Promise<void> {
    await this.expectVisible(this.errorMessage);
    await this.expectContainText(this.errorMessage, expectedMessage);
  }

  async verifyLockedOutError(): Promise<void> {
    await this.expectLoginError(ErrorMessages.LOCKED_OUT);
  }

  async loginAsStandardUser(): Promise<void> {
    await this.goto();
    await this.loginAs('standard_user', 'secret_sauce');
    await this.expectURL(Urls.INVENTORY);
  }
}
