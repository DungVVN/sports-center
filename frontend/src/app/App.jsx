import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardPlaceholder } from "../features/auth/DashboardPlaceholder.jsx";
import { EmailOtpVerificationPage } from "../features/auth/EmailOtpVerificationPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { TotpVerificationPage } from "../features/auth/TotpVerificationPage.jsx";
import { PendingApprovalPage } from "../features/auth/PendingApprovalPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { VerificationPage } from "../features/auth/VerificationPage.jsx";
import { authenticationExpiredEvent } from "../api/client.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  const [view, setView] = useState("login");
  const [registration, setRegistration] = useState(null);
  const [session, setSession] = useState(null);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [emailOtpChallenge, setEmailOtpChallenge] = useState(null);
  useEffect(() => {
    const resetToLogin = () => {
      setSession(null);
      setView("login");
    };
    window.addEventListener(authenticationExpiredEvent, resetToLogin);
    return () => window.removeEventListener(authenticationExpiredEvent, resetToLogin);
  }, []);
  const content = session ? <DashboardPlaceholder session={session} onLogout={() => { setSession(null); setView("login"); }} /> : {
    login: <LoginPage onLoggedIn={setSession} onEmailOtpRequired={(challenge) => { setEmailOtpChallenge(challenge); setView("emailOtp"); }} onMfaRequired={(challenge) => { setMfaChallenge(challenge); setView("mfa"); }} onRegister={() => setView("register")} />,
    register: <RegisterPage onLogin={() => setView("login")} onRegistered={(value) => { setRegistration(value); setView("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => setView("pending")} /> : <LoginPage onLoggedIn={setSession} onEmailOtpRequired={(challenge) => { setEmailOtpChallenge(challenge); setView("emailOtp"); }} onMfaRequired={(challenge) => { setMfaChallenge(challenge); setView("mfa"); }} onRegister={() => setView("register")} />,
    pending: <PendingApprovalPage onLogin={() => setView("login")} />,
    mfa: mfaChallenge ? <TotpVerificationPage challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); setView("login"); }} onCompleted={setSession} /> : <LoginPage onLoggedIn={setSession} onEmailOtpRequired={(challenge) => { setEmailOtpChallenge(challenge); setView("emailOtp"); }} onMfaRequired={(challenge) => { setMfaChallenge(challenge); setView("mfa"); }} onRegister={() => setView("register")} />,
    emailOtp: emailOtpChallenge ? <EmailOtpVerificationPage challenge={emailOtpChallenge} onCancel={() => { setEmailOtpChallenge(null); setView("login"); }} onCompleted={setSession} /> : <LoginPage onLoggedIn={setSession} onEmailOtpRequired={(challenge) => { setEmailOtpChallenge(challenge); setView("emailOtp"); }} onMfaRequired={(challenge) => { setMfaChallenge(challenge); setView("mfa"); }} onRegister={() => setView("register")} />,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      {content}
    </QueryClientProvider>
  );
}
