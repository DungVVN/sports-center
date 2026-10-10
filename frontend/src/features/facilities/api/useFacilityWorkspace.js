import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback } from "../../../shared/lib/useMutationFeedback.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { facilityApi } from "./facility-api.js";
import { localDate, shiftDate, minute } from "../domain/calendar-display.js";

export function useFacilityWorkspace({ session, tab }) {
  const client = useQueryClient();
  const [from, setFrom] = useState(localDate());
  const [range, setRange] = useState("day");
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [localTab, setLocalTab] = useState("calendar");
  const activeTab = tab ?? localTab;
  const to = from ? shiftDate(from, range === "week" ? 6 : 0) : "";
  const [typeId, setTypeId] = useState("");
  const [form, setForm] = useState({ dayId: "", start: "", end: "", participantCount: 1, phone: "" });
  const [typeName, setTypeName] = useState("");
  const [facility, setFacility] = useState({ typeId: "", name: "", open: "06:00", close: "22:00" });
  const [newDay, setNewDay] = useState({ facilityId: "", date: localDate() });
  const [decision, setDecision] = useState({ id: "", start: "", end: "", reason: "" });
  const [cancellation, setCancellation] = useState({ id: "", reason: "" });
  const feedback = useMutationFeedback();
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const granted = new Set(session?.permissions ?? []);
  const can = (code) =>
    session?.user.role === "admin" ||
    (granted.has(code) &&
      !(
        session?.user.role === "member" &&
        ["facility.booking.read", "facility.booking.approve", "facility.manage", "facility.day.manage"].includes(code)
      ));
  const canConfigure = can("facility.manage") || can("facility.day.manage");
  const canViewReservations = can("facility.booking.self.read") || can("facility.booking.read");
  const tabAllowed =
    activeTab === "calendar" ||
    (activeTab === "settings" ? canConfigure : activeTab === "reservations" && canViewReservations);
  const dateRangeValid = Boolean(from && to);
  const calendar = useQuery({
    queryKey: ["facility-calendar", from, to, typeId],
    queryFn: () => facilityApi.calendar({ from, to, typeId }),
    enabled: dateRangeValid && tabAllowed && activeTab !== "reservations",
    retry: false,
  });
  const visibleDays = (calendar.data?.days ?? []).filter(
    (day) => !selectedFacilityId || day.facilityId === selectedFacilityId,
  );
  const mine = useQuery({
    queryKey: ["facility-reservations-me"],
    queryFn: facilityApi.mine,
    enabled: Boolean(session && can("facility.booking.self.read") && activeTab === "reservations"),
    retry: false,
  });
  const staff = useQuery({
    queryKey: ["facility-reservations-staff"],
    queryFn: facilityApi.reservations,
    enabled: Boolean(session && can("facility.booking.read") && activeTab === "reservations"),
    retry: false,
  });

  function changeDate(date) {
    setFrom(date);
    setForm((current) => ({ ...current, dayId: "" }));
  }

  async function perform(action, success) {
    setBusy(true);
    feedback.clear();
    try {
      const result = await action();
      feedback.setNotice(typeof success === "function" ? success(result) : success);
      await client.invalidateQueries({ queryKey: ["facility-calendar"] });
      await client.invalidateQueries({ queryKey: ["facility-reservations-me"] });
      await client.invalidateQueries({ queryKey: ["facility-reservations-staff"] });
      await client.invalidateQueries({ queryKey: ["facility-settings"] });
      await client.invalidateQueries({ queryKey: ["member", "payments"] });
      return true;
    } catch (cause) {
      feedback.setError(errorMessageFor(cause, "Không thể cập nhật đơn đặt sân."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function reviewReservation(approved) {
    const payload = approved
      ? { approved: true, startMinute: minute(decision.start), endMinute: minute(decision.end) }
      : { approved: false, reason: decision.reason.trim() };
    const completed = await perform(
      () => facilityApi.review(decision.id, payload),
      approved ? "Đã duyệt đơn." : "Đã từ chối đơn.",
    );
    if (completed) setDecision({ id: "", start: "", end: "", reason: "" });
  }

  async function cancelReservation() {
    const completed = await perform(
      () => facilityApi.cancel(cancellation.id, cancellation.reason.trim()),
      (result) => (result.cancellationPending ? "Đã gửi yêu cầu hủy, chờ người tạo đơn xác nhận." : "Đã hủy đơn."),
    );
    if (completed) setCancellation({ id: "", reason: "" });
  }

  async function confirmCancellation(id) {
    await perform(() => facilityApi.confirmCancellation(id), "Đã xác nhận hủy đơn.");
  }

  function requestReservation(event) {
    event.preventDefault();
    if (minute(form.end) <= minute(form.start)) {
      feedback.setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    void perform(
      () =>
        facilityApi.request({
          dayId: form.dayId,
          startMinute: minute(form.start),
          endMinute: minute(form.end),
          participantCount: Number(form.participantCount),
          phone: form.phone,
        }),
      "Đã gửi yêu cầu, vui lòng chờ Lễ tân duyệt.",
    );
  }

  return {
    activeTab,
    setLocalTab,
    calendar,
    can,
    canConfigure,
    canViewReservations,
    tabAllowed,
    dateRangeValid,
    visibleDays,
    from,
    to,
    range,
    typeId,
    selectedFacilityId,
    changeDate,
    setRange,
    setTypeId,
    setSelectedFacilityId,
    form,
    setForm,
    busy,
    requestReservation,
    typeName,
    setTypeName,
    facility,
    setFacility,
    newDay,
    setNewDay,
    perform,
    mine,
    staff,
    setPayment,
    confirmCancellation,
    setCancellation,
    cancellation,
    cancelReservation,
    decision,
    setDecision,
    reviewReservation,
    payment,
    feedback
  };
}
