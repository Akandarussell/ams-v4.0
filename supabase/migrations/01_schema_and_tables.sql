-- ==============================================================================
-- MIGRATION 01: EXTENSIONS, TABLES, CONSTRAINTS & INDEXES
-- Apartment Management ERP System - Bangladesh
-- Database: Supabase PostgreSQL (PostgREST Compatible)
-- Timezone: Asia/Dhaka | Currency: Bangladeshi Taka (BDT / ৳)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom ENUM Types for Financial & Domain Integrity
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('manager', 'owner', 'tenant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE block_name_enum AS ENUM ('Block A', 'Block B', 'Block C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_type_enum AS ENUM ('residential', 'parking', 'godown', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE elec_billing_enum AS ENUM ('nesco_submeter', 'fixed', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('Paid', 'Not Paid', 'Partially Paid', 'Adjusted', 'N/A');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status_enum AS ENUM ('Submitted', 'In Progress', 'Resolved', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM ('Pending', 'Verified', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'tenant',
    assigned_block block_name_enum,
    flat_id TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name block_name_enum UNIQUE NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_floors INT NOT NULL DEFAULT 7,
    total_units INT NOT NULL DEFAULT 8,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. UNITS TABLE (Residential Flats, Parking, Godown Spaces)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flat_id TEXT UNIQUE NOT NULL, -- e.g. 'A1', 'A2', 'A5 Owner', 'A5 Sublet', 'B1', 'P1', 'G1'
    block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE,
    block_name block_name_enum NOT NULL,
    floor INT NOT NULL DEFAULT 1,
    unit_type unit_type_enum NOT NULL DEFAULT 'residential',
    monthly_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_rent >= 0),
    tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    electricity_billing_type elec_billing_enum NOT NULL DEFAULT 'nesco_submeter',
    fixed_electricity_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (fixed_electricity_amount >= 0),
    parking_slot TEXT,
    godown_slot TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TENANTS TABLE (Detailed Tenant Agreements & Contacts)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name block_name_enum NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    nid_number TEXT NOT NULL,
    email TEXT,
    entry_date DATE NOT NULL,
    emergency_contact TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved_out')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ADVANCE ACCOUNTS (Security Deposit Ledger per Tenant/Unit)
CREATE TABLE IF NOT EXISTS public.advance_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    total_required NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_required >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    remaining_advance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'not_paid' CHECK (status IN ('paid', 'not_paid', 'partially_paid')),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_advance_non_negative CHECK (amount_paid >= 0 AND remaining_advance >= 0)
);

-- 8. ADVANCE TRANSACTIONS (Audited Security Deposit Inflows and Deductions)
CREATE TABLE IF NOT EXISTS public.advance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advance_account_id UUID NOT NULL REFERENCES public.advance_accounts(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'adjustment_deduction', 'refund')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    receipt_no TEXT UNIQUE NOT NULL,
    transaction_id TEXT,
    notes TEXT,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. MONTHLY RENT RECORDS (Strict Monthly-Scoped Financial Period Ledger)
CREATE TABLE IF NOT EXISTS public.monthly_rent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id TEXT NOT NULL,
    billing_period TEXT NOT NULL, -- e.g., '2026-10' (strict YYYY-MM)
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    tenant_id TEXT,
    tenant_name TEXT NOT NULL DEFAULT 'Resident',
    tenant_phone TEXT,
    entry_date DATE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    advance_payment NUMERIC(12, 2) DEFAULT 0.00 CHECK (advance_payment >= 0),
    advance_status TEXT DEFAULT 'Paid',
    advance_date DATE,
    flat_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (flat_rent >= 0),
    rent_status TEXT DEFAULT 'Not Paid',
    rent_payment_date DATE,
    electricity_bill NUMERIC(12, 2) DEFAULT 0.00 CHECK (electricity_bill >= 0),
    electricity_status TEXT DEFAULT 'N/A',
    electricity_date DATE,
    parking_rent NUMERIC(12, 2) DEFAULT 0.00 CHECK (parking_rent >= 0),
    godown_rent NUMERIC(12, 2) DEFAULT 0.00 CHECK (godown_rent >= 0),
    total_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_payable >= 0),
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_paid >= 0),
    total_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_due >= 0),
    payment_status TEXT NOT NULL DEFAULT 'Not Paid',
    adjusted_from_advance NUMERIC(12, 2) DEFAULT 0.00 CHECK (adjusted_from_advance >= 0),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, billing_period)
);

-- Idempotent schema migration for existing deployments:
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS billing_period TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS block_key TEXT DEFAULT 'blockA';
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS flat_id TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS block_name TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS month INT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS year INT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS flat_rent NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS advance_payment NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS advance_paid NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS electricity_bill NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS electricity_status TEXT DEFAULT 'N/A';
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS e_bill_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS e_bill_status TEXT DEFAULT 'Not Paid';
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS electricity_date DATE;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS total_payable NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS total_paid NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS total_due NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS due_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Paid';
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS adjusted_from_advance NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12, 2) DEFAULT 0.00;
UPDATE public.monthly_rent_records SET billing_period = period WHERE billing_period IS NULL AND period IS NOT NULL;
UPDATE public.monthly_rent_records SET period = billing_period WHERE period IS NULL AND billing_period IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_rent_records_period ON public.monthly_rent_records(billing_period);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_records_period_compat ON public.monthly_rent_records(period);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_records_flat ON public.monthly_rent_records(flat_id);

-- Legacy alias table
CREATE TABLE IF NOT EXISTS public.monthly_rent_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name block_name_enum NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    advance_payment NUMERIC(12, 2) DEFAULT 0.00 CHECK (advance_payment >= 0),
    flat_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (flat_rent >= 0),
    electricity_bill NUMERIC(12, 2) DEFAULT 0.00 CHECK (electricity_bill >= 0),
    parking_rent NUMERIC(12, 2) DEFAULT 0.00 CHECK (parking_rent >= 0),
    godown_rent NUMERIC(12, 2) DEFAULT 0.00 CHECK (godown_rent >= 0),
    total_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_payable >= 0),
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_paid >= 0),
    total_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_due >= 0),
    payment_status payment_status_enum NOT NULL DEFAULT 'Not Paid',
    adjusted_from_advance NUMERIC(12, 2) DEFAULT 0.00 CHECK (adjusted_from_advance >= 0),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, month, year)
);

-- 10. ELECTRICITY TARIFFS (NESCO Progressive Slabs & Configuration Snapshot)
CREATE TABLE IF NOT EXISTS public.electricity_tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    effective_from DATE NOT NULL,
    slabs_json JSONB NOT NULL,
    demand_charge_per_kw NUMERIC(8, 2) NOT NULL DEFAULT 42.00,
    vat_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    meter_rent NUMERIC(8, 2) NOT NULL DEFAULT 40.00,
    rebate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. METER READINGS (Sub-meters on Flats)
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    previous_reading NUMERIC(10, 2) NOT NULL CHECK (previous_reading >= 0),
    current_reading NUMERIC(10, 2) NOT NULL,
    consumed_units NUMERIC(10, 2) NOT NULL,
    reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, month, year),
    CONSTRAINT chk_reading_monotonic CHECK (current_reading >= previous_reading AND consumed_units >= 0)
);

-- 12. ELECTRICITY BILLS (Postpaid Billing Engine with Preserved Tariff Snapshots)
CREATE TABLE IF NOT EXISTS public.electricity_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    consumption_month INT NOT NULL CHECK (consumption_month BETWEEN 1 AND 12),
    consumption_year INT NOT NULL CHECK (consumption_year BETWEEN 2024 AND 2100),
    billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    billing_year INT NOT NULL CHECK (billing_year BETWEEN 2024 AND 2100),
    previous_reading NUMERIC(10, 2) NOT NULL,
    current_reading NUMERIC(10, 2) NOT NULL,
    consumed_units NUMERIC(10, 2) NOT NULL,
    slab_breakdown_json JSONB NOT NULL,
    base_energy_cost NUMERIC(12, 2) NOT NULL CHECK (base_energy_cost >= 0),
    demand_charge NUMERIC(12, 2) NOT NULL CHECK (demand_charge >= 0),
    vat_amount NUMERIC(12, 2) NOT NULL CHECK (vat_amount >= 0),
    meter_rent NUMERIC(12, 2) NOT NULL CHECK (meter_rent >= 0),
    rebate_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_bill NUMERIC(12, 2) NOT NULL CHECK (total_bill >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    due_amount NUMERIC(12, 2) NOT NULL CHECK (due_amount >= 0),
    payment_status payment_status_enum NOT NULL DEFAULT 'Not Paid',
    receipt_no TEXT,
    tariff_snapshot_title TEXT NOT NULL,
    generated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(unit_id, consumption_month, consumption_year)
);

-- 13. PAYMENT TRANSACTIONS (Verified Financial Collections)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_no TEXT UNIQUE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    flat_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Flat Rent', 'Electricity', 'Advance Payment', 'Parking', 'Godown', 'Combined')),
    month INT NOT NULL,
    year INT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_status verification_status_enum NOT NULL DEFAULT 'Verified',
    recorded_by TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. RECEIPTS (Official A4 Voucher Records)
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('advance', 'rent', 'electricity', 'combined', 'adjustment')),
    tenant_name TEXT NOT NULL,
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    purpose TEXT NOT NULL,
    remaining_due NUMERIC(12, 2) DEFAULT 0.00,
    remaining_advance NUMERIC(12, 2) DEFAULT 0.00,
    authorized_signature_by TEXT NOT NULL,
    breakdown_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. COMPLAINTS & TICKETS
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name block_name_enum NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Water', 'Electricity', 'Plumbing', 'Lift', 'Security', 'Cleaning', 'Other')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status complaint_status_enum NOT NULL DEFAULT 'Submitted',
    assigned_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. COMPLAINT MESSAGES
CREATE TABLE IF NOT EXISTS public.complaint_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role user_role_enum NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role user_role_enum NOT NULL,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- 18. ONLINE PAYMENT REQUESTS (bKash, Nagad, Rocket Verification Queue)
CREATE TABLE IF NOT EXISTS public.online_payment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bKash', 'Nagad', 'Rocket')),
    transaction_id TEXT NOT NULL,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verification_status verification_status_enum NOT NULL DEFAULT 'Pending',
    verified_by TEXT,
    notes TEXT
);

-- 19. AUDIT LOGS (Financial and System Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    user_role TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. PAYMENT SETTINGS
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id INT PRIMARY KEY DEFAULT 1,
    bkash_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bkash_number TEXT NOT NULL DEFAULT '01711-234567 (Merchant)',
    nagad_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    nagad_number TEXT NOT NULL DEFAULT '01811-234567 (Merchant)',
    rocket_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rocket_number TEXT NOT NULL DEFAULT '01911-234567-8',
    bank_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bank_name TEXT NOT NULL DEFAULT 'Islami Bank Bangladesh Ltd (Dhanmondi Branch)',
    bank_account_no TEXT NOT NULL DEFAULT '2050 1234 5678 9001',
    bank_routing TEXT NOT NULL DEFAULT 'IBBLBDDH025',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row_config CHECK (id = 1)
);

-- ==============================================================================
-- 21. HIGH-PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_block ON public.profiles(assigned_block);
CREATE INDEX IF NOT EXISTS idx_units_flat_id ON public.units(flat_id);
CREATE INDEX IF NOT EXISTS idx_units_block_name ON public.units(block_name);
CREATE INDEX IF NOT EXISTS idx_tenants_flat_id ON public.tenants(flat_id);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_id ON public.tenants(unit_id);
CREATE INDEX IF NOT EXISTS idx_advance_flat_id ON public.advance_accounts(flat_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_period ON public.monthly_rent_charges(month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_block ON public.monthly_rent_charges(block_name);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_flat ON public.monthly_rent_charges(flat_id);
CREATE INDEX IF NOT EXISTS idx_meter_reading_period ON public.meter_readings(month, year);
CREATE INDEX IF NOT EXISTS idx_elec_bills_period ON public.electricity_bills(billing_month, billing_year);
CREATE INDEX IF NOT EXISTS idx_payment_date ON public.payment_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_complaints_block ON public.complaints(block_name);
CREATE INDEX IF NOT EXISTS idx_chat_convo ON public.chat_messages(conversation_id);
