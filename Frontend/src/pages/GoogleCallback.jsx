import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { exchangeGoogleCode } from "../services/api";
import styles from "./GoogleCallback.module.css";

function GoogleCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login, refreshUser } = useAuth();
    const [error, setError] = useState(null);
    const hasAttempted = useRef(false);

    useEffect(() => {
        if (hasAttempted.current) return;
        hasAttempted.current = true;

        const code = searchParams.get("code");

        if (!code) {
            setError("No authorization code provided in callback URL.");
            return;
        }

        async function processCode() {
            try {
                const res = await exchangeGoogleCode(code);
                // Save JWT and user in AuthContext
                login(res.token, res.user);
                // Clean up URL parameter
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Fetch latest user profile from DB to get onboarding completion status
                const fullUser = await refreshUser(res.token);
                const isCompleted = fullUser?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${res.user.id}`);
                navigate(isCompleted ? "/patient/dashboard" : "/patient/onboarding", { replace: true });
            } catch (err) {
                // Clean up URL parameter even on failure
                window.history.replaceState({}, document.title, window.location.pathname);
                setError(err.message || "Failed to complete Google authentication.");
            }
        }

        processCode();
    }, [searchParams, login, refreshUser, navigate]);

    return (
        <main className={styles.page}>
            <div className={styles.glow} aria-hidden="true" />
            <a className={styles.brand} href="/" aria-label="MediKiosk home">
                <span className={styles.mark} aria-hidden="true"><i /><i /><i /></span>
                <span><strong>MediKiosk<span>.</span></strong><small>Your Health. In Your Hands.</small></span>
            </a>

            <section className={`${styles.card} ${error ? styles.errorCard : ""}`} aria-live="polite">
                {error ? (
                    <div className={styles.content}>
                        <div className={`${styles.iconWrap} ${styles.errorIcon}`}><CircleAlert /></div>
                        <span className={styles.eyebrow}>Unable to sign in</span>
                        <h1>Google verification failed</h1>
                        <p>{error}</p>
                        <button
                            type="button"
                            className={styles.action}
                            onClick={() => navigate("/auth", { replace: true })}
                        >
                            <ArrowLeft /> Return to sign in
                        </button>
                    </div>
                ) : (
                    <div className={styles.content}>
                        <div className={styles.iconWrap}>
                            <LoaderCircle className={styles.spinner} />
                            <span className={styles.googleDot}>G</span>
                        </div>
                        <span className={styles.eyebrow}>Secure authentication</span>
                        <h1>Signing you in</h1>
                        <p>We’re securely verifying your Google account. This will only take a moment.</p>
                        <div className={styles.progress} aria-label="Verification in progress"><span /></div>
                        <div className={styles.security}><ShieldCheck /> Your connection is private and protected</div>
                    </div>
                )}
            </section>

            <p className={styles.footer}>One secure account for your complete health journey.</p>
        </main>
    );
}

export default GoogleCallback;
