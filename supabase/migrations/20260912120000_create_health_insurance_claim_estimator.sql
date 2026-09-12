BEGIN;

CREATE TABLE insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(user_id) ON DELETE RESTRICT,
    insurer_name TEXT NOT NULL CHECK (length(trim(insurer_name)) > 0),
    policy_number TEXT,
    member_id TEXT,
    plan_name TEXT,
    policy_type TEXT,
    policy_start_date DATE,
    policy_end_date DATE,
    sum_insured NUMERIC(12,2),
    remaining_sum_insured NUMERIC(12,2),
    deductible NUMERIC(12,2) NOT NULL DEFAULT 0,
    copay_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    room_rent_limit_per_day NUMERIC(12,2),
    icu_limit_per_day NUMERIC(12,2),
    pre_hospitalization_days INTEGER,
    post_hospitalization_days INTEGER,
    network_required BOOLEAN NOT NULL DEFAULT FALSE,
    waiting_period_general_days INTEGER,
    waiting_period_preexisting_days INTEGER,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_insurance_policy_dates CHECK (policy_end_date IS NULL OR policy_start_date IS NULL OR policy_end_date >= policy_start_date),
    CONSTRAINT chk_insurance_policy_money CHECK (
        (sum_insured IS NULL OR sum_insured >= 0) AND
        (remaining_sum_insured IS NULL OR remaining_sum_insured >= 0) AND deductible >= 0 AND
        (room_rent_limit_per_day IS NULL OR room_rent_limit_per_day >= 0) AND
        (icu_limit_per_day IS NULL OR icu_limit_per_day >= 0)
    ),
    CONSTRAINT chk_insurance_policy_copay CHECK (copay_percent BETWEEN 0 AND 100),
    CONSTRAINT chk_insurance_policy_days CHECK (
        (pre_hospitalization_days IS NULL OR pre_hospitalization_days >= 0) AND
        (post_hospitalization_days IS NULL OR post_hospitalization_days >= 0) AND
        (waiting_period_general_days IS NULL OR waiting_period_general_days >= 0) AND
        (waiting_period_preexisting_days IS NULL OR waiting_period_preexisting_days >= 0)
    )
);
CREATE INDEX idx_insurance_policies_patient ON insurance_policies(patient_id);
CREATE INDEX idx_insurance_policies_number ON insurance_policies(policy_number);
CREATE INDEX idx_insurance_policies_end_date ON insurance_policies(policy_end_date);
CREATE TRIGGER trg_insurance_policies_updated_at BEFORE UPDATE ON insurance_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE insurance_procedure_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    procedure_name TEXT NOT NULL CHECK (length(trim(procedure_name)) > 0),
    procedure_code TEXT,
    max_eligible_amount NUMERIC(12,2),
    waiting_period_days INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_procedure_limit_values CHECK ((max_eligible_amount IS NULL OR max_eligible_amount >= 0) AND waiting_period_days >= 0)
);
CREATE INDEX idx_insurance_procedure_policy ON insurance_procedure_limits(policy_id);
CREATE INDEX idx_insurance_procedure_name ON insurance_procedure_limits(procedure_name);

CREATE TABLE insurance_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    exclusion_name TEXT NOT NULL CHECK (length(trim(exclusion_name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_insurance_exclusions_policy ON insurance_exclusions(policy_id);

CREATE TABLE claim_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(user_id) ON DELETE RESTRICT,
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
    treatment_name TEXT NOT NULL CHECK (length(trim(treatment_name)) > 0),
    procedure_code TEXT,
    hospital_name TEXT,
    network_hospital BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_bill NUMERIC(12,2) NOT NULL,
    room_rent_per_day NUMERIC(12,2),
    room_days INTEGER NOT NULL DEFAULT 0,
    icu_rent_per_day NUMERIC(12,2),
    icu_days INTEGER NOT NULL DEFAULT 0,
    non_payable_items NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_excluded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    base_eligible_amount NUMERIC(12,2) NOT NULL,
    procedure_limit_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
    room_rent_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    icu_rent_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    deductible_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
    copay_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
    exclusions_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_estimated_claim NUMERIC(12,2) NOT NULL,
    estimated_patient_out_of_pocket NUMERIC(12,2) NOT NULL,
    breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence TEXT NOT NULL DEFAULT 'moderate' CHECK (confidence IN ('low', 'moderate', 'high')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_claim_estimate_days CHECK (room_days >= 0 AND icu_days >= 0),
    CONSTRAINT chk_claim_estimate_money CHECK (
        estimated_bill > 0 AND (room_rent_per_day IS NULL OR room_rent_per_day >= 0) AND
        (icu_rent_per_day IS NULL OR icu_rent_per_day >= 0) AND non_payable_items >= 0 AND other_excluded_amount >= 0 AND
        base_eligible_amount >= 0 AND procedure_limit_applied >= 0 AND room_rent_deduction >= 0 AND
        icu_rent_deduction >= 0 AND deductible_applied >= 0 AND copay_applied >= 0 AND exclusions_applied >= 0 AND
        final_estimated_claim >= 0 AND estimated_patient_out_of_pocket >= 0
    )
);
CREATE INDEX idx_claim_estimates_patient ON claim_estimates(patient_id);
CREATE INDEX idx_claim_estimates_policy ON claim_estimates(policy_id);
CREATE INDEX idx_claim_estimates_created_desc ON claim_estimates(created_at DESC);

-- MediKiosk uses application JWTs through the trusted backend, not Supabase Auth JWTs.
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_procedure_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_estimates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON insurance_policies, insurance_procedure_limits, insurance_exclusions, claim_estimates FROM anon, authenticated;

COMMIT;
