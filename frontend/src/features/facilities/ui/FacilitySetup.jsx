import { facilityApi } from "../api/facility-api.js";
import { minute } from "../domain/calendar-display.js";

export function FacilitySetup({ activeTab, canConfigure, can, calendar, typeName, setTypeName, facility, setFacility, newDay, setNewDay, busy, perform }) {
  return (
    <>
      {activeTab === "settings" && canConfigure && (
        <section className="facility-calendar__panel">
          <h3>Quản lý sân và ngày mở</h3>
          {can("facility.manage") && (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(() => facilityApi.createType({ name: typeName }), "Đã thêm loại sân.");
                }}
              >
                <label>
                  Tên loại sân
                  <input required value={typeName} onChange={(event) => setTypeName(event.target.value)} />
                </label>
                <button disabled={busy}>Thêm loại sân</button>
              </form>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(
                    () =>
                      facilityApi.createFacility({
                        typeId: facility.typeId,
                        name: facility.name,
                        openMinute: minute(facility.open),
                        closeMinute: minute(facility.close),
                      }),
                    "Đã thêm sân.",
                  );
                }}
              >
                <div className="facility-calendar__fields">
                  <label>
                    Loại sân
                    <select
                      required
                      value={facility.typeId}
                      onChange={(event) => setFacility({ ...facility, typeId: event.target.value })}
                    >
                      <option value="">Chọn loại</option>
                      {calendar.data?.types.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tên sân
                    <input
                      required
                      value={facility.name}
                      onChange={(event) => setFacility({ ...facility, name: event.target.value })}
                    />
                  </label>
                  <label>
                    Giờ mở
                    <input
                      required
                      type="time"
                      value={facility.open}
                      onChange={(event) => setFacility({ ...facility, open: event.target.value })}
                    />
                  </label>
                  <label>
                    Giờ đóng
                    <input
                      required
                      type="time"
                      value={facility.close}
                      onChange={(event) => setFacility({ ...facility, close: event.target.value })}
                    />
                  </label>
                </div>
                <button disabled={busy}>Thêm sân</button>
              </form>
            </>
          )}
          {can("facility.day.manage") && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform(() => facilityApi.createDay(newDay), "Đã mở ngày đặt sân.");
              }}
            >
              <div className="facility-calendar__fields">
                <label>
                  Sân
                  <select
                    required
                    value={newDay.facilityId}
                    onChange={(event) => setNewDay({ ...newDay, facilityId: event.target.value })}
                  >
                    <option value="">Chọn sân</option>
                    {calendar.data?.facilities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ngày mở
                  <input
                    required
                    type="date"
                    value={newDay.date}
                    onChange={(event) => setNewDay({ ...newDay, date: event.target.value })}
                  />
                </label>
              </div>
              <button disabled={busy}>Mở ngày</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
