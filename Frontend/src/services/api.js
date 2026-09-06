/**
 * MediKiosk Centralized API Service
 * Interacts with backend API endpoints at VITE_API_BASE_URL (http://localhost:5001)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5001";

/**
 * Generic Fetch Wrapper with JSON and Auth Authorization Header
 */
async function apiRequest(endpoint, method = "GET", body = null, token = null) {
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(data.message || `Request failed with status ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (err) {
        if (err.status) {
            throw err;
        }
        throw new Error(err.message || "Network error. Unable to connect to backend server.");
    }
}

// ==================================================
// PATIENT AUTHENTICATION API CALLS
// ==================================================

/** Patient Phone Login Step 1 */
export async function loginPatientPhone(phone) {
    return apiRequest("/api/auth/patient/login/phone", "POST", { phone });
}

/** Patient Phone Login Step 2 */
export async function verifyPatientPhoneLogin(verificationId, otp) {
    return apiRequest("/api/auth/patient/login/phone/verify", "POST", { verificationId, otp });
}

/** Patient Phone Registration Step 1 */
export async function registerPatientPhone(patientData) {
    return apiRequest("/api/auth/patient/register/phone", "POST", patientData);
}

/** Patient Phone Registration Step 2 */
export async function verifyPatientPhoneRegistration(verificationId, otp) {
    return apiRequest("/api/auth/patient/verify-phone", "POST", { verificationId, otp });
}

/** Patient Email Login Step 1 */
export async function loginPatientEmail(email) {
    return apiRequest("/api/auth/patient/login/email", "POST", { email });
}

/** Patient Email Login Step 2 */
export async function verifyPatientEmailLogin(verificationId, otp) {
    return apiRequest("/api/auth/patient/login/email/verify", "POST", { verificationId, otp });
}

/** Patient Email Registration Step 1 */
export async function registerPatientEmail(patientData) {
    return apiRequest("/api/auth/patient/register/email", "POST", patientData);
}

/** Patient Email Registration Step 2 */
export async function verifyPatientEmailRegistration(verificationId, otp) {
    return apiRequest("/api/auth/patient/verify-email", "POST", { verificationId, otp });
}

/** Patient Google OAuth Exchange Code */
export async function exchangeGoogleCode(code) {
    return apiRequest("/api/auth/patient/google/exchange", "POST", { code });
}

// ==================================================
// DOCTOR AUTHENTICATION API CALLS
// ==================================================

/** Doctor Registration via Email + Password */
export async function registerDoctor(doctorData) {
    return apiRequest("/api/auth/doctor/register", "POST", doctorData);
}

/** Doctor Email + Password Login */
export async function loginDoctor(email, password) {
    return apiRequest("/api/auth/doctor/login", "POST", { email, password });
}

// ==================================================
// SHARED AUTH USER PROFILE API CALL
// ==================================================

/** Fetch Authenticated User Profile */
export async function fetchMe(token) {
    return apiRequest("/api/auth/me", "GET", null, token);
}

// ==================================================
// DOCTOR STAFF MANAGEMENT API CALLS
// ==================================================

/** Create a staff account (admin, receptionist, nurse) — Doctor only */
export async function createStaffAccount(staffData, token) {
    return apiRequest("/api/doctor/staff/create", "POST", staffData, token);
}

/** Get all staff under a doctor */
export async function getStaffList(token) {
    return apiRequest("/api/doctor/staff", "GET", null, token);
}

/** Delete a staff account */
export async function deleteStaffAccount(staffId, token) {
    return apiRequest(`/api/doctor/staff/${staffId}`, "DELETE", null, token);
}
