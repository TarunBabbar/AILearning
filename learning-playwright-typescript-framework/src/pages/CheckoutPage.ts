import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { Urls } from '../data/test-data';

export class CheckoutPage extends BasePage {
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly zipCodeInput: Locator;
  private readonly continueButton: Locator;
  private readonly finishButton: Locator;
  private readonly confirmationHeader: Locator;
  private readonly confirmationText: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.getByPlaceholder('First Name');
    this.lastNameInput = page.getByPlaceholder('Last Name');
    this.zipCodeInput = page.getByPlaceholder('Zip/Postal Code');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.finishButton = page.getByRole('button', { name: 'Finish' });
    this.confirmationHeader = page.locator('.complete-header');
    this.confirmationText = page.locator('.complete-text');
    this.errorMessage = page.locator('[data-test="error"]');
  }

  async fillCustomerInfo(
    firstName: string,
    lastName: string,
    zipCode: string
  ): Promise<void> {
    await this.fillField(this.firstNameInput, firstName);
    await this.fillField(this.lastNameInput, lastName);
    await this.fillField(this.zipCodeInput, zipCode);
  }

  async clickContinue(): Promise<void> {
    await this.clickElement(this.continueButton);
  }

  async clickFinish(): Promise<void> {
    await this.clickElement(this.finishButton);
  }

  async getConfirmationMessage(): Promise<string> {
    return this.getText(this.confirmationHeader);
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.errorMessage);
  }

  async expectConfirmationMessage(expected: string): Promise<void> {
    await this.expectText(this.confirmationHeader, expected);
  }

  async expectErrorVisible(expectedMessage: string): Promise<void> {
    await this.expectVisible(this.errorMessage);
    await this.expectContainText(this.errorMessage, expectedMessage);
  }
}
