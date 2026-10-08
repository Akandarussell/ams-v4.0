-- ==============================================================================
-- MIGRATION 03: SECURE ACCOUNT PROVISIONING & PRIVILEGED RPC FUNCTIONS
-- Apartment Management ERP System - Bangladesh
-- ==============================================================================

-- 1. Sync Trigger: Whenever a user is created via Supabase Auth, populate public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role user_role_enum := 'tenant';
    v_block block_name_enum := NULL;
    v_flat_id TEXT := NULL;
    v_full_name TEXT := 'New User';
    v_phone TEXT := '01700-000000';
BEGIN
    -- Extract metadata if passed
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
        v_role := (NEW.raw_user_meta_data->>'role')::user_role_enum;
    END IF;

    IF NEW.raw_user_meta_data->>'assigned_block' IS NOT NULL THEN
        v_block := (NEW.raw_user_meta_data->>'assigned_block')::block_name_enum;
    END IF;

    IF NEW.raw_user_meta_data->>'flat_id' IS NOT NULL THEN
        v_flat_id := NEW.raw_user_meta_data->>'flat_id';
    END IF;

    IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
        v_full_name := NEW.raw_user_meta_data->>'full_name';
    END IF;

    IF NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN
        v_phone := NEW.raw_user_meta_data->>'phone';
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        assigned_block,
        flat_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_phone,
        v_role,
        v_block,
        v_flat_id,
        TRUE,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        assigned_block = EXCLUDED.assigned_block,
        flat_id = EXCLUDED.flat_id,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 2. PRIVILEGED RPC: PROVISION TENANT ACCOUNT (Manager Only)
-- Creates auth record, profile, tenant record, advance account, and updates unit
-- ==============================================================================
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
    -- Security Check: Caller must be Manager (Super Admin)
    IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Access Denied: Only Manager Russell can provision tenant accounts.';
    END IF;

    -- Lookup unit
    SELECT id, block_name INTO v_unit_id, v_block_name
    FROM public.units
    WHERE flat_id = p_flat_id;

    IF v_unit_id IS NULL THEN
        RAISE EXCEPTION 'Unit % does not exist.', p_flat_id;
    END IF;

    -- Generate UUID for new auth user
    v_user_id := uuid_generate_v4();
    v_encrypted_pw := crypt(p_temp_password, gen_salt('bf', 10));

    -- Insert into auth.users (Internal Supabase Auth Schema)
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        role,
        aud
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        p_email,
        v_encrypted_pw,
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object(
            'full_name', p_full_name,
            'phone', p_phone,
            'role', 'tenant',
            'flat_id', p_flat_id
        ),
        NOW(),
        NOW(),
        'authenticated',
        'authenticated'
    );

    -- Ensure public.profiles record is updated
    INSERT INTO public.profiles (
        id, email, full_name, phone, role, flat_id, is_active
    ) VALUES (
        v_user_id, p_email, p_full_name, p_phone, 'tenant', p_flat_id, TRUE
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = p_full_name,
        phone = p_phone,
        flat_id = p_flat_id;

    -- Create Tenant record
    INSERT INTO public.tenants (
        profile_id, unit_id, flat_id, block_name, full_name, phone, nid_number, email, entry_date, emergency_contact, status
    ) VALUES (
        v_user_id, v_unit_id, p_flat_id, v_block_name, p_full_name, p_phone, p_nid_number, p_email, p_entry_date, p_emergency_contact, 'active'
    ) RETURNING id INTO v_tenant_id;

    -- Create Initial Advance Account
    INSERT INTO public.advance_accounts (
        tenant_id, unit_id, flat_id, total_required, amount_paid, remaining_advance, status
    ) VALUES (
        v_tenant_id, v_unit_id, p_flat_id, p_required_advance, 0.00, p_required_advance, 'not_paid'
    );

    -- Mark Unit as occupied
    UPDATE public.units
    SET is_occupied = TRUE, tenant_id = v_user_id, updated_at = NOW()
    WHERE id = v_unit_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        action, entity, entity_id, performed_by, user_role, details
    ) VALUES (
        'PROVISION_TENANT', 'profiles', v_user_id::text, 'Manager Russell', 'manager',
        format('Provisioned resident account %s for Flat %s with initial required advance ৳%s', p_full_name, p_flat_id, p_required_advance)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'user_id', v_user_id,
        'tenant_id', v_tenant_id,
        'flat_id', p_flat_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. PRIVILEGED RPC: ADMIN RESET USER PASSWORD (Manager Only)
-- Securely sets a new bcrypt password without plain-text storage
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_encrypted_pw TEXT;
    v_email TEXT;
BEGIN
    -- Security Check
    IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Access Denied: Only Manager Russell can reset passwords.';
    END IF;

    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));

    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw, updated_at = NOW()
    WHERE id = p_target_user_id
    RETURNING email INTO v_email;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'User not found in auth system.';
    END IF;

    INSERT INTO public.audit_logs (
        action, entity, entity_id, performed_by, user_role, details
    ) VALUES (
        'RESET_PASSWORD', 'auth.users', p_target_user_id::text, 'Manager Russell', 'manager',
        format('Reset credentials for user %s', v_email)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', format('Password successfully reset for %s', v_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 4. PRIVILEGED RPC: TRANSACTION-SAFE PAYMENT PROCESSING (Manager Only)
-- Atomically inserts payment transaction, updates monthly ledger, and generates receipt
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_verified_payment(
    p_flat_id TEXT,
    p_month INT,
    p_year INT,
    p_amount NUMERIC,
    p_category TEXT,
    p_method TEXT,
    p_transaction_id TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_unit_id UUID;
    v_block_name block_name_enum;
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_receipt_no TEXT;
    v_tx_id UUID;
    v_total_payable NUMERIC;
    v_total_paid NUMERIC;
    v_new_paid NUMERIC;
    v_new_due NUMERIC;
    v_new_status payment_status_enum;
BEGIN
    IF NOT public.is_manager() THEN
        RAISE EXCEPTION 'Access Denied: Payment recording requires managerial privileges.';
    END IF;

    -- Lookup unit and tenant
    SELECT id, block_name INTO v_unit_id, v_block_name
    FROM public.units WHERE flat_id = p_flat_id;

    SELECT id, full_name INTO v_tenant_id, v_tenant_name
    FROM public.tenants WHERE flat_id = p_flat_id AND status = 'active'
    LIMIT 1;

    v_receipt_no := format('REC-%s-%s-%s', p_flat_id, p_month, to_char(NOW(), 'YYMMDDHH24MISS'));

    -- 1. Insert Payment Transaction
    INSERT INTO public.payment_transactions (
        receipt_no, tenant_id, unit_id, flat_id, category, month, year, amount, payment_method, transaction_id, payment_date, verification_status, recorded_by, notes
    ) VALUES (
        v_receipt_no, v_tenant_id, v_unit_id, p_flat_id, p_category, p_month, p_year, p_amount, p_method, p_transaction_id, CURRENT_DATE, 'Verified', 'Manager Russell', p_notes
    ) RETURNING id INTO v_tx_id;

    -- 2. Update Monthly Ledger
    SELECT total_payable, total_paid INTO v_total_payable, v_total_paid
    FROM public.monthly_rent_charges
    WHERE unit_id = v_unit_id AND month = p_month AND year = p_year;

    IF v_total_payable IS NOT NULL THEN
        v_new_paid := v_total_paid + p_amount;
        v_new_due := GREATEST(0, v_total_payable - v_new_paid);
        IF v_new_paid >= v_total_payable THEN
            v_new_status := 'Paid';
        ELSIF v_new_paid > 0 THEN
            v_new_status := 'Partially Paid';
        ELSE
            v_new_status := 'Not Paid';
        END IF;

        UPDATE public.monthly_rent_charges
        SET total_paid = v_new_paid, total_due = v_new_due, payment_status = v_new_status, last_payment_date = CURRENT_DATE, updated_at = NOW()
        WHERE unit_id = v_unit_id AND month = p_month AND year = p_year;
    END IF;

    -- 3. Insert Official Receipt
    INSERT INTO public.receipts (
        receipt_number, type, tenant_name, flat_id, block_name, amount, payment_date, payment_method, purpose, remaining_due, authorized_signature_by
    ) VALUES (
        v_receipt_no, 'rent', COALESCE(v_tenant_name, 'Resident'), p_flat_id, v_block_name::text, p_amount, CURRENT_DATE, p_method, format('Payment for %s/%s', p_month, p_year), COALESCE(v_new_due, 0), 'Manager Russell'
    );

    -- 4. Audit Log
    INSERT INTO public.audit_logs (
        action, entity, entity_id, performed_by, user_role, details
    ) VALUES (
        'RECORD_PAYMENT', 'payment_transactions', v_tx_id::text, 'Manager Russell', 'manager',
        format('Recorded verified payment of ৳%s via %s for Flat %s', p_amount, p_method, p_flat_id)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'receipt_no', v_receipt_no,
        'amount', p_amount,
        'flat_id', p_flat_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
