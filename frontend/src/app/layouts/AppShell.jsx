import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  CalendarRange,
  ChartColumnIncreasing,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  ContactRound,
  CreditCard,
  Dumbbell,
  Globe,
  Headset,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTree,
  LogOut,
  MapPinned,
  Menu,
  Package,
  PackagePlus,
  PanelsTopLeft,
  ScrollText,
  ShieldCheck,
  TicketCheck,
  UserRoundCheck,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "../../shared/ui/Button.jsx";
import { Tooltip } from "../../shared/ui/Tooltip.jsx";
import "./AppShell.css";
import "./AppShellTypography.css";
import "./AppShell.notifications.css";

const icons = {
  dashboard: LayoutDashboard,
  profile: CircleUserRound,
  website: Globe,
  sitePages: PanelsTopLeft,
  siteMenu: ListTree,
  memberManagement: ContactRound,
  members: Users,
  registrations: UserRoundCheck,
  packages: Package,
  packageCreate: PackagePlus,
  packageCatalog: Layers,
  memberMemberships: UserRoundPlus,
  operations: CalendarRange,
  classes: CalendarDays,
  bookings: TicketCheck,
  "facility-calendar": MapPinned,
  attendance: ClipboardCheck,
  training: Dumbbell,
  payments: CreditCard,
  administration: ShieldCheck,
  staff: BadgeCheck,
  rolePermissions: KeyRound,
  insights: ChartNoAxesCombined,
  reports: ChartColumnIncreasing,
  audit: ScrollText,
  support: Headset,
  "my-memberships": Package,
  "my-attendance": ClipboardCheck,
  "my-training": Dumbbell,
  "my-payments": CreditCard,
};

function isActive(item, currentView) {
  return (
    item.id === currentView ||
    item.children?.some((child) => child.id === currentView)
  );
}

function NavigationItems({
  currentView,
  navigation,
  onNavigate,
  expandedGroups,
  toggleGroup,
  mobile = false,
}) {
  const itemClass = mobile ? "app-mobile-nav__item" : "app-nav__item";
  const activeClass = mobile
    ? "app-mobile-nav__item--active"
    : "app-nav__item--active";
  const groupClass = mobile ? "app-mobile-nav__group" : "app-nav__group";
  const subnavClass = mobile ? "app-mobile-nav__subnav" : "app-nav__subnav";
  const subitemClass = mobile ? "app-mobile-nav__subitem" : "app-nav__subitem";

  return navigation.map((item) => {
    const Icon = icons[item.id] ?? CircleHelp;
    const hasChildren = item.children?.length;
    const state = expandedGroups[item.id];
    const expanded =
      state?.view === currentView
        ? state.expanded
        : Boolean(state?.expanded) ||
          Boolean(item.children?.some((child) => child.id === currentView));
    const subnavId = `${mobile ? "mobile" : "desktop"}-nav-${item.id}`;
    const active = isActive(item, currentView);

    if (!hasChildren) {
      return (
        <button
          aria-current={item.id === currentView ? "page" : undefined}
          aria-label={item.label}
          className={active ? `${itemClass} ${activeClass}` : itemClass}
          key={item.id}
          onClick={() => onNavigate(item.id)}
          title={item.label}
          type="button"
        >
          <Icon aria-hidden="true" size={mobile ? 19 : 18} />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <div
        className={`${groupClass}${expanded ? ` ${groupClass}--expanded` : ""}`}
        key={item.id}
      >
        <button
          aria-controls={subnavId}
          aria-expanded={expanded}
          aria-label={`${item.label}, ${expanded ? "thu gọn" : "mở rộng"}`}
          className={
            active
              ? `${itemClass} ${itemClass}--group ${activeClass}`
              : `${itemClass} ${itemClass}--group`
          }
          onClick={() => toggleGroup(item.id, expanded)}
          title={item.label}
          type="button"
        >
          <Icon aria-hidden="true" size={mobile ? 19 : 18} />
          <span>{item.label}</span>
          <ChevronDown
            aria-hidden="true"
            className={`${itemClass}__chevron`}
            size={16}
          />
        </button>
        {expanded && (
          <div className={subnavClass} id={subnavId}>
            {item.children.map((child) => {
              const ChildIcon = icons[child.id] ?? CircleHelp;
              return (
                <button
                  aria-current={child.id === currentView ? "page" : undefined}
                  className={
                    child.id === currentView
                      ? `${subitemClass} ${subitemClass}--active`
                      : subitemClass
                  }
                  key={child.id}
                  onClick={() => onNavigate(child.id)}
                  type="button"
                >
                  <ChildIcon aria-hidden="true" size={mobile ? 16 : 15} />
                  <span>{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  });
}

export function AppShell({
  children,
  currentView,
  navigation,
  notifications,
  onLogout,
  onNavigate,
  onReadNotification,
  roleLabel,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const mobileMenuTriggerRef = useRef(null);
  const mobileNavPanelRef = useRef(null);
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  function toggleGroup(id, expanded) {
    setExpandedGroups((current) => ({
      ...current,
      [id]: { expanded: !expanded, view: currentView },
    }));
  }

  function navigateFromMobile(viewId) {
    onNavigate(viewId);
    setMobileNavOpen(false);
  }

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const panel = mobileNavPanelRef.current;
    const trigger = mobileMenuTriggerRef.current;
    panel?.querySelector("button")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [
        ...panel.querySelectorAll(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      <aside className="app-sidebar" inert={mobileNavOpen}>
        <div className="app-sidebar__brand">
          <span>SC</span>
          <div>
            <strong>Sports Center</strong>
            <small>Quản lý vận hành</small>
          </div>
        </div>
        <div className="app-sidebar__navigation">
          <nav aria-label="Điều hướng chính">
            <NavigationItems
              currentView={currentView}
              expandedGroups={expandedGroups}
              navigation={navigation}
              onNavigate={onNavigate}
              toggleGroup={toggleGroup}
            />
          </nav>
        </div>
        <footer className="app-sidebar__footer">
          <Button
            className="app-sidebar__logout"
            onClick={onLogout}
            variant="ghost"
          >
            <LogOut aria-hidden="true" size={17} />
            Đăng xuất
          </Button>
        </footer>
      </aside>
      <div className="app-shell__content" inert={mobileNavOpen}>
        <header className="app-header">
          <div>
            <p>Sports Center</p>
            <strong>{roleLabel}</strong>
          </div>
          <div className="app-header__actions">
            <button
              aria-controls="mobile-navigation"
              aria-expanded={mobileNavOpen}
              aria-label="Mở menu"
              className="app-header__menu"
              onClick={() => setMobileNavOpen((value) => !value)}
              ref={mobileMenuTriggerRef}
              type="button"
            >
              <Menu aria-hidden="true" size={20} />
            </button>
            <Tooltip label="Mở thông báo">
              {(triggerProps) => (
                <button
                  {...triggerProps}
                  aria-expanded={notificationsOpen}
                  aria-label={`Thông báo, ${unreadCount} chưa đọc`}
                  className="app-header__notifications"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  type="button"
                >
                  <Bell aria-hidden="true" size={18} />
                  {unreadCount > 0 && <span>{unreadCount}</span>}
                </button>
              )}
            </Tooltip>
          </div>
        </header>
        <main className="app-main">{children}</main>
        {notificationsOpen && (
          <aside aria-label="Thông báo" className="app-notification-panel">
            <div className="app-notification-panel__heading">
              <h2>Thông báo</h2>
              <button onClick={() => setNotificationsOpen(false)} type="button">
                Đóng
              </button>
            </div>
            {notifications.length === 0 ? (
              <p>Chưa có thông báo.</p>
            ) : (
              notifications.map((item) => (
                <article
                  className={
                    item.read_at ? "" : "app-notification-panel__unread"
                  }
                  key={item.id}
                >
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  {!item.read_at && (
                    <button
                      onClick={() => onReadNotification(item.id)}
                      type="button"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </article>
              ))
            )}
          </aside>
        )}
      </div>
      <div className="app-mobile-nav">
        {mobileNavOpen && (
          <>
            <button
              aria-label="Đóng menu"
              className="app-mobile-nav__backdrop"
              onClick={() => setMobileNavOpen(false)}
              type="button"
            />
            <section
              aria-label="Điều hướng chính"
              aria-modal="true"
              className="app-mobile-nav__panel"
              id="mobile-navigation"
              ref={mobileNavPanelRef}
              role="dialog"
            >
              <div className="app-mobile-nav__heading">
                <div>
                  <small>Sports Center</small>
                  <h2>Điều hướng</h2>
                </div>
                <button
                  aria-label="Đóng menu"
                  onClick={() => setMobileNavOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              <nav>
                <NavigationItems
                  currentView={currentView}
                  expandedGroups={expandedGroups}
                  mobile
                  navigation={navigation}
                  onNavigate={navigateFromMobile}
                  toggleGroup={toggleGroup}
                />
              </nav>
              <Button
                className="app-mobile-nav__logout"
                onClick={onLogout}
                variant="ghost"
              >
                <LogOut aria-hidden="true" size={18} />
                Đăng xuất
              </Button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
