const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateClaim } = require("../src/services/claimEstimatorService");

const policy = overrides => ({ sum_insured: 500000, remaining_sum_insured: 500000, deductible: 0, copay_percent: 0, room_rent_limit_per_day: null, icu_limit_per_day: null, network_required: false, ...overrides });
const run = overrides => estimateClaim({ policy: policy(), estimatedBill: 100000, ...overrides });

test("basic estimate with no limits", () => assert.equal(run({}).finalEstimatedClaim, 100000));
test("remaining sum insured caps eligibility", () => { const r=run({policy:policy({remaining_sum_insured:60000})}); assert.equal(r.finalEstimatedClaim,60000); assert.equal(r.remainingSumInsuredImpact,40000); });
test("procedure sublimit caps eligibility", () => { const r=run({procedureLimit:{max_eligible_amount:70000}}); assert.equal(r.finalEstimatedClaim,70000); assert.equal(r.procedureLimitApplied,30000); });
test("room rent deducts excess only", () => { const r=run({policy:policy({room_rent_limit_per_day:5000}),roomRentPerDay:7000,roomDays:5}); assert.equal(r.roomRentDeduction,10000); assert.equal(r.finalEstimatedClaim,90000); });
test("deductible is applied", () => assert.equal(run({policy:policy({deductible:10000})}).finalEstimatedClaim,90000));
test("co-pay is applied after deductible", () => { const r=run({policy:policy({deductible:10000,copay_percent:10})}); assert.equal(r.copayApplied,9000); assert.equal(r.finalEstimatedClaim,81000); });
test("non-payable items are excluded", () => assert.equal(run({nonPayableItems:15000}).finalEstimatedClaim,85000));
test("combined AarogyaSure scenario has exact arithmetic", () => {
    const r=estimateClaim({policy:policy({remaining_sum_insured:420000,deductible:10000,copay_percent:10,room_rent_limit_per_day:5000,icu_limit_per_day:10000}),procedureLimit:{max_eligible_amount:300000,waiting_period_days:0},estimatedBill:320000,roomRentPerDay:7000,roomDays:5,nonPayableItems:15000});
    assert.deepEqual({base:r.baseEligibleAmount,procedure:r.procedureLimitApplied,room:r.roomRentDeduction,excluded:r.exclusionsApplied,deductible:r.deductibleApplied,copay:r.copayApplied,claim:r.finalEstimatedClaim,patient:r.estimatedPatientOutOfPocket},{base:300000,procedure:20000,room:10000,excluded:15000,deductible:10000,copay:26500,claim:238500,patient:81500});
});
test("zero and negative bills are rejected", () => { assert.throws(()=>run({estimatedBill:0}),/greater than zero/); assert.throws(()=>run({estimatedBill:-1}),/greater than zero/); });
test("expired policy warning is returned", () => { const r=run({policy:policy({policy_end_date:"2020-01-01"}),now:new Date("2026-09-12")}); assert.ok(r.warnings.includes("Policy appears expired.")); });
