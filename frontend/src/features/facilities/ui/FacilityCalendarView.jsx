import { errorMessageFor } from "../../../shared/api/error-message.js";
import { localDate, shiftDate, clock } from "../domain/calendar-display.js";

export function FacilityCalendarView({ activeTab, calendar, can, dateRangeValid, visibleDays, from, to, range, typeId, selectedFacilityId, changeDate, setRange, setTypeId, setSelectedFacilityId, session, onLoginClick, form, setForm, busy, requestReservation }) {
  return (
    <>
      {activeTab === "calendar" && (
        <>
          <section className="facility-calendar__filter-panel" aria-label="Bộ lọc lịch sân">
            <div className="facility-calendar__filters">
              <label>
                Loại sân
                <select
                  value={typeId}
                  onChange={(event) => {
                    setTypeId(event.target.value);
                    setSelectedFacilityId("");
                  }}
                >
                  <option value="">Tất cả</option>
                  {(calendar.data?.types ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sân
                <select value={selectedFacilityId} onChange={(event) => setSelectedFacilityId(event.target.value)}>
                  <option value="">Tất cả sân</option>
                  {(calendar.data?.facilities ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Sân/phòng
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày
                <input type="date" required value={from} onChange={(event) => changeDate(event.target.value)} />
              </label>
              <label>
                Chế độ xem
                <select value={range} onChange={(event) => setRange(event.target.value)}>
                  <option value="day">Theo ngày</option>
                  <option value="week">Theo tuần</option>
                </select>
              </label>
            </div>
            <div className="facility-calendar__date-navigation">
              <button
                type="button"
                disabled={!from}
                onClick={() => changeDate(shiftDate(from, range === "week" ? -7 : -1))}
              >
                {range === "week" ? "Tuần trước" : "Ngày trước"}
              </button>
              <button type="button" onClick={() => changeDate(localDate())}>
                Hôm nay
              </button>
              <button
                type="button"
                disabled={!from}
                onClick={() => changeDate(shiftDate(from, range === "week" ? 7 : 1))}
              >
                {range === "week" ? "Tuần sau" : "Ngày sau"}
              </button>
            </div>
          </section>
          {!dateRangeValid && <p role="alert">Chọn ngày hợp lệ để xem lịch sân.</p>}
          <div className="facility-calendar__table-wrap">
            <table className="facility-calendar__table">
              <caption>
                Lịch sân từ {from} đến {to}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ngày</th>
                  <th scope="col">Sân</th>
                  <th scope="col">Giờ hoạt động</th>
                  <th scope="col">Giờ trống</th>
                  <th scope="col">Đã đặt</th>
                  {can("facility.booking.request") && <th scope="col">Đặt sân</th>}
                </tr>
              </thead>
              <tbody>
                {!dateRangeValid && (
                  <tr>
                    <td colSpan={can("facility.booking.request") ? 6 : 5}>Chọn khoảng ngày hợp lệ để xem lịch sân.</td>
                  </tr>
                )}
                {dateRangeValid && calendar.isPending && (
                  <tr>
                    <td colSpan={can("facility.booking.request") ? 6 : 5} role="status">
                      Đang tải lịch sân...
                    </td>
                  </tr>
                )}
                {dateRangeValid && calendar.isError && (
                  <tr>
                    <td colSpan={can("facility.booking.request") ? 6 : 5} role="alert">
                      {errorMessageFor(calendar.error, "Không thể tải lịch sân.")}{" "}
                      <button type="button" onClick={() => calendar.refetch()}>
                        Tải lại lịch sân
                      </button>
                    </td>
                  </tr>
                )}
                {calendar.data && visibleDays.length === 0 && (
                  <tr>
                    <td colSpan={can("facility.booking.request") ? 6 : 5}>
                      Chưa có ngày mở đặt sân trong khoảng đã chọn.
                    </td>
                  </tr>
                )}
                {visibleDays.map((day) => {
                  const court = calendar.data.facilities.find((item) => item.id === day.facilityId);
                  const kind = calendar.data.types.find((item) => item.id === court?.typeId);
                  return (
                    <tr key={day.id}>
                      <th scope="row">{day.date}</th>
                      <td>
                        <strong>{court?.name}</strong>
                        <span className="facility-calendar__court-type">
                          {kind?.name}
                          {court?.hourlyRateVnd != null &&
                            ` · ${Number(court.hourlyRateVnd).toLocaleString("vi-VN")} đ/giờ`}
                        </span>
                      </td>
                      <td>{court ? `${clock(court.openMinute)}–${clock(court.closeMinute)}` : "—"}</td>
                      <td>
                        <div className="facility-calendar__periods">
                          {day.free.length ? (
                            day.free.map((period) => (
                              <span
                                className="facility-calendar__free"
                                key={`${period.startMinute}-${period.endMinute}`}
                              >
                                {clock(period.startMinute)}–{clock(period.endMinute)}
                              </span>
                            ))
                          ) : (
                            <span>Hết giờ trống</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="facility-calendar__periods">
                          {day.booked.length ? (
                            day.booked.map((period) => (
                              <span
                                className="facility-calendar__booked"
                                key={`${period.startMinute}-${period.endMinute}`}
                              >
                                {clock(period.startMinute)}–{clock(period.endMinute)}
                              </span>
                            ))
                          ) : (
                            <span>Chưa có</span>
                          )}
                        </div>
                      </td>
                      {can("facility.booking.request") && (
                        <td>
                          <button type="button" onClick={() => setForm((current) => ({ ...current, dayId: day.id }))}>
                            Yêu cầu đặt ngày này
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!session && (
            <p className="facility-calendar__prompt">
              Bạn cần đăng nhập để gửi yêu cầu đặt sân.{" "}
              <button type="button" onClick={onLoginClick}>
                Đặt sân ngay
              </button>
            </p>
          )}
          {can("facility.booking.request") && (
            <form className="facility-calendar__panel" onSubmit={requestReservation}>
              <h3>Gửi yêu cầu đặt sân</h3>
              <p>Người đặt: {session.user.displayName}. Lễ tân có thể điều chỉnh giờ khi duyệt.</p>
              <div className="facility-calendar__fields">
                <label>
                  Ngày và sân
                  <select
                    required
                    value={form.dayId}
                    onChange={(event) => setForm({ ...form, dayId: event.target.value })}
                  >
                    <option value="">Chọn ngày và sân</option>
                    {calendar.data?.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        {calendar.data.facilities.find((item) => item.id === day.facilityId)?.name} · {day.date}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Giờ bắt đầu
                  <input
                    required
                    type="time"
                    value={form.start}
                    onChange={(event) => setForm({ ...form, start: event.target.value })}
                  />
                </label>
                <label>
                  Giờ kết thúc
                  <input
                    required
                    type="time"
                    value={form.end}
                    onChange={(event) => setForm({ ...form, end: event.target.value })}
                  />
                </label>
                <label>
                  Số người tham gia
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={form.participantCount}
                    onChange={(event) => setForm({ ...form, participantCount: event.target.value })}
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
              </div>
              <button disabled={busy} type="submit">
                Gửi yêu cầu
              </button>
            </form>
          )}
        </>
      )}
    </>
  );
}
