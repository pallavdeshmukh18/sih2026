BEGIN;

-- Insurance access is deliberately separate from appointment/document access.
-- A patient grants one staff member access to one structured policy at a time.
CREATE TABLE insurance_policy_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    grantee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES patient_profiles(user_id) ON DELETE RESTRICT,
    access_type TEXT NOT NULL DEFAULT 'view' CHECK (access_type = 'view'),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT chk_insurance_access_expiry CHECK (expires_at IS NULL OR expires_at > granted_at)
);

CREATE INDEX idx_insurance_policy_access_policy ON insurance_policy_access(policy_id);
CREATE INDEX idx_insurance_policy_access_grantee ON insurance_policy_access(grantee_user_id);
CREATE UNIQUE INDEX unq_insurance_policy_access_active
    ON insurance_policy_access(policy_id, grantee_user_id)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE insurance_policy_access IS
    'Explicit, revocable patient consent for a doctor or receptionist to view structured insurance policy terms.';

-- MediKiosk uses application JWTs through the trusted backend, not Supabase Auth JWTs.
ALTER TABLE insurance_policy_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON insurance_policy_access FROM anon, authenticated;

COMMIT;
