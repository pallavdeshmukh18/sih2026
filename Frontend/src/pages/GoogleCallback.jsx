import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { exchangeGoogleCode } from "../services/api";
import styles from "./AuthPage.module.css";

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
    }, [searchParams, login, navigate]);

    return (
        <div className={styles.authContainer}>
            <div className={styles.bgBlobTopRight}></div>
            <div className={styles.bgBlobBottomLeft}></div>

            <div className={styles.authCard} style={{ maxWidth: "450px", textAlign: "center", padding: "2.5rem" }}>
                {error ? (
                    <div>
                        <div style={{ color: "#ef4444", fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
                            Authentication Error
                        </div>
                        <p style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "1.5rem" }}>{error}</p>
                        <button
                            type="button"
                            className={styles.submitBtn}
                            onClick={() => navigate("/auth", { replace: true })}
                        >
                            Return to Sign In
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ color: "#38bdf8", fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
                            Verifying Google Sign-In...
                        </div>
                        <p style={{ color: "rgba(255, 255, 255, 0.7)" }}>Please wait while we complete your authentication.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default GoogleCallback;
