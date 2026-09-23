# Dessert Business OS — V1 Starter

Mobile-first PWA prototype for a small dessert business.

V1 intentionally has **no AI dependency**. It focuses on:
- daily schedule
- tasks
- orders
- sales
- products/costing
- inventory
- customers
- content
- dashboards
- deterministic analytics/forecasting

## Run
npm install
npm run dev

Open http://localhost:3000

## Backend
Run `supabase/schema.sql` in a Supabase project, then connect the UI to Supabase CRUD operations.

## Environment
Create `.env.local` from `.env.example`.

No AI key is required for V1.

## Production TODO
Authentication, real CRUD, Row Level Security policies, server-side analytics, CSV exports, real forecasting services, backups, and deployment configuration should be completed before real business data is used.
