# Dessert Business OS — V1.1 Supabase-connected starter

This version connects the mobile-first Next.js app to Supabase and makes authentication, tasks, and basic Orders functional.

## 1. Local environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role/secret key is intentionally unused by the browser app. Do not expose it to the client.

## 2. Supabase database

You already ran `supabase/schema.sql`.

Now run **`supabase/schema_v2.sql`** in Supabase SQL Editor. This:
- enables Row Level Security (RLS)
- adds business-membership policies
- creates a default business automatically for each newly registered user
- protects business data from other users

If you created your user account before running `schema_v2.sql`, run the signup again or create a new test account after the trigger exists. The app expects an authenticated user to have a `business_members` row.

## 3. Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## 4. What is functional in V1.1

- Email/password sign up and sign in
- Supabase session persistence
- Business membership lookup
- Real tasks stored in Supabase
- Start/pause UI state for the current activity
- Add tasks
- Add orders
- Customer auto-create/reuse by name
- Product auto-create/reuse by name
- Order items stored in Supabase
- Order status and payment status
- Today's order/sales totals loaded from Supabase
- Sign out

## 5. Next development steps

1. Edit/delete/cancel orders
2. Products management and cost/margin calculation
3. Inventory CRUD and stock transactions
4. Real work-session persistence for Start/Pause/Resume
5. Daily/weekly/monthly analytics
6. Deterministic sales and inventory forecasting
7. Content planner and analytics
8. Production deployment

V1 does not require an AI API.
