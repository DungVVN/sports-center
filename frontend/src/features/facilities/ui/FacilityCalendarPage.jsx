import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { useFacilityWorkspace } from "../api/useFacilityWorkspace.js";
import { FacilityCalendarView } from "./FacilityCalendarView.jsx";
import { FacilitySetup } from "./FacilitySetup.jsx";
import { FacilityReservations } from "./FacilityReservations.jsx";
import { RentalSettings } from "./RentalSettings.jsx";
import { RentalPayment } from "./RentalOperations.jsx";
import "./facilities.css";

const tabs = [
  { id: "calendar", label: "Lịch & đặt sân", view: "facility-calendar", path: "/facilities" },
  { id: "reservations", label: "Đơn đặt sân", view: "facility-reservations", path: "/facilities/reservations" },
  { id: "settings", label: "Cấu hình sân", view: "facility-settings", path: "/facilities/settings" },
];

export function FacilityCalendarPage({ session, onLoginClick, embedded = false, tab, onNavigate }) {
  const workspace = useFacilityWorkspace({ session, tab });
  const CalendarHeading = embedded ? "h2" : "h1";
  return (
    <section id="facility-calendar" className="members-page facility-calendar">
      <PageHeader
        eyebrow="Lịch sân"
        title={tabs.find((item) => item.id === workspace.activeTab)?.label ?? "Lịch sân"}
        headingAs={CalendarHeading}
      />
      {session && (
        <nav className="facility-calendar__tabs" aria-label="Các mục lịch sân">
          {tabs
            .filter((item) => item.id === "calendar" || (item.id === "settings" ? workspace.canConfigure : workspace.canViewReservations))
            .map((item) => (
              <a
                key={item.id}
                href={item.path}
                aria-current={workspace.activeTab === item.id ? "page" : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  if (onNavigate) onNavigate(item.view);
                  else workspace.setLocalTab(item.id);
                }}
              >
                {item.label}
              </a>
            ))}
        </nav>
      )}
      {!workspace.tabAllowed && <p role="alert">Bạn không có quyền truy cập mục này.</p>}
      <FacilityCalendarView
        activeTab={workspace.activeTab}
        calendar={workspace.calendar}
        can={workspace.can}
        dateRangeValid={workspace.dateRangeValid}
        visibleDays={workspace.visibleDays}
        from={workspace.from}
        to={workspace.to}
        range={workspace.range}
        typeId={workspace.typeId}
        selectedFacilityId={workspace.selectedFacilityId}
        changeDate={workspace.changeDate}
        setRange={workspace.setRange}
        setTypeId={workspace.setTypeId}
        setSelectedFacilityId={workspace.setSelectedFacilityId}
        session={session}
        onLoginClick={onLoginClick}
        form={workspace.form}
        setForm={workspace.setForm}
        busy={workspace.busy}
        requestReservation={workspace.requestReservation}
      />
      <FacilityReservations
        activeTab={workspace.activeTab}
        can={workspace.can}
        mine={workspace.mine}
        staff={workspace.staff}
        busy={workspace.busy}
        perform={workspace.perform}
        setPayment={workspace.setPayment}
        confirmCancellation={workspace.confirmCancellation}
        setCancellation={workspace.setCancellation}
        cancellation={workspace.cancellation}
        cancelReservation={workspace.cancelReservation}
        decision={workspace.decision}
        setDecision={workspace.setDecision}
        reviewReservation={workspace.reviewReservation}
      />
      <FacilitySetup
        activeTab={workspace.activeTab}
        canConfigure={workspace.canConfigure}
        can={workspace.can}
        calendar={workspace.calendar}
        typeName={workspace.typeName}
        setTypeName={workspace.setTypeName}
        facility={workspace.facility}
        setFacility={workspace.setFacility}
        newDay={workspace.newDay}
        setNewDay={workspace.setNewDay}
        busy={workspace.busy}
        perform={workspace.perform}
      />
      {workspace.activeTab === "settings" && workspace.can("facility.manage") && <RentalSettings busy={workspace.busy} perform={workspace.perform} />}
      {workspace.activeTab === "reservations" && <RentalPayment payment={workspace.payment} />}
      {workspace.feedback.error && (
        <p className="facility-calendar__error" role="alert">
          {workspace.feedback.error}
        </p>
      )}
      {workspace.feedback.notice && (
        <p className="facility-calendar__notice" role="status">
          {workspace.feedback.notice}
        </p>
      )}
    </section>
  );
}
