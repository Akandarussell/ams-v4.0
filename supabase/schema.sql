-- ==============================================================================
-- APARTMENT MANAGEMENT ERP SYSTEM - BANGLADESH
-- Complex Name: Ma Babar Doa Apartment Complex
-- Address: 72/32 M Rahman Nursing College Road, City Bypass, Horogram Purbopara, Dingadoba Rajshahi-6201.
-- Contact Number: 01737-321998 (Manager), 01913-858775 (Raju)
-- Currency: Bangladeshi Taka (BDT / ৳) | Timezone: Asia/Dhaka
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Authority & Tenants)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'owner', 'tenant')),
    assigned_block TEXT CHECK (assigned_block IN ('Block A', 'Block B', 'Block C')),
    flat_id TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BLOCKS
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL CHECK (name IN ('Block A', 'Block B', 'Block C')),
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    total_floors INT DEFAULT 7,
    total_units INT DEFAULT 8,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. UNITS (Flats, Parking, Godown)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flat_id TEXT UNIQUE NOT NULL, -- e.g. 'A1', 'A5 Owner', 'A5 Sublet', 'B1', 'P1', 'G1'
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    block_name TEXT NOT NULL CHECK (block_name IN ('Block A', 'Block B', 'Block C')),
    floor INT NOT NULL DEFAULT 1,
    unit_type TEXT NOT NULL DEFAULT 'residential' CHECK (unit_type IN ('residential', 'parking', 'godown', 'other')),
    monthly_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    electricity_billing_type TEXT NOT NULL DEFAULT 'nesco_submeter' CHECK (electricity_billing_type IN ('nesco_submeter', 'fixed', 'none')),
    fixed_electricity_amount NUMERIC(12, 2) DEFAULT 0.00,
    parking_slot TEXT,
    godown_slot TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TENANTS (Tenant Details & Agreement Tracking)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL CHECK (block_name IN ('Block A', 'Block B', 'Block C')),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    nid_number TEXT NOT NULL,
    email TEXT,
    entry_date DATE NOT NULL,
    emergency_contact TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved_out')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADVANCE ACCOUNTS
CREATE TABLE IF NOT EXISTS advance_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    total_required NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_advance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'not_paid' CHECK (status IN ('paid', 'not_paid', 'partially_paid')),
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ADVANCE TRANSACTIONS (Audited receipts, deposit or adjustment)
CREATE TABLE IF NOT EXISTS advance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advance_account_id UUID REFERENCES advance_accounts(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'adjustment_deduction', 'refund')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL,
    receipt_no TEXT UNIQUE NOT NULL,
    transaction_id TEXT,
    notes TEXT,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MONTHLY RENT RECORDS & CHARGES (Strict Monthly Scoping)
CREATE TABLE IF NOT EXISTS public.monthly_rent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id TEXT NOT NULL,
    billing_period TEXT,
    period TEXT,
    flat_id TEXT,
    block_name TEXT,
    tenant_id TEXT,
    tenant_name TEXT DEFAULT 'Resident',
    tenant_phone TEXT,
    entry_date DATE,
    month INT CHECK (month BETWEEN 1 AND 12),
    year INT CHECK (year BETWEEN 2024 AND 2100),
    advance_payment NUMERIC(12, 2) DEFAULT 0.00,
    advance_paid NUMERIC(12, 2) DEFAULT 0.00,
    advance_status TEXT DEFAULT 'Paid',
    advance_date DATE,
    flat_rent NUMERIC(12, 2) DEFAULT 0.00,
    monthly_rent NUMERIC(12, 2) DEFAULT 0.00,
    rent_status TEXT DEFAULT 'Not Paid',
    rent_payment_date DATE,
    electricity_bill NUMERIC(12, 2) DEFAULT 0.00,
    electricity_status TEXT DEFAULT 'N/A',
    electricity_date DATE,
    parking_rent NUMERIC(12, 2) DEFAULT 0.00,
    godown_rent NUMERIC(12, 2) DEFAULT 0.00,
    total_payable NUMERIC(12, 2) DEFAULT 0.00,
    total_paid NUMERIC(12, 2) DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_due NUMERIC(12, 2) DEFAULT 0.00,
    due_amount NUMERIC(12, 2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'Not Paid',
    adjusted_from_advance NUMERIC(12, 2) DEFAULT 0.00,
    adjustment_amount NUMERIC(12, 2) DEFAULT 0.00,
    last_payment_date DATE,
    payment_method TEXT DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS billing_period TEXT;
ALTER TABLE public.monthly_rent_records ADD COLUMN IF NOT EXISTS period TEXT;
CREATE INDEX IF NOT EXISTS idx_monthly_rent_records_period ON public.monthly_rent_records(billing_period);
CREATE INDEX IF NOT EXISTS idx_monthly_rent_records_period_compat ON public.monthly_rent_records(period);

CREATE TABLE IF NOT EXISTS monthly_rent_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    advance_payment NUMERIC(12, 2) DEFAULT 0.00,
    flat_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    electricity_bill NUMERIC(12, 2) DEFAULT 0.00,
    parking_rent NUMERIC(12, 2) DEFAULT 0.00,
    godown_rent NUMERIC(12, 2) DEFAULT 0.00,
    total_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'Not Paid' CHECK (payment_status IN ('Paid', 'Not Paid', 'Partially Paid', 'Adjusted', 'N/A')),
    adjusted_from_advance NUMERIC(12, 2) DEFAULT 0.00,
    last_payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_id, month, year)
);

-- 8. ELECTRICITY TARIFFS (Bangladesh NESCO Residential progressive slab engine)
CREATE TABLE IF NOT EXISTS electricity_tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    effective_from DATE NOT NULL,
    slabs_json JSONB NOT NULL,
    demand_charge_per_kw NUMERIC(8, 2) DEFAULT 42.00,
    vat_percentage NUMERIC(5, 2) DEFAULT 5.00,
    meter_rent NUMERIC(8, 2) DEFAULT 40.00,
    rebate_percentage NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. METER READINGS (NESCO Sub-meters)
CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    previous_reading NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_reading NUMERIC(10, 2) NOT NULL,
    consumed_units NUMERIC(10, 2) NOT NULL,
    reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_id, month, year)
);

-- 10. ELECTRICITY BILLS (Postpaid billing cycle)
CREATE TABLE IF NOT EXISTS electricity_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    consumption_month INT NOT NULL,
    consumption_year INT NOT NULL,
    billing_month INT NOT NULL, -- e.g. Sep consumption billed in Oct collection ledger
    billing_year INT NOT NULL,
    previous_reading NUMERIC(10, 2) NOT NULL,
    current_reading NUMERIC(10, 2) NOT NULL,
    consumed_units NUMERIC(10, 2) NOT NULL,
    slab_breakdown_json JSONB NOT NULL,
    base_energy_cost NUMERIC(12, 2) NOT NULL,
    demand_charge NUMERIC(12, 2) NOT NULL,
    vat_amount NUMERIC(12, 2) NOT NULL,
    meter_rent NUMERIC(12, 2) NOT NULL,
    rebate_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_bill NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    due_amount NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Not Paid' CHECK (payment_status IN ('Paid', 'Not Paid', 'Partially Paid', 'N/A')),
    receipt_no TEXT,
    tariff_snapshot_title TEXT NOT NULL,
    generated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_id, consumption_month, consumption_year)
);

-- 11. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_no TEXT UNIQUE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    flat_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Flat Rent', 'Electricity', 'Advance Payment', 'Parking', 'Godown', 'Combined')),
    month INT NOT NULL,
    year INT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_status TEXT NOT NULL DEFAULT 'Verified' CHECK (verification_status IN ('Verified', 'Pending', 'Rejected')),
    recorded_by TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. RECEIPTS (A4 Official Printable Receipts)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('advance', 'rent', 'electricity', 'combined', 'adjustment')),
    tenant_name TEXT NOT NULL,
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    purpose TEXT NOT NULL,
    remaining_due NUMERIC(12, 2) DEFAULT 0.00,
    remaining_advance NUMERIC(12, 2) DEFAULT 0.00,
    authorized_signature_by TEXT NOT NULL,
    breakdown_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COMPLAINTS & TICKETS
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    block_name TEXT NOT NULL CHECK (block_name IN ('Block A', 'Block B', 'Block C')),
    category TEXT NOT NULL CHECK (category IN ('Water', 'Electricity', 'Plumbing', 'Lift', 'Security', 'Cleaning', 'Other')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Rejected')),
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. COMPLAINT MESSAGES
CREATE TABLE IF NOT EXISTS complaint_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 15. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- 16. ONLINE PAYMENT REQUESTS (bKash, Nagad, Rocket)
CREATE TABLE IF NOT EXISTS online_payment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    flat_id TEXT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bKash', 'Nagad', 'Rocket')),
    transaction_id TEXT NOT NULL,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected')),
    verified_by TEXT,
    notes TEXT
);

-- 17. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    user_role TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 18. PAYMENT SETTINGS (MFS Configuration)
CREATE TABLE IF NOT EXISTS payment_settings (
    id INT PRIMARY KEY DEFAULT 1,
    bkash_enabled BOOLEAN DEFAULT TRUE,
    bkash_number TEXT DEFAULT '01711-000001 (Merchant)',
    nagad_enabled BOOLEAN DEFAULT TRUE,
    nagad_number TEXT DEFAULT '01811-000002 (Merchant)',
    rocket_enabled BOOLEAN DEFAULT TRUE,
    rocket_number TEXT DEFAULT '01911-000003-8',
    bank_enabled BOOLEAN DEFAULT TRUE,
    bank_name TEXT DEFAULT 'Islami Bank Bangladesh Ltd',
    bank_account_no TEXT DEFAULT '20501234567890',
    bank_routing TEXT DEFAULT 'IBBLBDDH025',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_monthly_rent_month_year ON monthly_rent_charges(month, year);
CREATE INDEX IF NOT EXISTS idx_units_block_name ON units(block_name);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payment_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_electricity_billing ON electricity_bills(billing_month, billing_year);
CREATE INDEX IF NOT EXISTS idx_complaints_block ON complaints(block_name);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rent_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS FOR RLS CHECKS
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_auth_block()
RETURNS TEXT AS $$
  SELECT assigned_block FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_auth_flat()
RETURNS TEXT AS $$
  SELECT flat_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. MANAGER POLICIES (Super Admin has unrestricted full access to everything)
CREATE POLICY "Manager full access on profiles" ON profiles
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on units" ON units
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on tenants" ON tenants
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on advance_accounts" ON advance_accounts
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on advance_transactions" ON advance_transactions
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on monthly_rent_charges" ON monthly_rent_charges
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on meter_readings" ON meter_readings
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on electricity_bills" ON electricity_bills
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on payment_transactions" ON payment_transactions
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on receipts" ON receipts
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on complaints" ON complaints
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on chat_messages" ON chat_messages
    FOR ALL USING (get_auth_role() = 'manager');

CREATE POLICY "Manager full access on audit_logs" ON audit_logs
    FOR ALL USING (get_auth_role() = 'manager');

-- 2. BLOCK OWNER POLICIES (Scoped exclusively to assigned Block A, B, or C)
CREATE POLICY "Owner view assigned units" ON units
    FOR SELECT USING (get_auth_role() = 'owner' AND block_name = get_auth_block());

CREATE POLICY "Owner view assigned tenants" ON tenants
    FOR SELECT USING (get_auth_role() = 'owner' AND block_name = get_auth_block());

CREATE POLICY "Owner view assigned advance_accounts" ON advance_accounts
    FOR SELECT USING (
        get_auth_role() = 'owner' AND 
        unit_id IN (SELECT id FROM units WHERE block_name = get_auth_block())
    );

CREATE POLICY "Owner view assigned ledger" ON monthly_rent_charges
    FOR SELECT USING (get_auth_role() = 'owner' AND block_name = get_auth_block());

CREATE POLICY "Owner view assigned electricity bills" ON electricity_bills
    FOR SELECT USING (
        get_auth_role() = 'owner' AND 
        unit_id IN (SELECT id FROM units WHERE block_name = get_auth_block())
    );

CREATE POLICY "Owner manage complaints in block" ON complaints
    FOR ALL USING (get_auth_role() = 'owner' AND block_name = get_auth_block());

CREATE POLICY "Owner chat with block tenants" ON chat_messages
    FOR ALL USING (
        get_auth_role() = 'owner' AND 
        (sender_id = auth.uid() OR recipient_id = auth.uid())
    );

-- 3. TENANT POLICIES (Strictly isolated to their own flat & financial records)
CREATE POLICY "Tenant view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Tenant view own unit" ON units
    FOR SELECT USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant view own tenant record" ON tenants
    FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Tenant view own advance account" ON advance_accounts
    FOR SELECT USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant view own monthly ledger" ON monthly_rent_charges
    FOR SELECT USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant view own electricity bills" ON electricity_bills
    FOR SELECT USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant view own receipts" ON receipts
    FOR SELECT USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant manage own complaints" ON complaints
    FOR ALL USING (flat_id = get_auth_flat());

CREATE POLICY "Tenant view own chat" ON chat_messages
    FOR ALL USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Tenant submit payment request" ON online_payment_requests
    FOR ALL USING (flat_id = get_auth_flat());
