import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ role, children }) => {
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

    if (role && user?.role !== role) {
        // Safe redirect to user's authorized role dashboard
        if (user?.role === "patient") {
            return <Navigate to="/patient/dashboard" replace />;
        } else if (user?.role === "doctor") {
            return <Navigate to="/doctor/dashboard" replace />;
        } else {
            return <Navigate to="/auth" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
