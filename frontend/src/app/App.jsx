import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../shared/ui/ToastContext.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminLoginPage, LoginPage, TotpVerificationPage, PendingApprovalPage, RegisterPage, VerificationPage, InitialPasswordChangePage, authApi } from "../features/auth/index.js";
import { DashboardPlaceholder } from "./composition/DashboardPlaceholder.jsx";
import { authenticationExpiredEvent, permissionsChangedEvent } from "../shared/api/client.js";
import { HomeRoute, ManagedPublicPage, GalleryPage, CalendarPage, NotFoundPage } from "../features/site/index.js";
import { dashboardPath, dashboardView, isDashboardView } from "./dashboard-routes.js";
import { portalSurface } from "../config/portal.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
const sessionChangeStorageKey = "sports-center:session-change";

function notifyOtherTabsOfSessionChange() {
  try {
    // Storage events stay on this origin; no credentials or account data are stored.
    window.localStorage.setItem(sessionChangeStorageKey, `${Date.now()}-${Math.random()}`);
  } catch {
    // Cookie-based authentication still works when browser storage is unavailable.
  }
}

export function App() {
  const isAdminPortal = portalSurface() === "admin";

  const getInitialView = () => {
    const path = window.location.pathname;
    if (isAdminPortal) return path === "/" || path === "/login" || dashboardView(path) ? "login" : "notFound";
    if (path === "/") return "landing";
    if (path === "/login") return "login";
    if (path === "/register") return "register";
    if (path === "/verify") return "verify";
    if (path === "/pending") return "pending";
    if (path === "/gallery") return "gallery";
    if (path === "/calendar") return "calendar";
    if (dashboardView(path)) return "login";
    return "site-page";
  };

  const [view, setView] = useState(getInitialView());
  const [registration, setRegistration] = useState(null);
  const [session, setSession] = useState(null);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const sessionChangeVersion = useRef(0);

  const navigate = useCallback((newView) => {
    setView(newView);
    if (!isAdminPortal) {
      const path = isDashboardView(newView) ? dashboardPath(newView) : newView === "landing" ? "/" : `/${newView}`;
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
      else if (dashboardView(path)) setView("dashboard");
      else if (path === "/") setView("landing");
      else setView(isAdminPortal ? "notFound" : "site-page");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isAdminPortal]);

  useEffect(() => {
    const resetToLogin = () => {
      sessionChangeVersion.current += 1;
      setIsRestoringSession(false);
      setSession(null);
      navigate("login");
    };
    window.addEventListener(authenticationExpiredEvent, resetToLogin);
    return () => window.removeEventListener(authenticationExpiredEvent, resetToLogin);
  }, [navigate]);
  useEffect(() => {
    let isCurrent = true;
    const version = sessionChangeVersion.current;

    void authApi.me({ suppressAuthenticationExpiredEvent: true })
      .then((currentSession) => {
        if (isCurrent && version === sessionChangeVersion.current && currentSession && (currentSession.user.role === "admin") === isAdminPortal) setSession(currentSession);
      })
      .catch(() => {
        // A missing or expired cookie is the normal anonymous state on a fresh load.
      })
      .finally(() => {
        if (isCurrent && version === sessionChangeVersion.current) setIsRestoringSession(false);
      });

    return () => { isCurrent = false; };
  }, [isAdminPortal]);
  useEffect(() => {
    if (!session) return undefined;
    const refreshSession = () => { void authApi.me().then((currentSession) => {
      if ((currentSession.user.role === "admin") === isAdminPortal) {
        if (currentSession.user.id !== session.user.id) {
          queryClient.clear();
          navigate("dashboard");
        }
        setSession(currentSession);
      }
      else setSession(null);
    }).catch(() => {}); };
    window.addEventListener("focus", refreshSession);
    window.addEventListener(permissionsChangedEvent, refreshSession);
    return () => {
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener(permissionsChangedEvent, refreshSession);
    };
  }, [session, isAdminPortal, navigate]);
  useEffect(() => {
    let currentRequest = 0;
    const handleSessionChange = (event) => {
      if (event.key !== sessionChangeStorageKey) return;
      const requestId = ++currentRequest;
      const version = ++sessionChangeVersion.current;
      queryClient.clear();
      setSession(null);
      setIsRestoringSession(true);
      void authApi.me({ suppressAuthenticationExpiredEvent: true })
        .then((currentSession) => {
          if (requestId !== currentRequest || version !== sessionChangeVersion.current) return;
          if ((currentSession.user.role === "admin") === isAdminPortal) {
            setSession(currentSession);
            navigate("dashboard");
          } else navigate("login");
        })
        .catch(() => { if (requestId === currentRequest && version === sessionChangeVersion.current) navigate("login"); })
        .finally(() => { if (requestId === currentRequest && version === sessionChangeVersion.current) setIsRestoringSession(false); });
    };
    window.addEventListener("storage", handleSessionChange);
    return () => { currentRequest += 1; window.removeEventListener("storage", handleSessionChange); };
  }, [isAdminPortal, navigate]);
  useEffect(() => { document.title = isAdminPortal ? "Kinetic Admin" : "Kinetic Sports Center"; }, [isAdminPortal]);
  const onMfaRequired = (challenge) => { setMfaChallenge(challenge); navigate("mfa"); };
  const onLoggedIn = (currentSession) => {
    if ((currentSession.user.role === "admin") !== isAdminPortal) return;
    sessionChangeVersion.current += 1;
    setIsRestoringSession(false);
    queryClient.clear();
    setSession(currentSession);
    navigate(currentSession.user.profileSetupRequired ? "profile" : "dashboard");
    notifyOtherTabsOfSessionChange();
  };
  const loginPage = isAdminPortal
    ? <AdminLoginPage onLoggedIn={onLoggedIn} onMfaRequired={onMfaRequired} />
    : <LoginPage onLoggedIn={onLoggedIn} onMfaRequired={onMfaRequired} onRegister={() => navigate("register")} />;
  const isWaitingForPrivateRoute = isRestoringSession && (view === "dashboard" || Boolean(dashboardView(window.location.pathname)));
  const content = isWaitingForPrivateRoute
    ? <main className="app-loading-state" aria-label="Đang tải tài khoản" />
    : session?.user.mustChangePassword
    ? <InitialPasswordChangePage onCompleted={() => { setSession((current) => ({ ...current, user: { ...current.user, mustChangePassword: false } })); }} />
    : session && view !== "notFound" && view !== "site-page" ? <DashboardPlaceholder key={session.user.id} initialView={dashboardView(window.location.pathname) ?? (session.user.profileSetupRequired ? "profile" : "dashboard")} session={session} onProfileSaved={() => setSession((current) => ({ ...current, user: { ...current.user, profileSetupRequired: false } }))} onLogout={() => { sessionChangeVersion.current += 1; setIsRestoringSession(false); queryClient.clear(); setSession(null); navigate("login"); notifyOtherTabsOfSessionChange(); }} /> : {
    login: loginPage,
    landing: <HomeRoute onLoginClick={() => navigate("login")} onRegisterClick={() => navigate("register")} onGalleryClick={() => navigate("gallery")} onCalendarClick={() => navigate("calendar")} onHomeClick={() => navigate("landing")} />,
    "site-page": <ManagedPublicPage path={window.location.pathname} onHomeClick={() => navigate("landing")} onLoginClick={() => navigate("login")} />,
    gallery: <GalleryPage onLoginClick={() => navigate("login")} onHomeClick={() => navigate("landing")} />,
    calendar: <CalendarPage onLoginClick={() => navigate("login")} onHomeClick={() => navigate("landing")} />,
    notFound: <NotFoundPage onHome={() => navigate("landing")} onLogin={() => navigate("login")} />,
    register: isAdminPortal ? loginPage : <RegisterPage onLogin={() => navigate("login")} onRegistered={(value) => { setRegistration(value); navigate("verify"); }} />,
    verify: registration ? <VerificationPage registration={registration} onCompleted={() => navigate("pending")} /> : loginPage,
    pending: <PendingApprovalPage onLogin={() => navigate("login")} />,
    mfa: mfaChallenge ? <TotpVerificationPage challenge={mfaChallenge} onCancel={() => { setMfaChallenge(null); navigate("login"); }} onCompleted={onLoggedIn} verifyLogin={isAdminPortal ? authApi.verifyAdminTotpLogin : authApi.verifyTotpLogin} portalName={isAdminPortal ? "cổng quản trị" : "hệ thống"} /> : loginPage,
  }[view];
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {content}
      </ToastProvider>
    </QueryClientProvider>
  );
}
