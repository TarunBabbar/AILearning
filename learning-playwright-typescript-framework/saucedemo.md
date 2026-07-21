# Playwright AI Test Plan: SauceDemo E2E Test Suite

## Setup Configurations
- **Base URL**: https://www.saucedemo.com
- **Engine**: Playwright Test Agent / MCP Server
- **Browser**: Chromium (Headless: false for verification)

---

# Test Suite

## Case 1: Standard User Successful Checkout
### Objective
Verify a standard user can complete an end-to-end purchase.

### Steps
1. Navigate to the Base URL.
2. Enter username `standard_user`.
3. Enter password `secret_sauce`.
4. Click **Login**.
5. Click **Add to cart** for **Sauce Labs Backpack**.
6. Open the shopping cart.
7. **Assert** cart contains **Sauce Labs Backpack**.
8. Click **Checkout**.
9. Enter:
   - First Name: `John`
   - Last Name: `Doe`
   - Zip Code: `12345`
10. Click **Continue**.
11. Click **Finish**.
12. **Assert** page displays:
    - `Thank you for your order!`

---

## Case 2: Invalid Login
### Objective
Verify invalid credentials display an error.

### Steps
1. Open the Base URL.
2. Enter username `invalid_user`.
3. Enter password `wrong_password`.
4. Click **Login**.
5. **Assert** error message appears:
   - `Epic sadface: Username and password do not match any user in this service`
6. **Assert** user remains on the login page.

---

## Case 3: Locked Out User
### Objective
Verify locked users cannot login.

### Steps
1. Navigate to the Base URL.
2. Enter username `locked_out_user`.
3. Enter password `secret_sauce`.
4. Click **Login**.
5. **Assert** error message:
   - `Epic sadface: Sorry, this user has been locked out.`
6. **Assert** inventory page is not displayed.

---

## Case 4: Add Multiple Products to Cart
### Objective
Verify multiple items can be added to the shopping cart.

### Steps
1. Login as `standard_user`.
2. Add:
   - Sauce Labs Backpack
   - Sauce Labs Bike Light
   - Sauce Labs Bolt T-Shirt
3. Click the shopping cart.
4. **Assert** cart badge displays `3`.
5. **Assert** all three products are visible.

---

## Case 5: Remove Product From Cart
### Objective
Verify removing an item updates the cart correctly.

### Steps
1. Login as `standard_user`.
2. Add **Sauce Labs Backpack**.
3. Open the cart.
4. Click **Remove**.
5. **Assert** Backpack no longer exists.
6. **Assert** cart badge disappears.

---

## Case 6: Product Sorting (Price Low to High)
### Objective
Verify sorting products by lowest price.

### Steps
1. Login as `standard_user`.
2. Open the sort dropdown.
3. Select **Price (low to high)**.
4. **Assert** the first inventory item price is `$7.99`.
5. **Assert** prices appear in ascending order.

---

## Case 7: Checkout Validation Required Fields
### Objective
Verify checkout requires customer information.

### Steps
1. Login as `standard_user`.
2. Add any product.
3. Open cart.
4. Click **Checkout**.
5. Leave all fields empty.
6. Click **Continue**.
7. **Assert** error message:
   - `Error: First Name is required`

---

## Case 8: Continue Shopping
### Objective
Verify Continue Shopping returns to inventory page.

### Steps
1. Login as `standard_user`.
2. Add one product.
3. Open the cart.
4. Click **Continue Shopping**.
5. **Assert** URL ends with `/inventory.html`.
6. **Assert** inventory list is visible.

---

## Case 9: Logout
### Objective
Verify user can logout successfully.

### Steps
1. Login as `standard_user`.
2. Open the left menu.
3. Click **Logout**.
4. **Assert** login page is displayed.
5. **Assert** URL equals the Base URL.

---

## Case 10: Product Details Navigation
### Objective
Verify product details page displays correct information.

### Steps
1. Login as `standard_user`.
2. Click **Sauce Labs Backpack** product title.
3. **Assert** URL contains `/inventory-item.html`.
4. **Assert** product name equals:
   - `Sauce Labs Backpack`
5. **Assert** price is displayed.
6. **Assert** description is visible.
7. Click **Add to cart**.
8. **Assert** cart badge displays `1`.

---

# Test Data

| Username | Password | Expected Result |
|----------|----------|----------------|
| standard_user | secret_sauce | Login Success |
| locked_out_user | secret_sauce | Locked User Error |
| problem_user | secret_sauce | Login Success |
| performance_glitch_user | secret_sauce | Login Success |
| error_user | secret_sauce | Login Success |
| visual_user | secret_sauce | Login Success |
| invalid_user | wrong_password | Login Failed |

---

# Common Assertions

- Login redirects to `/inventory.html`
- Shopping cart badge count updates correctly
- Product names match expected values
- Prices are displayed correctly
- Checkout information validation works
- Order confirmation page appears after Finish
- Logout returns to login page
- Error messages exactly match expected text
- Inventory page loads successfully
- Product detail page displays accurate information
