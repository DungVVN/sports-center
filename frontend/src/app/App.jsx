import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardPlaceholder } from "../features/auth/DashboardPlaceholder.jsx";
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
  useEffect(() => {
    const resetToLogin = () => {
      setSession(null);
      setView("login");
    };
    window.addEventListener(authenticationExpiredEvent, resetToLogin);
    return () => window.removeEventListener(authenticationExpiredEvent, resetToLogin);
  }, []);
  const loginPage = <LoginPage onLoggedIn={setSession} onMfaRequired={(challenge) => { setMfaChallenge(challenge); setView("mfa"); }} onRegister={() => setView("register")} />;
  const content = session ? <DashboardPlaceholder session={session} onLogout={() => { setSession(null); setView("login"); }} /> : {
    login: loginPage,
    register: <RegisterPage onLogin={() => setView("login")} onRegistered={(value) => { setRegistration(value); setView("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => setView("pending")} /> : loginPage,
    pending: <PendingApprovalPage onLogin={() => setView("login")} />,
    mfa: mfaChallenge ? <TotpVerificationPage challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); setView("login"); }} onCompleted={setSession} /> : loginPage,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      {content}
    </QueryClientProvider>
  );
}
