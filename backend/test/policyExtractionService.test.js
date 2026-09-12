const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePolicyText } = require("../src/services/policyExtractionService");

test("extracts identity fields without consuming adjacent labels or disclaimer text", () => {
    const text = `Health Insurance Policy Schedule
      Insurer Name AarogyaSure Health Insurance
      Plan Name AarogyaSure Gold Plus
      Policy Type Individual
      Policy Start Date 01/04/2026
      Policy End Date 31/03/2027
      Policy Number TEST-HI-2026-009871
      Member ID AS-9981
      Sum Insured ₹ 500000 Remaining Sum Insured ₹ 420000
      Final approval is determined by the insurer or TPA. Non-payable items apply.`;
    const result = parsePolicyText(text);
    assert.equal(result.insurer_name, "AarogyaSure Health Insurance");
    assert.equal(result.plan_name, "AarogyaSure Gold Plus");
    assert.equal(result.policy_type, "Individual");
    assert.equal(result.policy_number, "TEST-HI-2026-009871");
    assert.equal(result.member_id, "AS-9981");
    assert.equal(result.policy_start_date, "2026-04-01");
    assert.equal(result.policy_end_date, "2027-03-31");
});

test("does not treat insurer disclaimer language as insurer name", () => {
    assert.equal(parsePolicyText("Final payment is decided by insurer or TPA. Non payable items apply.").insurer_name, "");
});

test("extracts insurer from a standalone policy title when no insurer field exists", () => {
    const text = `AarogyaSure Health Insurance
      FICTIONAL SAMPLE POLICY - CREATED ONLY FOR MEDIKIOSK CLAIM ESTIMATOR TESTING
      Policy Schedule
      Policy Number TEST-HI-2026-009871
      Plan Name AarogyaSure Gold Plus
      Policy Type Individual
      Network Hospital Required for Cashless Yes`;
    const result = parsePolicyText(text);
    assert.equal(result.insurer_name, "AarogyaSure Health Insurance");
    assert.equal(result.plan_name, "AarogyaSure Gold Plus");
    assert.equal(result.network_required, true);
});

test("extracts the sample policy table values without field spillover", () => {
    const text = `AarogyaSure Health Insurance FICTIONAL SAMPLE POLICY Policy Schedule
      Policy Number TEST-HI-2026-009871 Member ID AS-MEMBER-77821 Policyholder Aarav Mehta
      Plan Name AarogyaSure Gold Plus Policy Type Individual Policy Start Date 01 April 2026
      Policy End Date 31 March 2027 Annual Sum Insured INR 5,00,000 Remaining Sum Insured INR 4,20,000
      Network Hospital Required for Cashless Yes Deductible INR 10,000 per policy year
      Co-pay 10% of admissible amount after deductible Room Rent Limit INR 5,000 per day ICU Rent Limit INR 10,000 per day
      Knee Replacement INR 3,00,000 per knee 12 months unless due to accident Initial waiting period: 30 days`;
    const result = parsePolicyText(text);
    assert.equal(result.member_id, "AS-MEMBER-77821");
    assert.equal(result.policy_start_date, "2026-04-01");
    assert.equal(result.policy_end_date, "2027-03-31");
    assert.equal(result.deductible, 10000);
    assert.equal(result.copay_percent, 10);
    assert.equal(result.waiting_period_general_days, 30);
    assert.deepEqual(result.procedure_limits[0], { procedure_name: "Knee Replacement", procedure_code: null, max_eligible_amount: 300000, waiting_period_days: 360, notes: "Limit applies per knee." });
});
