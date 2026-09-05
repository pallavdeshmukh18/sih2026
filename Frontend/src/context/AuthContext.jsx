import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchMe } from "../services/api";

const TOKEN_KEY = "medikiosk_token";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const restoreSession = async () => {
            const storedToken = localStorage.getItem(TOKEN_KEY);
            if (storedToken) {
                try {
                    const res = await fetchMe(storedToken);
                    if (res && res.user) {
                        setUser(res.user);
                        setToken(storedToken);
                    } else {
                        logout();
                    }
                } catch (err) {
                    console.error("Session restoration failed:", err.message);
                    logout();
                }
            }
            setIsLoading(false);
        };

        restoreSession();
    }, []);

    const login = (newToken, newUser) => {
        if (newToken) {
            localStorage.setItem(TOKEN_KEY, newToken);
            setToken(newToken);
        }
        if (newUser) {
            setUser(newUser);
        }
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
