import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardPlaceholder } from "../features/auth/DashboardPlaceholder.jsx";
import { AdminLoginPage } from "../features/auth/AdminLoginPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { TotpVerificationPage } from "../features/auth/TotpVerificationPage.jsx";
import { PendingApprovalPage } from "../features/auth/PendingApprovalPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { VerificationPage } from "../features/auth/VerificationPage.jsx";
import { InitialPasswordChangePage } from "../features/auth/InitialPasswordChangePage.jsx";
import { authenticationExpiredEvent } from "../api/client.js";
import { authApi } from "../features/auth/auth-api.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  const isAdminPortal = window.location.hostname === "admin.kineticsports.io.vn" || import.meta.env.VITE_ADMIN_PORTAL === "true";
  const [view, setView] = useState("login");
  const [registration, setRegistration] = useState(null);
  const [session, setSession] = useState(null);
  const [firstLoginProfile, setFirstLoginProfile] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  useEffect(() => {
    const resetToLogin = () => {
      setSession(null);
      setFirstLoginProfile(false);
      setView("login");
    };
    window.addEventListener(authenticationExpiredEvent, resetToLogin);
    return () => window.removeEventListener(authenticationExpiredEvent, resetToLogin);
  }, []);
  useEffect(() => { document.title = isAdminPortal ? "Kinetic Admin" : "Kinetic Sports Center"; }, [isAdminPortal]);
  const onMfaRequired = (challenge) => { setMfaChallenge(challenge); setView("mfa"); };
  const loginPage = isAdminPortal
    ? <AdminLoginPage onLoggedIn={setSession} onMfaRequired={onMfaRequired} />
    : <LoginPage onLoggedIn={setSession} onMfaRequired={onMfaRequired} onRegister={() => setView("register")} />;
  const content = session?.user.mustChangePassword
    ? <InitialPasswordChangePage onCompleted={() => { setSession((current) => ({ ...current, user: { ...current.user, mustChangePassword: false } })); setFirstLoginProfile(true); }} />
    : session ? <DashboardPlaceholder initialView={firstLoginProfile ? "profile" : "dashboard"} session={session} onLogout={() => { setSession(null); setFirstLoginProfile(false); setView("login"); }} /> : {
    login: loginPage,
    register: isAdminPortal ? loginPage : <RegisterPage onLogin={() => setView("login")} onRegistered={(value) => { setRegistration(value); setView("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => setView("pending")} /> : loginPage,
    pending: <PendingApprovalPage onLogin={() => setView("login")} />,
    mfa: mfaChallenge ? <TotpVerificationPage challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); setView("login"); }} onCompleted={setSession} verifyLogin={isAdminPortal ? authApi.verifyAdminTotpLogin : authApi.verifyTotpLogin} portalName={isAdminPortal ? "cổng quản trị" : "hệ thống"} /> : loginPage,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      {content}
    </QueryClientProvider>
  );
}
