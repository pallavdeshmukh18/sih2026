-- Development example. Replace the UUID with an existing patient_profiles.user_id.
WITH policy AS (
  INSERT INTO insurance_policies (
    patient_id, insurer_name, plan_name, policy_number, policy_start_date,
    policy_end_date, sum_insured, remaining_sum_insured, deductible,
    copay_percent, room_rent_limit_per_day, icu_limit_per_day
  ) VALUES (
    'REPLACE-WITH-PATIENT-UUID', 'AarogyaSure Health Insurance',
    'AarogyaSure Gold', 'TEST-HI-2026-001245', CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 year', 500000, 420000, 10000, 10, 5000, 10000
  ) RETURNING id
)
INSERT INTO insurance_procedure_limits (policy_id, procedure_name, max_eligible_amount)
SELECT id, 'Knee Replacement', 300000 FROM policy;

-- Expected estimate for a ₹320,000 bill, ₹7,000 room for 5 days and
-- ₹15,000 non-payables: insurer ₹238,500; patient ₹81,500.
