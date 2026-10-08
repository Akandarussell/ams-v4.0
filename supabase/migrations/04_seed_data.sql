-- ==============================================================================
-- MIGRATION 04: INITIAL DEMO DATA SEEDING (BLOCKS A, B, C, RESIDENTS & NESCO)
-- Complex Name: Ma Babar Doa Apartment Complex
-- Address: 72/32 M Rahman Nursing College Road, City Bypass, Horogram Purbopara, Dingadoba Rajshahi-6201.
-- Contact Number: 01737-321998 (Manager), 01913-858775 (Raju)
-- Apartment Management ERP System - Bangladesh
-- ==============================================================================

DO $$
DECLARE
    v_mgr_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_owner_a_id UUID := '00000000-0000-0000-0000-000000000002'::uuid;
    v_owner_b_id UUID := '00000000-0000-0000-0000-000000000003'::uuid;
    v_owner_c_id UUID := '00000000-0000-0000-0000-000000000004'::uuid;
    v_tenant_a2_id UUID := '00000000-0000-0000-0000-000000000012'::uuid;
    v_tenant_b3_id UUID := '00000000-0000-0000-0000-000000000023'::uuid;
    v_block_a_id UUID;
    v_block_b_id UUID;
    v_block_c_id UUID;
BEGIN
    -- 1. Insert Core Profiles (Bypassing auth.users constraint for demonstration/seed in public schema)
    -- In Supabase production, these will correspond to actual auth.users IDs.
    -- To ensure foreign key integrity if auth.users has not yet registered them, we insert placeholder auth.users records:
    BEGIN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
        VALUES
        (v_mgr_id, '00000000-0000-0000-0000-000000000000', 'akandarussell@gmail.com', crypt('password123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Russell","role":"manager"}', NOW(), NOW(), 'authenticated', 'authenticated'),
        (v_owner_a_id, '00000000-0000-0000-0000-000000000000', 'rashed.blocka@mbdapartment.com', crypt('password123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rashed","role":"owner","assigned_block":"Block A"}', NOW(), NOW(), 'authenticated', 'authenticated'),
        (v_owner_b_id, '00000000-0000-0000-0000-000000000000', 'raju.blockb@mbdapartment.com', crypt('password123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Raju","role":"owner","assigned_block":"Block B"}', NOW(), NOW(), 'authenticated', 'authenticated'),
        (v_owner_c_id, '00000000-0000-0000-0000-000000000000', 'rony.blockc@mbdapartment.com', crypt('password123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rony","role":"owner","assigned_block":"Block C"}', NOW(), NOW(), 'authenticated', 'authenticated'),
        (v_tenant_a2_id, '00000000-0000-0000-0000-000000000000', 'tanvir.a2@gmail.com', crypt('tenant123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tanvir Ahmed Chy","role":"tenant","flat_id":"A2"}', NOW(), NOW(), 'authenticated', 'authenticated'),
        (v_tenant_b3_id, '00000000-0000-0000-0000-000000000000', 'farhana.b3@gmail.com', crypt('tenant123', gen_salt('bf', 10)), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Farhana Begum","role":"tenant","flat_id":"B3"}', NOW(), NOW(), 'authenticated', 'authenticated')
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION
        WHEN OTHERS THEN
            NULL; -- If auth.users is managed by external Supabase service, continue gracefully
    END;

    -- Upsert Public Profiles
    INSERT INTO public.profiles (id, email, full_name, phone, role, assigned_block, is_active)
    VALUES
    (v_mgr_id, 'akandarussell@gmail.com', 'Russell (Manager)', '01737-321998', 'manager', NULL, TRUE),
    (v_owner_a_id, 'rashed.blocka@mbdapartment.com', 'Md. Rashed (Block A Owner)', '01717623061', 'owner', 'Block A', TRUE),
    (v_owner_b_id, 'raju.blockb@mbdapartment.com', 'Md. Raju (Block B Owner)', '01913858775', 'owner', 'Block B', TRUE),
    (v_owner_c_id, 'rony.blockc@mbdapartment.com', 'Md. Rony (Block C Owner)', '01712118547', 'owner', 'Block C', TRUE)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        assigned_block = EXCLUDED.assigned_block;

    -- 2. Insert Blocks
    INSERT INTO public.blocks (id, name, owner_id, total_floors, total_units, description)
    VALUES
    ('11111111-1111-1111-1111-111111111111', 'Block A', v_owner_a_id, 7, 8, 'West wing with private lift and generator backup')
    ON CONFLICT (name) DO UPDATE SET owner_id = v_owner_a_id
    RETURNING id INTO v_block_a_id;

    INSERT INTO public.blocks (id, name, owner_id, total_floors, total_units, description)
    VALUES
    ('22222222-2222-2222-2222-222222222222', 'Block B', v_owner_b_id, 7, 7, 'Central courtyard wing')
    ON CONFLICT (name) DO UPDATE SET owner_id = v_owner_b_id
    RETURNING id INTO v_block_b_id;

    INSERT INTO public.blocks (id, name, owner_id, total_floors, total_units, description)
    VALUES
    ('33333333-3333-3333-3333-333333333333', 'Block C', v_owner_c_id, 7, 7, 'East wing facing green garden')
    ON CONFLICT (name) DO UPDATE SET owner_id = v_owner_c_id
    RETURNING id INTO v_block_c_id;

    -- 3. Insert Units
    -- Block A Units
    INSERT INTO public.units (flat_id, block_id, block_name, floor, unit_type, monthly_rent, is_occupied, electricity_billing_type) VALUES
    ('A1', v_block_a_id, 'Block A', 1, 'residential', 22000, TRUE, 'nesco_submeter'),
    ('A2', v_block_a_id, 'Block A', 2, 'residential', 24000, TRUE, 'nesco_submeter'),
    ('A3', v_block_a_id, 'Block A', 3, 'residential', 24000, TRUE, 'nesco_submeter'),
    ('A4', v_block_a_id, 'Block A', 4, 'residential', 25000, TRUE, 'nesco_submeter'),
    ('A5', v_block_a_id, 'Block A', 5, 'residential', 25000, TRUE, 'nesco_submeter'),
    ('A5 Owner', v_block_a_id, 'Block A', 5, 'residential', 0, TRUE, 'fixed'),
    ('A5 (Owner)', v_block_a_id, 'Block A', 5, 'residential', 0, TRUE, 'fixed'),
    ('A5 Sublet', v_block_a_id, 'Block A', 5, 'residential', 12000, TRUE, 'fixed'),
    ('A6', v_block_a_id, 'Block A', 6, 'residential', 25000, TRUE, 'nesco_submeter'),
    ('A7', v_block_a_id, 'Block A', 7, 'residential', 26000, FALSE, 'nesco_submeter')
    ON CONFLICT (flat_id) DO NOTHING;

    -- Block B Units
    INSERT INTO public.units (flat_id, block_id, block_name, floor, unit_type, monthly_rent, is_occupied, electricity_billing_type) VALUES
    ('B1', v_block_b_id, 'Block B', 1, 'residential', 21000, TRUE, 'nesco_submeter'),
    ('B2', v_block_b_id, 'Block B', 2, 'residential', 23000, TRUE, 'nesco_submeter'),
    ('B3', v_block_b_id, 'Block B', 3, 'residential', 23000, TRUE, 'nesco_submeter'),
    ('B4', v_block_b_id, 'Block B', 4, 'residential', 24000, TRUE, 'nesco_submeter'),
    ('B5', v_block_b_id, 'Block B', 5, 'residential', 24000, TRUE, 'nesco_submeter'),
    ('B6', v_block_b_id, 'Block B', 6, 'residential', 25000, TRUE, 'nesco_submeter'),
    ('B7', v_block_b_id, 'Block B', 7, 'residential', 25000, FALSE, 'nesco_submeter')
    ON CONFLICT (flat_id) DO NOTHING;

    -- Block C Units
    INSERT INTO public.units (flat_id, block_id, block_name, floor, unit_type, monthly_rent, is_occupied, electricity_billing_type) VALUES
    ('C1', v_block_c_id, 'Block C', 1, 'residential', 20000, TRUE, 'nesco_submeter'),
    ('C2', v_block_c_id, 'Block C', 2, 'residential', 22000, TRUE, 'nesco_submeter'),
    ('C3', v_block_c_id, 'Block C', 3, 'residential', 22000, TRUE, 'nesco_submeter'),
    ('C4', v_block_c_id, 'Block C', 4, 'residential', 23000, TRUE, 'nesco_submeter'),
    ('C5 Owner', v_block_c_id, 'Block C', 5, 'residential', 0, TRUE, 'fixed'),
    ('C6', v_block_c_id, 'Block C', 6, 'residential', 24000, TRUE, 'nesco_submeter'),
    ('C7', v_block_c_id, 'Block C', 7, 'residential', 25000, FALSE, 'nesco_submeter')
    ON CONFLICT (flat_id) DO NOTHING;

    -- Parking & Godowns
    INSERT INTO public.units (flat_id, block_id, block_name, floor, unit_type, monthly_rent, is_occupied, electricity_billing_type) VALUES
    ('P1', v_block_a_id, 'Block A', 0, 'parking', 2500, TRUE, 'none'),
    ('P2', v_block_b_id, 'Block B', 0, 'parking', 2500, TRUE, 'none'),
    ('P3', v_block_c_id, 'Block C', 0, 'parking', 2500, TRUE, 'none'),
    ('G1', v_block_a_id, 'Block A', 0, 'godown', 6000, TRUE, 'none'),
    ('G2', v_block_b_id, 'Block B', 0, 'godown', 6000, TRUE, 'none')
    ON CONFLICT (flat_id) DO NOTHING;

    -- 4. Insert Default NESCO Tariff Configuration
    INSERT INTO public.electricity_tariffs (
        title, effective_from, slabs_json, demand_charge_per_kw, vat_percentage, meter_rent, is_active
    ) VALUES (
        'NESCO Residential Tariff (LT-A Postpaid 2026 Update)',
        '2026-01-01',
        '[
          {"slabName": "0–50 units (Lifeline)", "minUnits": 0, "maxUnits": 50, "ratePerUnit": 4.63},
          {"slabName": "0–75 units (First-stage)", "minUnits": 0, "maxUnits": 75, "ratePerUnit": 5.26},
          {"slabName": "76–200 units", "minUnits": 76, "maxUnits": 200, "ratePerUnit": 8.50},
          {"slabName": "201–300 units", "minUnits": 201, "maxUnits": 300, "ratePerUnit": 9.10},
          {"slabName": "301–400 units", "minUnits": 301, "maxUnits": 400, "ratePerUnit": 9.62},
          {"slabName": "401–600 units", "minUnits": 401, "maxUnits": 600, "ratePerUnit": 15.01},
          {"slabName": "Above 600 units", "minUnits": 601, "maxUnits": null, "ratePerUnit": 17.35}
        ]'::jsonb,
        42.00,
        5.00,
        40.00,
        TRUE
    );

    -- 5. Insert Default Payment Settings
    INSERT INTO public.payment_settings (
        id, bkash_enabled, bkash_number, nagad_enabled, nagad_number, rocket_enabled, rocket_number, bank_enabled, bank_name, bank_account_no, bank_routing
    ) VALUES (
        1, TRUE, '01737-321998 (Manager Russell)', TRUE, '01913-858775 (Raju - Block B Owner)', TRUE, '01737-321998-0 (Manager)', TRUE, 'Islami Bank Bangladesh Ltd (Rajshahi Branch)', '2050 3219 9801 8587', 'IBBLBDRJ050'
    ) ON CONFLICT (id) DO NOTHING;

    -- 6. Initial Audit Log
    INSERT INTO public.audit_logs (action, entity, entity_id, performed_by, user_role, details)
    VALUES ('INITIAL_MIGRATION', 'system', 'mbd-apartment-v1', 'System Architect', 'system', 'Completed initial setup and seed data for Ma Babar Doa Apartment Complex, Rajshahi');
END $$;
