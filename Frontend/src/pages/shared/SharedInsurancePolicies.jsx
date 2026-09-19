import { useCallback, useEffect, useState } from "react";
import { Building2, CalendarDays, CheckCircle2, ChevronRight, FileText, ShieldCheck, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { getSharedInsurancePolicies, getSharedInsurancePolicy } from "../../services/api";
import styles from "./SharedInsurancePolicies.module.css";

const money = value => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
const date = value => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function SharedInsurancePolicies() {
    const { token, user } = useAuth();
    const [policies, setPolicies] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

    const loadPolicies = useCallback(async () => {
        if (!token) return;
        try {
            const result = await getSharedInsurancePolicies(token);
            setPolicies(result.policies || []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadPolicies(); }, [loadPolicies]);

    const openPolicy = async id => {
        setDetailLoading(true);
        try {
            const result = await getSharedInsurancePolicy(id, token);
            setSelected(result.policy);
        } catch (error) {
            toast.error(error.message);
            loadPolicies();
        } finally {
            setDetailLoading(false);
        }
    };

    return <div className={`${styles.page} workspacePage`}>
        <header className={styles.hero}>
            <div><span><ShieldCheck size={15}/> Patient-consented access</span><h1>Insurance Policies</h1><p>View policy terms that patients have explicitly shared with you.</p></div>
            <FileText className={styles.heroIcon}/>
        </header>

        <section className={styles.card}>
            <div className={styles.cardTop}><div><h2>Shared with me</h2><p>Access ends immediately when the patient revokes consent.</p></div><span className={styles.role}>{user?.role === "doctor" ? "Doctor view" : "Receptionist view"}</span></div>
            {loading ? <div className={styles.empty}>Loading shared policies…</div> : policies.length === 0 ? <div className={styles.empty}><FileText/><h3>No policies shared yet</h3><p>A patient must grant access from their Health Insurance page.</p></div> : <div className={styles.grid}>
                {policies.map(policy => <article key={policy.id} className={styles.policy}>
                    <div className={styles.patient}><UserRound/><div><small>Patient</small><strong>{policy.patient_name}</strong></div></div>
                    <div className={styles.brand}><div><h3>{policy.insurer_name}</h3><p>{policy.plan_name || policy.policy_number || "Health insurance policy"}</p></div><ShieldCheck/></div>
                    <dl><div><dt>Policy number</dt><dd>{policy.policy_number || "—"}</dd></div><div><dt>Remaining cover</dt><dd>{money(policy.remaining_sum_insured)}</dd></div><div><dt>Valid until</dt><dd>{date(policy.policy_end_date)}</dd></div><div><dt>Policy rules</dt><dd>{policy.procedure_limit_count + policy.exclusion_count}</dd></div></dl>
                    <div className={styles.consent}><CheckCircle2/> Consent granted {date(policy.consent_granted_at)}{policy.consent_expires_at ? ` · expires ${date(policy.consent_expires_at)}` : ""}</div>
                    <button className={styles.viewButton} disabled={detailLoading} onClick={() => openPolicy(policy.id)}>View policy terms <ChevronRight/></button>
                </article>)}
            </div>}
        </section>

        {selected && <div className={styles.overlay} onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><div className={styles.modal}>
            <div className={styles.modalHead}><div><span>Shared by {selected.patient_name}</span><h2>{selected.insurer_name}</h2><p>{selected.plan_name || selected.policy_type || "Health insurance policy"}</p></div><button onClick={() => setSelected(null)} aria-label="Close"><X/></button></div>
            <div className={styles.notice}><ShieldCheck/><span>This read-only view is available through the patient’s active consent. It does not include the uploaded document or private claim estimates.</span></div>
            <section><h3><Building2/> Policy schedule</h3><dl className={styles.details}>{[
                ["Policy number", selected.policy_number || "—"], ["Member ID", selected.member_id || "—"],
                ["Policy type", selected.policy_type || "—"], ["Coverage period", `${date(selected.policy_start_date)} – ${date(selected.policy_end_date)}`],
                ["Sum insured", money(selected.sum_insured)], ["Remaining sum insured", money(selected.remaining_sum_insured)],
                ["Deductible", money(selected.deductible)], ["Co-pay", selected.copay_percent == null ? "—" : `${Number(selected.copay_percent)}%`],
                ["Room-rent limit / day", money(selected.room_rent_limit_per_day)], ["ICU limit / day", money(selected.icu_limit_per_day)],
                ["Network hospital required", selected.network_required ? "Yes" : "No"], ["General waiting period", selected.waiting_period_general_days == null ? "—" : `${selected.waiting_period_general_days} days`]
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
            <section><h3><CalendarDays/> Procedure limits</h3>{selected.procedure_limits?.length ? <div className={styles.rows}>{selected.procedure_limits.map(item => <div key={item.id}><span><strong>{item.procedure_name}</strong><small>{item.procedure_code || item.notes || "Procedure-specific rule"}</small></span><span>{money(item.max_eligible_amount)}<small>{item.waiting_period_days ? `${item.waiting_period_days} day wait` : "No recorded wait"}</small></span></div>)}</div> : <p className={styles.muted}>No procedure-specific limits recorded.</p>}</section>
            <section><h3><FileText/> Exclusions / non-payable items</h3>{selected.exclusions?.length ? <ul className={styles.exclusions}>{selected.exclusions.map(item => <li key={item.id}><strong>{item.exclusion_name}</strong>{item.description && <span>{item.description}</span>}</li>)}</ul> : <p className={styles.muted}>No exclusions recorded in the structured policy.</p>}</section>
        </div></div>}
    </div>;
}
