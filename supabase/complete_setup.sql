-- ==============================================================================
-- APARTMENT MANAGEMENT ERP SYSTEM - BANGLADESH
-- Complex Name: Ma Babar Doa Apartment Complex
-- Address: 72/32 M Rahman Nursing College Road, City Bypass, Horogram Purbopara, Dingadoba Rajshahi-6201.
-- Contact Number: 01737-321998 (Manager), 01913-858775 (Raju)
-- COMPLETE PRODUCTION DATABASE MIGRATION SCRIPT (ALL-IN-ONE)
-- Execute this script in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- SECTION 1: EXTENSIONS & CUSTOM ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('manager', 'owner', 'tenant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE block_name_enum AS ENUM ('Block A', 'Block B', 'Block C');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE unit_type_enum AS ENUM ('residential', 'parking', 'godown', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE elec_billing_enum AS ENUM ('nesco_submeter', 'fixed', 'none');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('Paid', 'Not Paid', 'Partially Paid', 'Adjusted', 'N/A');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status_enum AS ENUM ('Submitted', 'In Progress', 'Resolved', 'Rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM ('Pending', 'Verified', 'Rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SECTION 2: CORE TABLES
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

CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name block_name_enum UNIQUE NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_floors INT NOT NULL DEFAULT 7,
    total_units INT NOT NULL DEFAULT 8,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flat_id TEXT UNIQUE NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.complaint_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role user_role_enum NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_units_flat_id ON public.units(flat_id);
CREATE INDEX IF NOT EXISTS idx_units_block_name ON public.units(block_name);
CREATE INDEX IF NOT EXISTS idx_tenants_flat_id ON public.tenants(flat_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_period ON public.monthly_rent_charges(month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_block ON public.monthly_rent_charges(block_name);
CREATE INDEX IF NOT EXISTS idx_elec_bills_period ON public.electricity_bills(billing_month, billing_year);

-- SECTION 3: ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_rent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_rent_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SECTION 4: SECURITY DEFINER FUNCTIONS FOR RLS CHECKS
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_block()
RETURNS block_name_enum AS $$
  SELECT assigned_block FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_flat()
RETURNS TEXT AS $$
  SELECT flat_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'manager' FROM public.profiles WHERE id = auth.uid()), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS POLICIES ENFORCING ISOLATION
CREATE POLICY "Manager full on profiles" ON public.profiles FOR ALL USING (public.is_manager());
CREATE POLICY "Self view profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Manager full on blocks" ON public.blocks FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view assigned block" ON public.blocks FOR SELECT USING (public.get_current_role() = 'owner' AND name = public.get_current_block());

-- UNITS: Block A Owner CANNOT see Block B or C!
CREATE POLICY "Manager full on units" ON public.units FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view assigned block units" ON public.units FOR SELECT USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block());
CREATE POLICY "Tenant view own flat unit" ON public.units FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

-- TENANTS:
CREATE POLICY "Manager full on tenants" ON public.tenants FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view assigned block tenants" ON public.tenants FOR SELECT USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block());
CREATE POLICY "Tenant view own tenant record" ON public.tenants FOR SELECT USING (profile_id = auth.uid() OR flat_id = public.get_current_flat());

-- ADVANCE:
CREATE POLICY "Manager full on advance_accounts" ON public.advance_accounts FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block advance_accounts" ON public.advance_accounts FOR SELECT USING (public.get_current_role() = 'owner' AND flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block()));
CREATE POLICY "Tenant view own advance_account" ON public.advance_accounts FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

CREATE POLICY "Manager full on advance_transactions" ON public.advance_transactions FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block advance_transactions" ON public.advance_transactions FOR SELECT USING (public.get_current_role() = 'owner' AND flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block()));
CREATE POLICY "Tenant view own advance_transactions" ON public.advance_transactions FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

-- MONTHLY RENT LEDGER & STRICT MONTHLY SCOPING RECORDS:
CREATE POLICY "Manager full on monthly_rent_records" ON public.monthly_rent_records FOR ALL USING (public.is_manager());
CREATE POLICY "Owner access block monthly_rent_records" ON public.monthly_rent_records FOR ALL USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block()::text);
CREATE POLICY "Tenant view own monthly_rent_records" ON public.monthly_rent_records FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());
CREATE POLICY "Dev public access on monthly_rent_records" ON public.monthly_rent_records FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- Legacy monthly_rent_charges:
CREATE POLICY "Manager full on monthly_rent_charges" ON public.monthly_rent_charges FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block monthly_rent_charges" ON public.monthly_rent_charges FOR SELECT USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block());
CREATE POLICY "Tenant view own monthly_rent_charges" ON public.monthly_rent_charges FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

-- ELECTRICITY & METER READINGS:
CREATE POLICY "Manager full on electricity_tariffs" ON public.electricity_tariffs FOR ALL USING (public.is_manager());
CREATE POLICY "Authenticated view electricity_tariffs" ON public.electricity_tariffs FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Manager full on meter_readings" ON public.meter_readings FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block meter_readings" ON public.meter_readings FOR SELECT USING (public.get_current_role() = 'owner' AND flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block()));
CREATE POLICY "Tenant view own meter_readings" ON public.meter_readings FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

CREATE POLICY "Manager full on electricity_bills" ON public.electricity_bills FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block electricity_bills" ON public.electricity_bills FOR SELECT USING (public.get_current_role() = 'owner' AND flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block()));
CREATE POLICY "Tenant view own electricity_bills" ON public.electricity_bills FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

-- PAYMENTS & RECEIPTS:
CREATE POLICY "Manager full on payment_transactions" ON public.payment_transactions FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block payment_transactions" ON public.payment_transactions FOR SELECT USING (public.get_current_role() = 'owner' AND flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block()));
CREATE POLICY "Tenant view own payment_transactions" ON public.payment_transactions FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

CREATE POLICY "Manager full on receipts" ON public.receipts FOR ALL USING (public.is_manager());
CREATE POLICY "Owner view block receipts" ON public.receipts FOR SELECT USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block()::text);
CREATE POLICY "Tenant view own receipts" ON public.receipts FOR SELECT USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

-- COMPLAINTS & CHAT:
CREATE POLICY "Manager full on complaints" ON public.complaints FOR ALL USING (public.is_manager());
CREATE POLICY "Owner manage block complaints" ON public.complaints FOR ALL USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block());
CREATE POLICY "Tenant manage own complaints" ON public.complaints FOR ALL USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

CREATE POLICY "Manager full on chat_messages" ON public.chat_messages FOR ALL USING (public.is_manager());
CREATE POLICY "Users chat access" ON public.chat_messages FOR ALL USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Manager full on online_payment_requests" ON public.online_payment_requests FOR ALL USING (public.is_manager());
CREATE POLICY "Tenant submit payment requests" ON public.online_payment_requests FOR ALL USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());

CREATE POLICY "Manager full on payment_settings" ON public.payment_settings FOR ALL USING (public.is_manager());
CREATE POLICY "Authenticated view payment_settings" ON public.payment_settings FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Manager view audit_logs" ON public.audit_logs FOR ALL USING (public.is_manager());

-- SECTION 5: PRIVILEGED RPC FUNCTIONS (ACCOUNT PROVISIONING & TRANSACTION-SAFE ACTIONS)
CREATE OR REPLACE FUNCTION public.provision_tenant_account(
    p_flat_id TEXT,
    p_full_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_nid_number TEXT,
    p_temp_password TEXT,
    p_entry_date DATE,
    p_required_advance NUMERIC,
    p_emergency_contact TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_unit_id UUID;
    v_block_name block_name_enum;
    v_tenant_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Access Denied: Only Manager Russell can provision tenant accounts.';
    END IF;

    SELECT id, block_name INTO v_unit_id, v_block_name FROM public.units WHERE flat_id = p_flat_id;
    IF v_unit_id IS NULL THEN RAISE EXCEPTION 'Unit % does not exist.', p_flat_id; END IF;

    v_user_id := uuid_generate_v4();
    v_encrypted_pw := crypt(p_temp_password, gen_salt('bf', 10));

    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', p_email, v_encrypted_pw, NOW(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_full_name, 'phone', p_phone, 'role', 'tenant', 'flat_id', p_flat_id), NOW(), NOW(), 'authenticated', 'authenticated');

    INSERT INTO public.profiles (id, email, full_name, phone, role, flat_id, is_active)
    VALUES (v_user_id, p_email, p_full_name, p_phone, 'tenant', p_flat_id, TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = p_full_name, phone = p_phone, flat_id = p_flat_id;

    INSERT INTO public.tenants (profile_id, unit_id, flat_id, block_name, full_name, phone, nid_number, email, entry_date, emergency_contact, status)
    VALUES (v_user_id, v_unit_id, p_flat_id, v_block_name, p_full_name, p_phone, p_nid_number, p_email, p_entry_date, p_emergency_contact, 'active')
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.advance_accounts (tenant_id, unit_id, flat_id, total_required, amount_paid, remaining_advance, status)
    VALUES (v_tenant_id, v_unit_id, p_flat_id, p_required_advance, 0.00, p_required_advance, 'not_paid');

    UPDATE public.units SET is_occupied = TRUE, tenant_id = v_user_id, updated_at = NOW() WHERE id = v_unit_id;

    INSERT INTO public.audit_logs (action, entity, entity_id, performed_by, user_role, details)
    VALUES ('PROVISION_TENANT', 'profiles', v_user_id::text, 'Manager Russell', 'manager', format('Provisioned resident account %s for Flat %s', p_full_name, p_flat_id));

    RETURN jsonb_build_object('success', TRUE, 'user_id', v_user_id, 'tenant_id', v_tenant_id, 'flat_id', p_flat_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_encrypted_pw TEXT;
    v_email TEXT;
BEGIN
    IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Access Denied: Only Manager Russell can reset passwords.';
    END IF;

    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));

    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw, updated_at = NOW()
    WHERE id = p_target_user_id
    RETURNING email INTO v_email;

    IF v_email IS NULL THEN RAISE EXCEPTION 'User not found in auth schema.'; END IF;

    INSERT INTO public.audit_logs (action, entity, entity_id, performed_by, user_role, details)
    VALUES ('RESET_PASSWORD', 'auth.users', p_target_user_id::text, 'Manager Russell', 'manager', format('Reset credentials for user %s', v_email));

    RETURN jsonb_build_object('success', TRUE, 'message', format('Password successfully reset for %s', v_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
