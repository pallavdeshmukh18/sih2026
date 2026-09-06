import React, { useState, useEffect } from "react";

import StatCard from "../components/StatCard";
import ChartPlaceholder from "../components/ChartPlaceholder";
import CalendarPlaceholder from "../components/CalendarPlaceholder";
import PatientTable from "../components/PatientTable";
import { useAuth } from "../context/AuthContext";
import { User, Stethoscope, Users, Bed } from "lucide-react";
import { motion } from "framer-motion";

const DoctorDashboard = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", opacity: 0.7 }}>
                <div className="skeleton skeleton-title"></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: "24px" }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "24px" }}>
                    <StatCard 
                        title="Visitors" 
                        icon={User} 
                        value="4,592" 
                        trend={15.9} 
                        subtitle="Stay informed with real-time data to enhance patient care and visitor management."
                    />
                    <StatCard 
                        title="Doctors" 
                        icon={Stethoscope} 
                        value="260" 
                        trend={15.9}
                        bgLight={true}
                        iconBg="rgba(255,255,255,0.5)"
                        subtitle="Stay updated with essential details to streamline medical support and management."
                    />
                    <StatCard 
                        title="Patient" 
                        icon={Users} 
                        value="540" 
                        trend={15.9}
                        subtitle="Keep track of patient information at a glance, with easy access to key details for personalized care."
                    />
                    <StatCard 
                        title="Total Bed" 
                        icon={Bed} 
                        value="1205" 
                        highlight={
                            <>
                                <div>
                                    <div style={{fontSize: '16px', fontWeight: 'bold', color: 'var(--color-dark)'}}>110 Bed</div>
                                    <div style={{fontSize: '11px', color: 'var(--color-text-muted)'}}>Private Bed</div>
                                </div>
                                <div>
                                    <div style={{fontSize: '16px', fontWeight: 'bold', color: 'var(--color-dark)'}}>215 Bed</div>
                                    <div style={{fontSize: '11px', color: 'var(--color-text-muted)'}}>General Bed</div>
                                </div>
                            </>
                        }
                    />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
                    <div style={{ minHeight: "360px" }}>
                        <ChartPlaceholder />
                    </div>
                    <div>
                        <CalendarPlaceholder />
                    </div>
                </div>
                
                <div>
                    <PatientTable />
                </div>
            </motion.div>
        </div>
    );
};

export default DoctorDashboard;
