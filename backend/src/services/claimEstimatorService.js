const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function nonNegative(name, value, required = false) {
    if ((value === null || value === undefined || value === "") && !required) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || (required && parsed <= 0)) {
        throw Object.assign(new Error(`${name} must be ${required ? "greater than zero" : "zero or greater"}.`), { statusCode: 400 });
    }
    return parsed;
}

function confidenceFor(policy, procedureLimit) {
    if (policy.remaining_sum_insured == null || policy.sum_insured == null) return "low";
    const complete = policy.policy_start_date && policy.policy_end_date && policy.deductible != null &&
        policy.copay_percent != null && (policy.room_rent_limit_per_day != null || policy.icu_limit_per_day != null);
    return complete && procedureLimit ? "high" : "moderate";
}

function estimateClaim({ policy, procedureLimit = null, estimatedBill, roomRentPerDay = 0, roomDays = 0, icuRentPerDay = 0, icuDays = 0, nonPayableItems = 0, otherExcludedAmount = 0, networkHospital = false, now = new Date() }) {
    if (!policy) throw Object.assign(new Error("A policy is required."), { statusCode: 400 });
    const bill = nonNegative("Estimated bill", estimatedBill, true);
    const roomRate = nonNegative("Room rent per day", roomRentPerDay);
    const roomDayCount = nonNegative("Room days", roomDays);
    const icuRate = nonNegative("ICU rent per day", icuRentPerDay);
    const icuDayCount = nonNegative("ICU days", icuDays);
    const nonPayable = nonNegative("Non-payable items", nonPayableItems);
    const otherExcluded = nonNegative("Other excluded amount", otherExcludedAmount);
    if (!Number.isInteger(roomDayCount) || !Number.isInteger(icuDayCount)) throw Object.assign(new Error("Room and ICU days must be whole numbers."), { statusCode: 400 });

    const remaining = policy.remaining_sum_insured == null ? bill : nonNegative("Remaining sum insured", policy.remaining_sum_insured);
    const afterRemaining = Math.min(bill, remaining);
    const remainingSumInsuredImpact = roundMoney(bill - afterRemaining);
    const procedureMaximum = procedureLimit?.max_eligible_amount == null ? null : nonNegative("Procedure limit", procedureLimit.max_eligible_amount);
    const baseEligible = procedureMaximum == null ? afterRemaining : Math.min(afterRemaining, procedureMaximum);
    const procedureLimitApplied = roundMoney(afterRemaining - baseEligible);
    const exclusionsApplied = roundMoney(Math.min(baseEligible, nonPayable + otherExcluded));
    let eligible = Math.max(0, baseEligible - exclusionsApplied);

    const roomLimit = policy.room_rent_limit_per_day == null ? null : nonNegative("Room-rent limit", policy.room_rent_limit_per_day);
    const roomRentDeduction = roomLimit == null ? 0 : roundMoney(Math.min(eligible, Math.max(0, (roomRate - roomLimit) * roomDayCount)));
    eligible = Math.max(0, eligible - roomRentDeduction);
    const icuLimit = policy.icu_limit_per_day == null ? null : nonNegative("ICU limit", policy.icu_limit_per_day);
    const icuRentDeduction = icuLimit == null ? 0 : roundMoney(Math.min(eligible, Math.max(0, (icuRate - icuLimit) * icuDayCount)));
    eligible = Math.max(0, eligible - icuRentDeduction);

    const deductibleApplied = roundMoney(Math.min(eligible, nonNegative("Deductible", policy.deductible)));
    const afterDeductible = Math.max(0, eligible - deductibleApplied);
    const copayPercent = nonNegative("Co-pay", policy.copay_percent);
    if (copayPercent > 100) throw Object.assign(new Error("Co-pay must not exceed 100%."), { statusCode: 400 });
    const copayApplied = roundMoney(afterDeductible * copayPercent / 100);
    const finalEstimatedClaim = roundMoney(Math.max(0, afterDeductible - copayApplied));
    const estimatedPatientOutOfPocket = roundMoney(Math.max(0, bill - finalEstimatedClaim));

    const warnings = [];
    if (roomRentDeduction) warnings.push("Selected room rent exceeds policy room-rent limit.");
    if (icuRentDeduction) warnings.push("Selected ICU rent exceeds policy ICU limit.");
    if (procedureLimitApplied) warnings.push("Procedure sublimit reduced the eligible amount.");
    if (remainingSumInsuredImpact) warnings.push("Estimated bill exceeds remaining sum insured.");
    if (roomRentDeduction || icuRentDeduction) warnings.push("This estimate does not include insurer-specific proportional room-rent deductions.");
    if (policy.policy_end_date && new Date(policy.policy_end_date) < now) warnings.push("Policy appears expired.");
    const waitingDays = Number(procedureLimit?.waiting_period_days || policy.waiting_period_general_days || 0);
    if (waitingDays && policy.policy_start_date && now < new Date(new Date(policy.policy_start_date).getTime() + waitingDays * 86400000)) warnings.push("Treatment may be affected by a waiting period.");
    if (policy.network_required && !networkHospital) warnings.push("Non-network hospital may affect cashless eligibility.");
    warnings.push("Final approval depends on insurer/TPA adjudication.", "This tool does not verify medical necessity.");

    const assumptions = ["Only room/ICU rent above the daily limit is deducted; no proportional deduction is applied to the full bill."];
    if (policy.remaining_sum_insured == null) assumptions.push("Remaining sum insured was unavailable; the bill was used as the eligibility ceiling.");
    if (!procedureLimit) assumptions.push("No matching procedure sublimit was found.");
    if (roomLimit == null) assumptions.push("No room-rent limit was available.");
    if (icuLimit == null) assumptions.push("No ICU daily limit was available.");

    const breakdown = { hospitalBill: roundMoney(bill), afterRemainingSumInsured: roundMoney(afterRemaining), baseEligibleAmount: roundMoney(baseEligible), nonPayableItems: roundMoney(nonPayable), otherExcludedAmount: roundMoney(otherExcluded), exclusionsApplied, roomRentDeduction, icuRentDeduction, deductibleApplied, copayPercent: roundMoney(copayPercent), copayApplied, estimatedInsurerShare: finalEstimatedClaim, estimatedPatientShare: estimatedPatientOutOfPocket };
    return { hospitalBill: roundMoney(bill), baseEligibleAmount: roundMoney(baseEligible), remainingSumInsuredImpact, procedureLimitApplied, roomRentDeduction, icuRentDeduction, deductibleApplied, copayApplied, exclusionsApplied, finalEstimatedClaim, estimatedPatientOutOfPocket, remainingSumInsuredAfterClaim: roundMoney(Math.max(0, remaining - finalEstimatedClaim)), breakdown, warnings, assumptions, confidence: confidenceFor(policy, procedureLimit), disclaimer: "This is an indicative estimate only. Final claim approval, admissibility and reimbursement are determined by the insurer/TPA according to policy terms and submitted medical documents." };
}

module.exports = { estimateClaim, confidenceFor, nonNegative };
