/**
 * MediKiosk Centralized API Service
 * Interacts with backend API endpoints at VITE_API_BASE_URL (http://localhost:5001)
 */

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
        ? "https://sih2026-backend-viab.onrender.com"
        : "http://127.0.0.1:5001");

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
        throw new Error(err.message || "Network error. Unable to connect to backend server.", { cause: err });
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
// RECEPTIONIST FRONT-DESK API CALLS
// ==================================================

/** Fetch Receptionist Live Dashboard Stats */
export async function fetchReceptionistStats(token) {
    return apiRequest("/api/receptionist/stats", "GET", null, token);
}

/** Fetch Hospital-wide Appointments for Front-Desk */
export async function fetchReceptionistAppointments(params = {}, token) {
    const query = new URLSearchParams();
    if (params.date) query.append("date", params.date);
    if (params.doctorId) query.append("doctorId", params.doctorId);
    if (params.status) query.append("status", params.status);
    if (params.search) query.append("search", params.search);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/receptionist/appointments${queryString}`, "GET", null, token);
}

/** Check-in Patient for Appointment */
export async function checkInAppointment(appointmentId, token) {
    return apiRequest(`/api/receptionist/check-in/${appointmentId}`, "POST", null, token);
}

/** Register Walk-In Patient and Optionally Book Appointment */
export async function registerWalkInPatient(patientData, token) {
    return apiRequest("/api/receptionist/patients/walk-in", "POST", patientData, token);
}

/** Fetch Patients Directory for Front-Desk */
export async function fetchReceptionistPatients(params = {}, token) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.limit) query.append("limit", params.limit);
    if (params.offset) query.append("offset", params.offset);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/receptionist/patients${queryString}`, "GET", null, token);
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

/** Fetch Doctor's Live Patient & Triage Queue */
export async function fetchDoctorQueue(token) {
    return apiRequest("/api/doctor/queue", "GET", null, token);
}

/** Fetch Unified Patient History for Doctor Consultation */
export async function fetchPatientUnifiedHistory(patientId, token) {
    return apiRequest(`/api/doctor/patient/${patientId}/unified-history`, "GET", null, token);
}

/** Confirm & Record Doctor Consultation Diagnosis & Notes */
export async function confirmConsultation(appointmentId, consultationData, token) {
    return apiRequest(`/api/doctor/consultations/${appointmentId}/confirm`, "POST", consultationData, token);
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
// WHATSAPP ACCOUNT LINKING API CALLS
// ==================================================

/** Generate WhatsApp Linking Token for Authenticated Patient */
export async function generateWhatsAppToken(token) {
    return apiRequest("/api/auth/whatsapp/token", "POST", null, token);
}

/** Get WhatsApp Account Linking Status */
export async function getWhatsAppMe(token) {
    return apiRequest("/api/auth/whatsapp/me", "GET", null, token);
}

/** Unlink WhatsApp Account */
export async function unlinkWhatsApp(token) {
    return apiRequest("/api/auth/whatsapp/unlink", "POST", null, token);
}


// ==================================================
// PATIENT APPOINTMENTS & DOCTOR DIRECTORY API CALLS
// ==================================================

/** Upload Profile Photo (Multipart / FormData) */
export async function uploadProfilePhoto(formData, token) {
    const headers = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/users/profile-photo`, {
        method: "POST",
        headers,
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `Profile photo upload failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

/** Fetch Public Verified Doctor Directory */
export async function fetchPublicDoctors(token) {
    return apiRequest("/api/doctor/directory", "GET", null, token);
}

/** Fetch Available Appointment Slots for a Doctor on a Date */
export async function getAvailableAppointmentSlots(doctorId, date, token) {
    return apiRequest(`/api/appointments/available?doctorId=${doctorId}&date=${date}`, "GET", null, token);
}

/** Create / Book a New Appointment */
export async function createAppointment(appointmentData, token) {
    return apiRequest("/api/appointments", "POST", appointmentData, token);
}

/** Get Authenticated Patient's Appointments */
export async function getPatientAppointments(token) {
    return apiRequest("/api/appointments/patient", "GET", null, token);
}

/** Get Authenticated Doctor's Queue / Appointments */
export async function getDoctorQueue(token) {
    return apiRequest("/api/doctor/queue", "GET", null, token);
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

export const createInsurancePolicy = (data, token) => apiRequest("/api/insurance/policies", "POST", data, token);
export const getInsurancePolicies = token => apiRequest("/api/insurance/policies", "GET", null, token);
export const getInsurancePolicy = (id, token) => apiRequest(`/api/insurance/policies/${id}`, "GET", null, token);
export const updateInsurancePolicy = (id, data, token) => apiRequest(`/api/insurance/policies/${id}`, "PATCH", data, token);
export const deleteInsurancePolicy = (id, token) => apiRequest(`/api/insurance/policies/${id}`, "DELETE", null, token);
export const addInsuranceProcedureLimit = (id, data, token) => apiRequest(`/api/insurance/policies/${id}/procedure-limits`, "POST", data, token);
export const addInsuranceExclusion = (id, data, token) => apiRequest(`/api/insurance/policies/${id}/exclusions`, "POST", data, token);
export const extractInsurancePolicy = (documentId, token) => apiRequest(`/api/insurance/documents/${documentId}/extract`, "POST", null, token);
export const createClaimEstimate = (data, token) => apiRequest("/api/insurance/claim-estimates", "POST", data, token);
export const getClaimEstimates = token => apiRequest("/api/insurance/claim-estimates", "GET", null, token);
export const getClaimEstimate = (id, token) => apiRequest(`/api/insurance/claim-estimates/${id}`, "GET", null, token);

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

/** Submit Voice Turn in Clinical Session (Multipart / FormData) */
export async function sendClinicalVoiceTurn(sessionId, audioBlob, filename = "voice.webm", token = null) {
    const formData = new FormData();
    formData.append("file", audioBlob, filename);

    const headers = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/voice-turn`, {
        method: "POST",
        headers,
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `Voice turn failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

/** Fetch Clinical Session Details */
export async function getClinicalSession(sessionId, token) {
    return apiRequest(`/api/sessions/${sessionId}`, "GET", null, token);
}

/** Finalize Clinical Intake Session */
export async function finalizeClinicalSession(sessionId, documentData = null, token) {
    return apiRequest(`/api/sessions/${sessionId}/finalize`, "POST", { documentData }, token);
}

/** Delete Clinical Intake Session */
export async function deleteClinicalSession(sessionId, token) {
    return apiRequest(`/api/sessions/${sessionId}`, "DELETE", null, token);
}

/** Cancel / Delete Appointment */
export async function cancelAppointment(appointmentId, token) {
    return apiRequest(`/api/appointments/${appointmentId}`, "DELETE", null, token);
}

/** Get Single Appointment Details by ID */
export async function getAppointmentById(appointmentId, token) {
    return apiRequest(`/api/appointments/${appointmentId}`, "GET", null, token);
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

// ==================================================
// PATIENT ↔ DOCTOR QR PAIRING & CONSENT API CALLS
// ==================================================

/** Patient: Generate Short-Lived QR Pairing Token */
export async function generatePatientQrToken(token) {
    return apiRequest("/api/patient/medical-id/qr", "POST", null, token);
}

/** Patient: Get Connected Care Providers */
export async function getConnectedDoctors(token) {
    return apiRequest("/api/patient/connected-doctors", "GET", null, token);
}

/** Patient: Revoke Doctor Access */
export async function revokeDoctorAccess(relationshipId, token) {
    return apiRequest(`/api/patient/connected-doctors/${relationshipId}`, "DELETE", null, token);
}

/** Doctor: Redeem / Preview QR Pairing Token */
export async function previewPatientPairing(payload, token) {
    return apiRequest("/api/doctor/patients/pair/preview", "POST", payload, token);
}

/** Doctor: Confirm Patient Doctor Pairing */
export async function confirmPatientPairing(payload, token) {
    return apiRequest("/api/doctor/patients/pair/confirm", "POST", payload, token);
}

/** Doctor: Get Connected Patients List */
export async function getDoctorPatients(token) {
    return apiRequest("/api/doctor/patients", "GET", null, token);
}

/** Doctor: Revoke Patient Connection */
export async function revokePatientConnection(patientId, token) {
    return apiRequest(`/api/doctor/patients/${patientId}`, "DELETE", null, token);
}

// ==================================================
// TELECONSULTATION (VIDEO/VOICE CALLS & MESSAGING) API CALLS
// ==================================================

/** Fetch Agora Public Config */
export async function getAgoraConfig(token) {
    return apiRequest("/api/teleconsult/config", "GET", null, token);
}

/** Patient Request Teleconsultation Call */
export async function requestTeleconsult(callData, token) {
    return apiRequest("/api/teleconsult/request", "POST", callData, token);
}

/** Get Teleconsultation Sessions for Authenticated User */
export async function fetchTeleconsultSessions(token) {
    return apiRequest("/api/teleconsult/sessions", "GET", null, token);
}

/** Doctor Respond to Teleconsultation Request (Approve / Reject) */
export async function respondToTeleconsult(sessionId, action, doctorNotes = "", token) {
    return apiRequest(`/api/teleconsult/${sessionId}/respond`, "PATCH", { action, doctorNotes }, token);
}

/** Join Teleconsultation Call (Generates Agora RTC Token) */
export async function joinTeleconsultSession(sessionId, token) {
    return apiRequest(`/api/teleconsult/${sessionId}/join`, "POST", null, token);
}

/** End Teleconsultation Call */
export async function endTeleconsultSession(sessionId, endData = {}, token) {
    return apiRequest(`/api/teleconsult/${sessionId}/end`, "POST", endData, token);
}

/** Fetch Consultation Thread Chat Messages */
export async function fetchTeleconsultMessages(sessionId, token) {
    return apiRequest(`/api/teleconsult/${sessionId}/messages`, "GET", null, token);
}

/** Send Message in Consultation Thread */
export async function sendTeleconsultMessage(sessionId, message, messageType = "text", token) {
    return apiRequest(`/api/teleconsult/${sessionId}/messages`, "POST", { message, messageType }, token);
}
