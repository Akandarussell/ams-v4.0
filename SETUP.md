# MA BABAR DOA APARTMENT COMPLEX - ERP SYSTEM GUIDE

**Project:** Apartment Management ERP System  
**Complex:** Ma Babar Doa Apartment Complex  
**Address:** 72/32 M Rahman Nursing College Road, City Bypass, Horogram Purbopara, Dingadoba Rajshahi-6201, Bangladesh  
**Contacts:** 01737-321998 (Manager), 01913-858775 (Raju)  
**Electricity Distributor:** NESCO (Northern Electricity Supply Company PLC), Rajshahi  
**Primary Currency:** Bangladeshi Taka (BDT / ৳)  
**Timezone:** Asia/Dhaka  

---

## 1. TEST ACCOUNTS & ROLES

The application comes pre-configured with active accounts and quick-switch access in the header dropdown:

| Role | Name | Phone / Contact | Identifier / Email | Scope |
|---|---|---|---|---|
| **Manager (Super Admin)** | Russell | `01737-321998` | `akandarussell@gmail.com` | All Blocks (A, B, C) |
| **Block A Owner** | Md. Rashed | `01717623061` | `rashed.blocka@mbdapartment.com` | Block A |
| **Block B Owner** | Md. Raju | `01913858775` | `raju.blockb@mbdapartment.com` | Block B |
| **Block C Owner** | Md. Rony | `01712118547` | `rony.blockc@mbdapartment.com` | Block C |
| **Resident Tenant** | Tanvir Ahmed Chy | `01819-223344` | `tanvir.a2@gmail.com` | Flat A2 |
| **Resident Tenant** | Farhana Begum | `01922-345678` | `farhana.b3@gmail.com` | Flat B3 |

Default password for all test accounts: `password123` (or `tenant123`).

---

## 2. DATABASE ARCHITECTURE & SUPABASE SETUP

The database runs in a hybrid model:
1. **Built-in Local Persistent Store**: Zero-setup interactive testing initialized with real demo datasets for Blocks A, B, C, parking, godowns, NESCO meter readings, and historical ledgers.
2. **Production Supabase PostgreSQL**: Fully compatible with remote Supabase with Row Level Security (RLS) policies.

### Setting up Supabase:
1. Create a project at [https://supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Paste the contents of `/supabase/schema.sql` and click **Run**.
4. Retrieve your **Project URL** and **Anon Public Key** from `Project Settings -> API`.
5. Enter them into `.env`:
   ```bash
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
   Or click the **Database** button in the app header and save them directly in the UI.

---

## 3. BANGLADESH NESCO TARIFF ENGINE

- **Formula**: `Consumed Units = Current Reading - Previous Reading`
- **Postpaid Cycle**: September consumption bill is billed and paid in the October collection ledger.
- **Progressive Slab Configuration (LT-A Residential 2026)**:
  - 0 – 50 units (Lifeline): ৳4.63 / unit
  - 0 – 75 units (First-stage): ৳5.26 / unit
  - 76 – 200 units: ৳8.50 / unit
  - 201 – 300 units: ৳9.10 / unit
  - 301 – 400 units: ৳9.62 / unit
  - 401 – 600 units: ৳15.01 / unit
  - Above 600 units: ৳17.35 / unit
  - Demand Charge: ৳42.00 / KW (standard = ৳84.00 - ৳126.00)
  - Meter Rent: ৳40.00
  - Government VAT: 5.0%

---

## 4. PRINTABLE A4 RECEIPTS & PDF DOWNLOAD

- Uses standard `@media print` CSS rules styled for official Bangladeshi vouchers.
- Includes complex header, voucher number, tenant metadata, BDT figures and words, verified status, remaining security advance balance, and dual signature lines (Tenant & Manager Russell / Block Owner).
- Works with the browser's native **Print** and **Save as PDF** dialog.

---

## 5. ANDROID FLUTTER INTEGRATION PLAN

The database schema and business logic are designed for future Flutter Android deployment:
1. **Dependencies**: `supabase_flutter: ^2.5.0`
2. **Authentication**: Supabase Auth with custom claims matching `role` and `assigned_block`.
3. **Realtime**: Subscribe to `chat_messages` and `complaints` tables using `supabase.from('chat_messages').stream()`.
4. **Offline Support**: Use `hive` or `hydrated_bloc` for local caching on Android.

---

## 6. BACKUP & RESTORE INSTRUCTIONS

### PostgreSQL CLI Backup:
```bash
# Backup entire database including schema and RLS policies
pg_dump -h db.your-project.supabase.co -U postgres -d postgres -F c -b -v -f green_heights_backup.dump

# Restore
pg_restore -h db.your-project.supabase.co -U postgres -d postgres -v green_heights_backup.dump
```
