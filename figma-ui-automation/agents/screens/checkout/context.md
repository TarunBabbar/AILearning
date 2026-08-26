# Checkout — PRD Context (shift-left sample)

Screen is **still in design** (UX team rolling out). Test cases generated here must be
ready to run the moment the screen ships.

## Flow
1. User lands on checkout with an order summary on the right.
2. Enters email + payment details.
3. Clicks "Pay $49.00".
4. On success → order confirmation screen.

## Acceptance criteria
- Email must be valid format; inline error otherwise.
- Card number is formatted with a space every 4 digits as the user types.
- Expiry must be a future month/year.
- CVC is required, 3-4 digits.
- "Pay" button is disabled until all fields are valid.
- Order summary shows subtotal, shipping, and total = $49.00.
