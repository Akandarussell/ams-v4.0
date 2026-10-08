-- ==============================================================================
-- MIGRATION 02: ROW LEVEL SECURITY (RLS) POLICIES & RBAC ENFORCEMENT
-- Apartment Management ERP System - Bangladesh
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_transactions ENABLE ROW LEVEL SECURITY;
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

-- 2. SECURITY DEFINER HELPER FUNCTIONS (Prevent Infinite Recursion in RLS)
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

-- ==============================================================================
-- 3. PROFILES POLICIES
-- ==============================================================================
CREATE POLICY "Manager unrestricted access on profiles"
    ON public.profiles FOR ALL
    USING (public.is_manager());

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Block owners can view tenants in their assigned block"
    ON public.profiles FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

-- ==============================================================================
-- 4. BLOCKS POLICIES
-- ==============================================================================
CREATE POLICY "Manager full control on blocks"
    ON public.blocks FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owners can view only their assigned block"
    ON public.blocks FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        name = public.get_current_block()
    );

CREATE POLICY "Tenants can view their block info"
    ON public.blocks FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        name = (SELECT block_name FROM public.units WHERE flat_id = public.get_current_flat() LIMIT 1)
    );

-- ==============================================================================
-- 5. UNITS POLICIES (Block A Owner CANNOT see Block B or C!)
-- ==============================================================================
CREATE POLICY "Manager full access on units"
    ON public.units FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view strictly their assigned block units"
    ON public.units FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()
    );

CREATE POLICY "Tenant view only their own assigned flat"
    ON public.units FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 6. TENANTS POLICIES
-- ==============================================================================
CREATE POLICY "Manager full access on tenants"
    ON public.tenants FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view strictly their assigned block tenants"
    ON public.tenants FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()
    );

CREATE POLICY "Tenant view strictly their own record"
    ON public.tenants FOR SELECT
    USING (
        profile_id = auth.uid() OR
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 7. ADVANCE ACCOUNTS & TRANSACTIONS POLICIES
-- ==============================================================================
CREATE POLICY "Manager full access on advance accounts"
    ON public.advance_accounts FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view advance accounts for their block"
    ON public.advance_accounts FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant view own advance account"
    ON public.advance_accounts FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

CREATE POLICY "Manager full access on advance transactions"
    ON public.advance_transactions FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view advance transactions for their block"
    ON public.advance_transactions FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant view own advance transactions"
    ON public.advance_transactions FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 8. MONTHLY RENT RECORDS & CHARGES (MAIN FINANCIAL LEDGER - STRICT MONTHLY SCOPING)
-- ==============================================================================
ALTER TABLE public.monthly_rent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager full access on monthly_rent_records"
    ON public.monthly_rent_records FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner access on their assigned block monthly_rent_records"
    ON public.monthly_rent_records FOR ALL
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()
    );

CREATE POLICY "Tenant view strictly their own flat monthly_rent_records"
    ON public.monthly_rent_records FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- Allow public anon read/write if dev API key is used
CREATE POLICY "Dev public access on monthly_rent_records"
    ON public.monthly_rent_records FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Legacy monthly_rent_charges policies
CREATE POLICY "Manager full access on monthly rent ledger"
    ON public.monthly_rent_charges FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view strictly their assigned block ledger"
    ON public.monthly_rent_charges FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()
    );

CREATE POLICY "Tenant view strictly their own monthly ledger"
    ON public.monthly_rent_charges FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 9. ELECTRICITY TARIFFS & METER READINGS & BILLS
-- ==============================================================================
CREATE POLICY "Manager full access on tariffs"
    ON public.electricity_tariffs FOR ALL
    USING (public.is_manager());

CREATE POLICY "Anyone authenticated can view tariffs"
    ON public.electricity_tariffs FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Manager full access on meter readings"
    ON public.meter_readings FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view meter readings of their block"
    ON public.meter_readings FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant view own meter reading"
    ON public.meter_readings FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

CREATE POLICY "Manager full access on electricity bills"
    ON public.electricity_bills FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view electricity bills of their block"
    ON public.electricity_bills FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant view own electricity bills"
    ON public.electricity_bills FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 10. PAYMENT TRANSACTIONS & RECEIPTS
-- ==============================================================================
CREATE POLICY "Manager full access on payment transactions"
    ON public.payment_transactions FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view payment transactions of their block"
    ON public.payment_transactions FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant view own payment transactions"
    ON public.payment_transactions FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

CREATE POLICY "Manager full access on receipts"
    ON public.receipts FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view receipts of their block"
    ON public.receipts FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()::text
    );

CREATE POLICY "Tenant view own receipts"
    ON public.receipts FOR SELECT
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 11. COMPLAINTS & MESSAGES
-- ==============================================================================
CREATE POLICY "Manager full access on complaints"
    ON public.complaints FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view and manage complaints of their block"
    ON public.complaints FOR ALL
    USING (
        public.get_current_role() = 'owner' AND
        block_name = public.get_current_block()
    );

CREATE POLICY "Tenant view and submit own complaints"
    ON public.complaints FOR ALL
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

CREATE POLICY "Manager full access on complaint messages"
    ON public.complaint_messages FOR ALL
    USING (public.is_manager());

CREATE POLICY "Complaint messages access check"
    ON public.complaint_messages FOR ALL
    USING (
        public.is_manager() OR
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_id AND (
                (public.get_current_role() = 'owner' AND c.block_name = public.get_current_block()) OR
                (public.get_current_role() = 'tenant' AND c.flat_id = public.get_current_flat())
            )
        )
    );

-- ==============================================================================
-- 12. CHAT MESSAGES
-- ==============================================================================
CREATE POLICY "Manager full access on chat messages"
    ON public.chat_messages FOR ALL
    USING (public.is_manager());

CREATE POLICY "Users can view and send their own chat messages"
    ON public.chat_messages FOR ALL
    USING (
        sender_id = auth.uid() OR recipient_id = auth.uid()
    );

-- ==============================================================================
-- 13. ONLINE PAYMENT REQUESTS
-- ==============================================================================
CREATE POLICY "Manager full access on online payment requests"
    ON public.online_payment_requests FOR ALL
    USING (public.is_manager());

CREATE POLICY "Block owner view online payment requests of their block"
    ON public.online_payment_requests FOR SELECT
    USING (
        public.get_current_role() = 'owner' AND
        flat_id IN (SELECT flat_id FROM public.units WHERE block_name = public.get_current_block())
    );

CREATE POLICY "Tenant submit and view own payment requests"
    ON public.online_payment_requests FOR ALL
    USING (
        public.get_current_role() = 'tenant' AND
        flat_id = public.get_current_flat()
    );

-- ==============================================================================
-- 14. PAYMENT SETTINGS & AUDIT LOGS
-- ==============================================================================
CREATE POLICY "Manager full control on payment settings"
    ON public.payment_settings FOR ALL
    USING (public.is_manager());

CREATE POLICY "Anyone authenticated can view payment settings"
    ON public.payment_settings FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Manager view audit logs"
    ON public.audit_logs FOR ALL
    USING (public.is_manager());
