import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./layouts/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import LandingPage from "./pages/LandingPage";
import SignupPage from "./pages/Signup/SignupPage";
import GoogleCallback from "./pages/GoogleCallback";
import DashboardLayout from "./layouts/dashboard/DashboardLayout";

// Core Patient Onboarding Page
import PatientOnboarding from "./pages/patient/PatientOnboarding";
import ClinicalAssessment from "./pages/patient/ClinicalAssessment";

// Original Core Pages
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import MedicalHistory from "./pages/patient/MedicalHistory";
import MedicalID from "./pages/patient/MedicalID";
import Appointments from "./pages/patient/Appointments";
import Documents from "./pages/patient/Documents";
import DoctorAppointments from "./pages/doctor/DoctorAppointments";
import PatientAccess from "./pages/doctor/PatientAccess";
import TeamManagement from "./pages/doctor/TeamManagement";
import ComingSoon from "./pages/ComingSoon";

// New Shared Pages
import Account from "./pages/shared/Account";
import DoctorDirectory from "./pages/shared/DoctorDirectory";
import Departments from "./pages/shared/Departments";
import PatientSchedule from "./pages/shared/PatientSchedule";
import BedManager from "./pages/shared/BedManager";
import Payment from "./pages/shared/Payment";
import Mail from "./pages/shared/Mail";

// Receptionist Pages
import ReceptionistDashboard from "./pages/ReceptionistDashboard";
import ReceptionistAppointments from "./pages/receptionist/ReceptionistAppointments";
import ReceptionistPatients from "./pages/receptionist/ReceptionistPatients";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#fff', color: '#111', borderRadius: '12px' } }} />
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<SignupPage />} />
          <Route path="/signup" element={<Navigate to="/auth" replace />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />

          {/* Dedicated Patient Onboarding Route */}
          <Route path="/patient/onboarding" element={<ProtectedRoute role="patient" allowIncompleteOnboarding={true}><PatientOnboarding /></ProtectedRoute>} />

          {/* Protected Patient Routes */}
          <Route path="/patient" element={<ProtectedRoute role="patient"><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<PatientDashboard />} />
            <Route path="assessment" element={<ClinicalAssessment />} />
            <Route path="medical-id" element={<MedicalID />} />
            <Route path="history" element={<MedicalHistory />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="documents" element={<Documents />} />
            
            {/* Patient Application Routes */}
            <Route path="account" element={<Account />} />
            <Route path="account/link-whatsapp" element={<Account />} />
            <Route path="account/whatsapp" element={<Account />} />
            <Route path="doctor" element={<DoctorDirectory />} />
            <Route path="schedule" element={<PatientSchedule />} />
            <Route path="payment" element={<Payment />} />
            <Route path="mail" element={<Mail />} />

            <Route path="" element={<Navigate to="/patient/dashboard" replace />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>

          {/* Protected Doctor Routes */}
          <Route path="/doctor" element={<ProtectedRoute role="doctor"><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DoctorDashboard />} />
            <Route path="appointments" element={<DoctorAppointments />} />
            <Route path="patients" element={<PatientAccess />} />
            <Route path="team" element={<TeamManagement />} />
            
            {/* Account & WhatsApp Linking Routes */}
            <Route path="account" element={<Account />} />
            <Route path="account/link-whatsapp" element={<Account />} />
            <Route path="account/whatsapp" element={<Account />} />
            <Route path="doctor" element={<DoctorDirectory />} />
            <Route path="departments" element={<Departments />} />
            <Route path="schedule" element={<DoctorAppointments />} />
            <Route path="bed" element={<BedManager />} />
            <Route path="payment" element={<Payment />} />
            <Route path="mail" element={<Mail />} />

            <Route path="" element={<Navigate to="/doctor/dashboard" replace />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>

          {/* Protected Receptionist / Front-Desk Routes */}
          <Route path="/receptionist" element={<ProtectedRoute role="receptionist"><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<ReceptionistDashboard />} />
            <Route path="appointments" element={<ReceptionistAppointments />} />
            <Route path="patients" element={<ReceptionistPatients />} />
            
            {/* Shared Hospital Modules */}
            <Route path="doctor" element={<DoctorDirectory />} />
            <Route path="departments" element={<Departments />} />
            <Route path="schedule" element={<ReceptionistAppointments />} />
            <Route path="bed" element={<BedManager />} />
            <Route path="payment" element={<Payment />} />
            <Route path="account" element={<Account />} />
            <Route path="mail" element={<Mail />} />

            <Route path="" element={<Navigate to="/receptionist/dashboard" replace />} />
            <Route path="*" element={<ComingSoon />} />
          </Route>

          {/* Top-Level Authenticated Route Aliases for Direct Account / WhatsApp Navigation */}
          <Route path="/account" element={<ProtectedRoute><Navigate to="/patient/account" replace /></ProtectedRoute>} />
          <Route path="/account/link-whatsapp" element={<ProtectedRoute><Navigate to="/patient/account/link-whatsapp" replace /></ProtectedRoute>} />
          <Route path="/account/whatsapp" element={<ProtectedRoute><Navigate to="/patient/account/whatsapp" replace /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
