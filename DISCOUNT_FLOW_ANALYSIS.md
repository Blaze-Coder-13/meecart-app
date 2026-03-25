# Discount Flow Analysis - Cart vs Checkout vs Orders Page

## Issue Summary
**Frontend shows discount (checkout: 95), Backend doesn't save it (orders: 125)**

The discount is calculated and shown on the frontend but not being persisted to the database. When users view their orders, the discount is gone.

---

## 1. Frontend: CheckoutScreen.js - Discount Calculation

### Line 83-85: Frontend Calculates Total
```javascript
const discount = (promoApplied ? promoApplied.discount : 0) + referralDiscount;
const deliveryCharges = cartTotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
const finalTotal = cartTotal + deliveryCharges - discount;
```

**What Happens:**
- `cartTotal` = 125 (sum of all cart items)
- `referralDiscount` = 30 (if user was referred)
- `promoApplied.discount` = 0 (if no promo code)
- **Total discount = 30**
- `finalTotal` = 125 + 0 - 30 = **95**

This is displayed correctly to the user in checkout screen.

### Lines 168-171: Sending to Backend
```javascript
const { data } = await placeOrder(
  items,
  selectedAddress.trim(),
  notes.trim() || undefined,
  promoApplied?.code,      // ← Only sends the CODE, not the discount amount
  referralDiscount > 0     // ← Only sends boolean true/false
);
```

**Problem:** Frontend sends:
- ✅ `items` - cart items with correct prices
- ✅ `address` - delivery address
- ✅ `promo_code` - if a promo was applied
- ✅ `apply_referral_discount` - boolean flag

**Missing:** No actual discount amount is sent, only conditions to recompute it.

### Line 172: Variable Reference Bug
```javascript
const placedOrderDiscount = Number(data?.order?.discount ?? totalDiscount);
```

⚠️ **Bug:** `totalDiscount` is undefined! Should be `discount`.

---

## 2. Backend: server/routes/orders.js - Order Creation

### Lines 111-119: Referral Discount Logic
```javascript
let referralDiscount = 0;
let referralDiscountApplied = 0;
const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
const currentUser = userResult.rows[0];
const referralDiscountClaimResult = await query(
  'SELECT COUNT(*) as c FROM orders WHERE user_id = $1 AND referral_discount_applied = 1',
  [req.user.id]
);
const referralDiscountClaimed = parseInt(referralDiscountClaimResult.rows[0].c) > 0;

if (apply_referral_discount && !referralDiscountClaimed && currentUser.referred_by) {
  const referralDiscountSetting = await query("SELECT value FROM settings WHERE key = 'referral_discount'");
  referralDiscount = Number(referralDiscountSetting.rows[0]?.value || 30);
  referralDiscountApplied = 1;
}
```

**Conditions required for referral discount to apply:**
1. ✅ `apply_referral_discount === true` (frontend sends this)
2. ✅ `!referralDiscountClaimed` (user hasn't used it before)
3. ✅ `currentUser.referred_by` (user has a referrer)

**If ANY condition fails:** `referralDiscount` stays **0** ❌

### Lines 121-133: Promo Code Logic
```javascript
let discount = referralDiscount;
if (promo_code) {
  const promoResult = await query(`
    SELECT * FROM promo_codes
    WHERE code = $1 AND active = 1
    AND (expires_at IS NULL OR expires_at > NOW())
    AND used_count < max_uses
  `, [promo_code.toUpperCase()]);

  if (promoResult.rows.length > 0) {
    const promo = promoResult.rows[0];
    if (subtotal >= promo.min_order_value) {
      if (promo.discount_type === 'flat') {
        discount += promo.discount_value;
      } else {
        discount += Math.round((subtotal * promo.discount_value) / 100);
      }
      await query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promo.id]);
    }
  }
}
```

**Conditions for promo code to apply:**
1. ✅ `promo_code` is provided
2. ✅ Code exists in `promo_codes` table
3. ✅ Code is active
4. ✅ Code hasn't expired
5. ✅ Code has remaining uses
6. ✅ Order value >= `min_order_value`

**If ANY condition fails:** Promo discount not applied ❌

### Line 134: Order Total Calculation
```javascript
const deliveryCharges = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
const total = subtotal + deliveryCharges - discount;
```

**Example:**
- `subtotal` = 125
- `deliveryCharges` = 0 (if subtotal >= 150, which it's not, so = 30)
- `discount` = 0 (if referral conditions fail OR promo code not found)
- **total = 125 + 30 - 0 = 155** ❌ (Should be 95)

### Line 136: Order Inserted
```javascript
const orderResult = await query(`
  INSERT INTO orders (user_id, subtotal, delivery_charges, discount, total, address, notes, payment_method, status, referral_discount_applied)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'cod', 'pending', $8) RETURNING *
`, [req.user.id, subtotal, deliveryCharges, discount, total, address.trim(), notes || null, referralDiscountApplied]);
```

**Order saved with:** `discount = 0` and `total = 125` ❌

---

## 3. Frontend: OrdersScreen.js - Display Retrieved Order

### Lines 177-179: Retrieving from DB
```javascript
const subtotal = detail?.subtotal || order.total;   // ⚠️ Fallback logic is wrong
const deliveryCharges = detail?.delivery_charges ?? order.delivery_charges ?? 0;
const discount = detail?.discount ?? order.discount ?? 0;
```

### Line 189: Showing Order Total
```javascript
<Text style={styles.orderTotal}>₹{order.total}</Text>
```

**Shows:** ₹125 (from database, where discount was never saved)

---

## Root Cause Analysis

### The Discount is Lost Because:

| Step | Frontend | Backend | Issue |
|------|----------|---------|-------|
| 1 | Calculates: 125 - 30 = 95 ✓ | — | Correct math |
| 2 | Sends: `apply_referral_discount=true` ✓ | — | Correctly sent |
| 3 | — | Checks: user has `referred_by`? | May fail if user not referred |
| 4 | — | Checks: referral discount not claimed? | May fail if already used |
| 5 | — | Checks: promo code in DB? | May fail if code not found |
| 6 | — | Sets: `discount = 0` if all fail ❌ | **DEFAULT TO 0** |
| 7 | — | Saves: `total = 125 + 30 - 0` ❌ | Wrong total saved |
| 8 | Retrieves: `order.total = 125` ❌ | — | Shows saved (wrong) value |

---

## Likely Failure Points

### 1. Referral Discount Not Applied
```javascript
if (apply_referral_discount && !referralDiscountClaimed && currentUser.referred_by)
```
- `referred_by` column missing or NULL
- User already claimed referral discount in a previous order
- User wasn't actually referred

### 2. Promo Code Not Found
```javascript
WHERE code = $1 AND active = 1 AND ...
```
- Code doesn't exist in `promo_codes` table
- Code is inactive
- Code already used up (`used_count >= max_uses`)
- Subtotal below `min_order_value`

### 3. Frontend Not Sending Code
```javascript
promoApplied?.code  // Returns undefined if no promo applied
```
- `promoApplied` is null
- `promoApplied.code` is undefined

---

## Solution: Key Areas to Debug

### Option A: Verify Referral Discount
1. Check if `users.referred_by` is populated for the test user
2. Check if `orders.referral_discount_applied = 1` for this user before
3. Check if `settings.referral_discount` is set to 30

### Option B: Verify Promo Code Path
1. Confirm promo code sent in request: add logging to `placeOrder` call
2. Confirm code exists in DB: `SELECT * FROM promo_codes WHERE code = 'XXX'`
3. Confirm code is active and not expired

### Option C: Add Server Logging
Add logs to backend orders.js to see:
```javascript
console.log('apply_referral_discount:', apply_referral_discount);
console.log('referralDiscountClaimed:', referralDiscountClaimed);
console.log('currentUser.referred_by:', currentUser.referred_by);
console.log('Final referralDiscount:', referralDiscount);
console.log('promo_code:', promo_code);
console.log('Final discount:', discount);
console.log('Final total:', total);
```

---

## Data Flow Diagram

```
Frontend (CheckoutScreen.js)
  ├─ Cart Total: ₹125
  ├─ Referral Discount: ₹30 (calculated)
  ├─ Promo Discount: ₹0 (none applied)
  └─ Final Total: ₹95 ✓ (shown to user)
       ↓
       Calls: placeOrder(items, address, notes, promo_code?, , apply_referral_discount?)
       ↓
Backend (server/routes/orders.js)
  ├─ Validates items & recalculates subtotal: ₹125 ✓
  ├─ Checks referral discount conditions:
  │  └─ If ANY fail → referralDiscount = 0 ❌
  ├─ Checks promo code:
  │  └─ If not found or invalid → discount stays 0 ❌
  └─ Calculates total:
     └─ total = 125 + 0 - 0 = 125 ❌ (saves WRONG value)
       ↓
Database (orders table)
  └─ Saves: total=125, discount=0
       ↓
Frontend (OrdersScreen.js)
  └─ Retrieves & displays: ₹125 ❌ (discount lost)
```

---

## Code to Add Debug Logging

**Frontend (CheckoutScreen.js, line 168):**
```javascript
console.log('Place Order Params:', {
  items: items.length,
  promo_code: promoApplied?.code,
  apply_referral_discount: referralDiscount > 0,
  referralDiscount,
  promoDiscount: promoApplied?.discount,
  finalTotal,
  discount
});
```

**Backend (server/routes/orders.js, line ~140):**
```javascript
console.log('Order Calculation Debug:', {
  subtotal,
  referralDiscount,
  referralDiscountApplied,
  promoCode: promo_code,
  finalDiscount: discount,
  deliveryCharges,
  total,
  apply_referral_discount,
  referralDiscountClaimed
});
```
