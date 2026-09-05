import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import GoogleCallback from "./pages/GoogleCallback";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import PatientOverview from "./pages/patient/PatientOverview";
import MedicalHistory from "./pages/patient/MedicalHistory";
import Appointments from "./pages/patient/Appointments";
import Documents from "./pages/patient/Documents";
import DoctorOverview from "./pages/doctor/DoctorOverview";
import DoctorAppointments from "./pages/doctor/DoctorAppointments";
import PatientAccess from "./pages/doctor/PatientAccess";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ style: { background: '#fff', color: '#111', borderRadius: '12px' } }} />
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />

          {/* Protected Patient Routes */}
          <Route path="/patient" element={<ProtectedRoute role="patient"><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<PatientOverview />} />
            <Route path="history" element={<MedicalHistory />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="documents" element={<Documents />} />
            <Route path="" element={<Navigate to="/patient/dashboard" replace />} />
          </Route>

          {/* Protected Doctor Routes */}
          <Route path="/doctor" element={<ProtectedRoute role="doctor"><DashboardLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DoctorOverview />} />
            <Route path="appointments" element={<DoctorAppointments />} />
            <Route path="patients" element={<PatientAccess />} />
            <Route path="" element={<Navigate to="/doctor/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
