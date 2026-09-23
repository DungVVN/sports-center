import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { DashboardPlaceholder } from "../features/auth/DashboardPlaceholder.jsx";
import { AdminLoginPage } from "../features/auth/AdminLoginPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { TotpVerificationPage } from "../features/auth/TotpVerificationPage.jsx";
import { PendingApprovalPage } from "../features/auth/PendingApprovalPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { VerificationPage } from "../features/auth/VerificationPage.jsx";
import { InitialPasswordChangePage } from "../features/auth/InitialPasswordChangePage.jsx";
import { authenticationExpiredEvent, permissionsChangedEvent } from "../api/client.js";
import { authApi } from "../features/auth/auth-api.js";
import { LandingPage } from "../pages/LandingPage/LandingPage.jsx";
import { GalleryPage } from "../pages/GalleryPage/GalleryPage.jsx";
import { CalendarPage } from "../pages/CalendarPage/CalendarPage.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  const isAdminPortal = window.location.hostname === "admin.kineticsports.io.vn" || import.meta.env.VITE_ADMIN_PORTAL === "true";

  const getInitialView = () => {
    if (isAdminPortal) return "login";
    const path = window.location.pathname;
    if (path === "/login") return "login";
    if (path === "/register") return "register";
    if (path === "/verify") return "verify";
    if (path === "/pending") return "pending";
    if (path === "/gallery") return "gallery";
    if (path === "/calendar") return "calendar";
    return "landing";
  };

  const [view, setView] = useState(getInitialView());
  const [registration, setRegistration] = useState(null);
  const [session, setSession] = useState(null);
  const [mfaChallenge, setMfaChallenge] = useState(null);

  const navigate = useCallback((newView) => {
    setView(newView);
    if (!isAdminPortal) {
      const path = newView === "landing" ? "/" : `/${newView}`;
      window.history.pushState({}, "", path);
    }
  }, [isAdminPortal]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/login") setView("login");
      else if (path === "/register") setView("register");
      else if (path === "/verify") setView("verify");
      else if (path === "/pending") setView("pending");
      else if (path === "/gallery") setView("gallery");
      else if (path === "/calendar") setView("calendar");
      else setView("landing");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const resetToLogin = () => {
      setSession(null);
      navigate("login");
    };
    window.addEventListener(authenticationExpiredEvent, resetToLogin);
    return () => window.removeEventListener(authenticationExpiredEvent, resetToLogin);
  }, [navigate]);
  useEffect(() => {
    if (!session) return undefined;
    const refreshSession = () => { void authApi.me().then(setSession).catch(() => {}); };
    window.addEventListener("focus", refreshSession);
    window.addEventListener(permissionsChangedEvent, refreshSession);
    return () => {
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener(permissionsChangedEvent, refreshSession);
    };
  }, [session]);
  useEffect(() => { document.title = isAdminPortal ? "Kinetic Admin" : "Kinetic Sports Center"; }, [isAdminPortal]);
  const onMfaRequired = (challenge) => { setMfaChallenge(challenge); navigate("mfa"); };
  const loginPage = isAdminPortal
    ? <AdminLoginPage onLoggedIn={setSession} onMfaRequired={onMfaRequired} />
    : <LoginPage onLoggedIn={setSession} onMfaRequired={onMfaRequired} onRegister={() => navigate("register")} />;
  const content = session?.user.mustChangePassword
    ? <InitialPasswordChangePage onCompleted={() => { setSession((current) => ({ ...current, user: { ...current.user, mustChangePassword: false } })); }} />
    : session ? <DashboardPlaceholder initialView={session.user.profileSetupRequired ? "profile" : "dashboard"} session={session} onProfileSaved={() => setSession((current) => ({ ...current, user: { ...current.user, profileSetupRequired: false } }))} onLogout={() => { setSession(null); navigate("login"); }} /> : {
    login: loginPage,
    landing: <LandingPage onLoginClick={() => navigate("login")} onRegisterClick={() => navigate("register")} onGalleryClick={() => navigate("gallery")} onCalendarClick={() => navigate("calendar")} />,
    gallery: <GalleryPage onLoginClick={() => navigate("login")} onHomeClick={() => navigate("landing")} />,
    calendar: <CalendarPage onLoginClick={() => navigate("login")} onHomeClick={() => navigate("landing")} />,
    register: isAdminPortal ? loginPage : <RegisterPage onLogin={() => navigate("login")} onRegistered={(value) => { setRegistration(value); navigate("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => navigate("pending")} /> : loginPage,
    pending: <PendingApprovalPage onLogin={() => navigate("login")} />,
    mfa: mfaChallenge ? <TotpVerificationPage challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); navigate("login"); }} onCompleted={setSession} verifyLogin={isAdminPortal ? authApi.verifyAdminTotpLogin : authApi.verifyTotpLogin} portalName={isAdminPortal ? "cổng quản trị" : "hệ thống"} /> : loginPage,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      {content}
    </QueryClientProvider>
  );
}
