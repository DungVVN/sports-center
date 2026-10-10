import { errorMessageFor } from "../../../shared/api/error-message.js";
import { clock, labels } from "../domain/calendar-display.js";
import { RentalQuote, RentalCompletion } from "./RentalOperations.jsx";

export function FacilityReservations({ activeTab, can, mine, staff, busy, perform, setPayment, confirmCancellation, setCancellation, cancellation, cancelReservation, decision, setDecision, reviewReservation }) {
  return (
    <>
      {activeTab === "reservations" && can("facility.booking.self.read") && (
        <section className="facility-calendar__panel">
          <h3>Đơn đặt của tôi</h3>
          {mine.isPending ? (
            <p>Đang tải...</p>
          ) : mine.isError ? (
            <p role="alert">
              {errorMessageFor(mine.error, "Không thể tải đơn đặt của tôi.")}{" "}
              <button type="button" onClick={() => mine.refetch()}>
                Thử lại
              </button>
            </p>
          ) : mine.data?.length ? (
            <ul>
              {mine.data.map((item) => (
                <li key={item.id}>
                  {item.facilityName} · {item.date} · {clock(item.assignedStartMinute ?? item.requestedStartMinute)}–
                  {clock(item.assignedEndMinute ?? item.requestedEndMinute)} · {labels[item.status]}
                  <RentalQuote
                    item={item}
                    canPay={can("facility.booking.request")}
                    busy={busy}
                    perform={perform}
                    onPayment={setPayment}
                  />
                  {!item.completedAt && ["pending", "approved"].includes(item.status) && item.cancellationPending && (
                    <>
                      <span> · Có yêu cầu hủy: {item.cancellationReason}</span>
                      <button type="button" disabled={busy} onClick={() => void confirmCancellation(item.id)}>
                        Xác nhận hủy
                      </button>
                    </>
                  )}
                  {!item.completedAt &&
                    ["pending", "approved"].includes(item.status) &&
                    !item.cancellationPending &&
                    can("facility.booking.cancel") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setCancellation({ id: item.id, reason: "" })}
                      >
                        Hủy đơn
                      </button>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có đơn đặt sân.</p>
          )}
        </section>
      )}
      {activeTab === "reservations" && can("facility.booking.read") && (
        <section className="facility-calendar__panel">
          <h3>Yêu cầu đặt sân</h3>
          {staff.isPending ? (
            <p>Đang tải...</p>
          ) : staff.isError ? (
            <p role="alert">
              {errorMessageFor(staff.error, "Không thể tải yêu cầu đặt sân.")}{" "}
              <button type="button" onClick={() => staff.refetch()}>
                Thử lại
              </button>
            </p>
          ) : staff.data?.length ? (
            <ul>
              {staff.data.map((item) => (
                <li key={item.id}>
                  <strong>{item.requesterName}</strong> · {item.phone} · {item.participantCount} người ·{" "}
                  {item.facilityName} · {item.date} · {clock(item.requestedStartMinute)}–
                  {clock(item.requestedEndMinute)} · {labels[item.status]}
                  <RentalQuote item={item} busy={busy} perform={perform} />
                  {item.status === "approved" && !item.completedAt && can("facility.booking.approve") && (
                    <RentalCompletion item={item} busy={busy} perform={perform} />
                  )}
                  {item.status === "pending" && can("facility.booking.approve") && (
                    <button
                      type="button"
                      onClick={() =>
                        setDecision({
                          id: item.id,
                          start: clock(item.requestedStartMinute),
                          end: clock(item.requestedEndMinute),
                          reason: "",
                        })
                      }
                    >
                      Xử lý
                    </button>
                  )}
                  {!item.completedAt &&
                    ["pending", "approved"].includes(item.status) &&
                    can("facility.booking.cancel") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setCancellation({ id: item.id, reason: "" })}
                      >
                        Hủy đơn
                      </button>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có yêu cầu đặt sân.</p>
          )}
        </section>
      )}
      {activeTab === "reservations" && cancellation.id && (
        <form
          className="facility-calendar__panel"
          onSubmit={(event) => {
            event.preventDefault();
            void cancelReservation();
          }}
        >
          <h3>Hủy đơn đặt sân</h3>
          <label>
            Lý do hủy
            <input
              required
              minLength="3"
              maxLength="500"
              value={cancellation.reason}
              onChange={(event) => setCancellation({ ...cancellation, reason: event.target.value })}
            />
          </label>
          <button disabled={busy || cancellation.reason.trim().length < 3}>Xác nhận hủy</button>
          <button type="button" onClick={() => setCancellation({ id: "", reason: "" })}>
            Đóng
          </button>
        </form>
      )}
      {activeTab === "reservations" && decision.id && (
        <form
          className="facility-calendar__panel"
          onSubmit={(event) => {
            event.preventDefault();
            void reviewReservation(true);
          }}
        >
          <h3>Chốt giờ đặt sân</h3>
          <div className="facility-calendar__fields">
            <label>
              Từ giờ
              <input
                required
                type="time"
                value={decision.start}
                onChange={(event) => setDecision({ ...decision, start: event.target.value })}
              />
            </label>
            <label>
              Đến giờ
              <input
                required
                type="time"
                value={decision.end}
                onChange={(event) => setDecision({ ...decision, end: event.target.value })}
              />
            </label>
            <label>
              Lý do từ chối
              <input
                value={decision.reason}
                onChange={(event) => setDecision({ ...decision, reason: event.target.value })}
              />
            </label>
          </div>
          <button disabled={busy}>Duyệt đơn</button>
          <button
            type="button"
            disabled={busy || decision.reason.trim().length < 3}
            onClick={() => void reviewReservation(false)}
          >
            Từ chối
          </button>
          <button type="button" onClick={() => setDecision({ id: "", start: "", end: "", reason: "" })}>
            Đóng
          </button>
        </form>
      )}
    </>
  );
}
