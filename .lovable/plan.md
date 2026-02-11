

## Fix Razorpay Credential Selection for React Native Compatibility

### Problem
The `create-payment-order` edge function uses HTTP `origin`/`referer` headers to decide between test and live Razorpay credentials. React Native doesn't send these headers, so it always defaults to live credentials -- dangerous during development.

### Solution
Replace header-based detection with an explicit `mode` field in the request body, plus server-side safety guards.

---

### Changes

#### 1. Edge Function: `supabase/functions/create-payment-order/index.ts`

- Add `mode` (optional, `"test"` | `"live"`) to the Zod schema
- Remove `isDevEnvironment()` and `getRazorpayCredentials()` helper functions
- New credential selection logic:
  - If `mode` is not provided, default to `"test"` (safe default)
  - If `mode="test"` -- use `RAZORPAY_KEY_ID_TEST` / `RAZORPAY_KEY_SECRET_TEST`
  - If `mode="live"` -- check the authenticated user's email against an admin allowlist fetched from the `user_roles` table (users with `admin` role). If the caller is not an admin, also check if an `ENVIRONMENT` env var is set to `"production"`. If neither condition is met, reject with: `"Live payments are disabled in non-production."`
  - If `mode="live"` is allowed, use `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- Everything downstream (KYC check, transfers, order creation, response shape) stays identical -- `isTestMode` boolean is still derived from the resolved mode

#### 2. Web Client: `src/components/BookingModal.tsx`

- Update the `supabase.functions.invoke('create-payment-order', ...)` call to include `mode: "test"` in the body (since the web app runs on the Lovable preview/dev domain, it should use test mode; for production published builds, this can later be switched to `"live"`)

#### 3. Web Client: `src/pages/JoinEvent.tsx`

- Same change: add `mode: "test"` to the request body

#### 4. Response -- No Changes

The response remains: `{ order_id, amount, currency, key_id }` -- fully backward compatible.

---

### Technical Details

**Updated Zod schema:**
```typescript
const PaymentOrderSchema = z.object({
  event_id: z.string().uuid('Invalid event ID format'),
  amount: z.number().min(1, 'Minimum amount is 1').max(1000000, 'Amount exceeds maximum'),
  mode: z.enum(['test', 'live']).optional().default('test')
});
```

**Credential resolution (replaces both helper functions):**
```typescript
// Determine effective mode
let isTestMode: boolean;
const requestedMode = validationResult.data.mode; // "test" | "live"

if (requestedMode === 'live') {
  // Check if user is admin
  const { data: adminRole } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  const isProduction = Deno.env.get('ENVIRONMENT') === 'production';

  if (!isProduction && !adminRole) {
    return new Response(
      JSON.stringify({ error: 'Live payments are disabled in non-production.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  isTestMode = false;
} else {
  isTestMode = true;
}

const razorpayKeyId = isTestMode
  ? Deno.env.get('RAZORPAY_KEY_ID_TEST') || ''
  : Deno.env.get('RAZORPAY_KEY_ID') || '';
const razorpayKeySecret = isTestMode
  ? Deno.env.get('RAZORPAY_KEY_SECRET_TEST') || ''
  : Deno.env.get('RAZORPAY_KEY_SECRET') || '';
```

**Client call update (both files):**
```typescript
body: { event_id: eventId, amount: price, mode: 'test' }
```

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/create-payment-order/index.ts` | Replace header-based detection with explicit `mode` field + admin guard |
| `src/components/BookingModal.tsx` | Add `mode: 'test'` to request body |
| `src/pages/JoinEvent.tsx` | Add `mode: 'test'` to request body |

### No Changes To
- Booking logic (`book_event_participant` RPC)
- Razorpay webhook flow
- Payment sync function
- Response format

