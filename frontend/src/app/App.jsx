import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardPlaceholder } from "../features/auth/DashboardPlaceholder.jsx";
import { authApi } from "../features/auth/auth-api.js";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { PendingApprovalPage } from "../features/auth/PendingApprovalPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { VerificationPage } from "../features/auth/VerificationPage.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  const [view, setView] = useState("login");
  const [registration, setRegistration] = useState(null);
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => { void Promise.resolve().then(async () => { try { setSession(await authApi.me()); } catch { /* No valid server session; show the public authentication flow. */ } finally { setRestoring(false); } }); }, []);
  if (restoring) return <main aria-busy="true" aria-live="polite" className="app-bootstrap"><span aria-hidden="true" className="app-bootstrap__spinner" /><p>Đang khôi phục phiên làm việc…</p></main>;
  const content = session ? <DashboardPlaceholder session={session} onLogout={() => { setSession(null); setView("login"); }} /> : {
    login: <LoginPage onLoggedIn={setSession} onRegister={() => setView("register")} />,
    register: <RegisterPage onLogin={() => setView("login")} onRegistered={(value) => { setRegistration(value); setView("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => setView("pending")} /> : <LoginPage onLoggedIn={setSession} onRegister={() => setView("register")} />,
    pending: <PendingApprovalPage onLogin={() => setView("login")} />,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      {content}
    </QueryClientProvider>
  );
}
