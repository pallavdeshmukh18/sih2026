import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ role, allowIncompleteOnboarding = false, children }) => {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                fontFamily: "var(--font-sans)",
                color: "var(--color-teal)",
                fontSize: "18px",
                fontWeight: "600"
            }}>
                Loading MediKiosk session...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    const isRoleAllowed = !role || (Array.isArray(role) ? role.includes(user?.role) : user?.role === role);

    if (!isRoleAllowed) {
        // Safe redirect to user's authorized role dashboard
        if (user?.role === "patient") {
            return <Navigate to="/patient/dashboard" replace />;
        } else if (user?.role === "doctor") {
            return <Navigate to="/doctor/dashboard" replace />;
        } else if (["receptionist", "admin", "nurse"].includes(user?.role)) {
            return <Navigate to="/receptionist/dashboard" replace />;
        } else {
            return <Navigate to="/auth" replace />;
        }
    }

    // Patient Onboarding completion check
    if (user?.role === "patient") {
        const isCompleted = user?.onboarding?.completed || !!localStorage.getItem(`medikiosk_patient_preferences_${user?.id}`);
        
        // If onboarding incomplete and route does NOT allow incomplete onboarding -> redirect to onboarding
        if (!isCompleted && !allowIncompleteOnboarding) {
            return <Navigate to="/patient/onboarding" replace />;
        }

        // If onboarding complete and patient visits onboarding route -> redirect to dashboard
        if (isCompleted && allowIncompleteOnboarding) {
            return <Navigate to="/patient/dashboard" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
