import { useEffect, useState } from "react";
import { upcomingSchedule } from "../domain/upcoming-schedule.js";
import { useQuery } from "@tanstack/react-query";
import { hasSessionPermission } from "../../auth/index.js";
import { facilityApi } from "../../facilities/index.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

export function UpcomingSchedule({ bookings, onNavigate, session }) {
  const canReadFacilities = hasSessionPermission(session, "facility.booking.self.read");
  const reservations = useQuery({ queryKey: ["facility-reservations-me"], queryFn: facilityApi.mine, enabled: canReadFacilities, retry: false });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const events = upcomingSchedule(bookings, canReadFacilities ? reservations.data ?? [] : [], now);

  return (
    <section className="members-list" aria-label="Lịch sắp tới của tôi">
      <h2>Lịch sắp tới của tôi</h2>
      <p>Lớp tập và đơn đặt sân theo giờ Việt Nam. Lịch chờ chỗ hoặc chờ duyệt chưa được xác nhận.</p>
      {canReadFacilities && reservations.isLoading && <p role="status">Đang tải lịch đặt sân...</p>}
      {canReadFacilities && reservations.isError && <p role="alert">{errorMessageFor(reservations.error, "Không tải được lịch đặt sân.")} <button type="button" onClick={() => void reservations.refetch()}>Thử lại lịch sân</button></p>}
      {events.length ? (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.title}</strong> · {event.time}
              <p>{event.detail}</p>
              {onNavigate && (
                <button type="button" onClick={() => onNavigate(event.target)}>
                  Xem {event.target === "pt" ? "lịch PT" : event.target === "bookings" ? "đặt lớp" : "đơn đặt sân"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : <p>Chưa có lịch sắp tới trong dữ liệu đã tải.</p>}
    </section>
  );
}
