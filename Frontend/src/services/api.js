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

/** Staff email + password login (receptionist, nurse, admin) */
export async function loginStaff(email, password) {
    return apiRequest("/api/auth/staff/login", "POST", { email, password });
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

// ==================================================
// PATIENT PROFILE & PHONE LINKING API CALLS
// ==================================================

/** Request OTP to Link / Change Phone Number */
export async function requestPhoneLink(phone, token) {
    return apiRequest("/api/auth/patient/link-phone/request", "POST", { phone }, token);
}

/** Verify OTP to Link / Change Phone Number */
export async function verifyPhoneLink(verificationId, otp, token) {
    return apiRequest("/api/auth/patient/link-phone/verify", "POST", { verificationId, otp }, token);
}

/** Update Patient Personal Profile & Onboarding Preferences */
export async function updatePatientProfile(profileData, token) {
    return apiRequest("/api/patient/profile", "PATCH", profileData, token);
}

/** Save / Update Patient Onboarding Preferences */
export async function savePatientOnboarding(onboardingData, token) {
    return apiRequest("/api/patient/profile/onboarding", "PATCH", onboardingData, token);
}

/** Get Patient Onboarding Preferences */
export async function getPatientOnboarding(token) {
    return apiRequest("/api/patient/profile/onboarding", "GET", null, token);
}

// ==================================================
// PATIENT APPOINTMENTS & DOCTOR DIRECTORY API CALLS
// ==================================================

/** Fetch Public Verified Doctor Directory */
export async function fetchPublicDoctors(token) {
    return apiRequest("/api/doctor/directory", "GET", null, token);
}

/** Create / Book a New Appointment */
export async function createAppointment(appointmentData, token) {
    return apiRequest("/api/appointments", "POST", appointmentData, token);
}

/** Get Authenticated Patient's Appointments */
export async function getPatientAppointments(token) {
    return apiRequest("/api/appointments/patient", "GET", null, token);
}

// ==================================================
// MEDICAL DOCUMENTS & OCR API CALLS
// ==================================================

/** Upload Medical Document (Multipart / FormData) */
export async function uploadMedicalDocument(formData, token) {
    const headers = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: "POST",
        headers,
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `Document upload failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

/** Get All Documents for a Patient */
export async function getPatientDocuments(patientId, token) {
    return apiRequest(`/api/documents/patient/${patientId}`, "GET", null, token);
}

/** Search Patient Medical Documents / Ask History Question */
export async function searchMedicalDocuments(query, token) {
    return apiRequest("/api/documents/search", "POST", { query }, token);
}

/** Ask Grounded Question About Specific Medical Record */
export async function askDocumentQuestion(documentId, question, language = "en", history = [], token) {
    return apiRequest(`/api/documents/${documentId}/ask`, "POST", { question, language, history }, token);
}

/** Delete Medical Document */
export async function deleteMedicalDocument(documentId, token) {
    return apiRequest(`/api/documents/${documentId}`, "DELETE", null, token);
}

// ==================================================
// CLINICAL ASSESSMENT API CALLS
// ==================================================

/** Start Clinical Assessment Session */
export async function startClinicalSession(sessionData, token) {
    return apiRequest("/api/sessions/start", "POST", sessionData, token);
}

/** Submit Text / Touch Turn in Clinical Session */
export async function sendClinicalTextTurn(sessionId, patientText, token) {
    return apiRequest(`/api/sessions/${sessionId}/text-turn`, "POST", { patientText }, token);
}

/** Fetch Clinical Session Details */
export async function getClinicalSession(sessionId, token) {
    return apiRequest(`/api/sessions/${sessionId}`, "GET", null, token);
}

/** Finalize Clinical Intake Session */
export async function finalizeClinicalSession(sessionId, documentData = null, token) {
    return apiRequest(`/api/sessions/${sessionId}/finalize`, "POST", { documentData }, token);
}

// ==================================================
// LONGITUDINAL MEDICAL HISTORY & DOCUMENT ACCESS
// ==================================================

/** Fetch Authenticated Patient Longitudinal Medical History */
export async function getPatientMedicalHistory(token) {
    return apiRequest("/api/patient/history", "GET", null, token);
}

/** Fetch Authenticated Patient Medical ID */
export async function getMedicalId(token) {
    return apiRequest("/api/patient/medical-id", "GET", null, token);
}

/** Get Document View / Download Signed URL */
export async function getDocumentDownloadUrl(documentId, token) {
    return apiRequest(`/api/documents/${documentId}/url`, "GET", null, token);
}

// ==================================================
// TEXT-TO-SPEECH (TTS) ACCESSIBILITY API CALL
// ==================================================

/** Synthesize Speech Audio via Sarvam TTS */
export async function synthesizeTTS(text, languageCode = "en", token = null) {
    return apiRequest("/api/tts/synthesize", "POST", { text, languageCode }, token);
}

export const synthesizeSpeech = synthesizeTTS;
