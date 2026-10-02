import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { facilityApi } from "../api/facility-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

function RentalConfiguration({ facility, rooms, busy, perform }) {
  const [rate, setRate] = useState(facility.hourlyRateVnd ?? "");
  const [roomId, setRoomId] = useState(facility.room_id ?? "");
  return <form className="facility-calendar__fields" onSubmit={(event) => {
    event.preventDefault();
    void perform(() => facilityApi.configure(facility.id, { hourlyRateVnd: rate, roomId: roomId || null }), "Đã lưu giá và phòng dùng chung. Đơn đã duyệt giữ nguyên giá.");
  }}>
    <strong>{facility.name}</strong>
    <label>Đơn giá mỗi giờ (đ)<input required type="number" min="0" max="999999999999" step="1" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
    <label>Phòng vật lý dùng chung<select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Sân độc lập</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
    <button disabled={busy}>Lưu cấu hình</button>
  </form>;
}

export function RentalSettings({ busy, perform }) {
  const settings = useQuery({ queryKey: ["facility-settings"], queryFn: facilityApi.settings });
  return <section className="facility-calendar__panel" aria-label="Giá thuê và phòng dùng chung">
    <h3>Giá thuê và phòng dùng chung</h3>
    <p>Cấu hình đơn giá trước khi duyệt đơn mới. Tính theo số phút sử dụng, làm tròn lên một đồng. Chọn phòng dùng chung để chặn trùng với lớp và PT.</p>
    {settings.isPending && <p role="status">Đang tải cấu hình...</p>}
    {settings.isError && <p role="alert">{errorMessageFor(settings.error, "Không tải được cấu hình.")} <button onClick={() => settings.refetch()}>Thử lại</button></p>}
    {settings.data?.facilities.map((facility) => <RentalConfiguration key={`${facility.id}-${facility.hourlyRateVnd}-${facility.room_id}`} facility={facility} rooms={settings.data.rooms} busy={busy} perform={perform} />)}
    {settings.data?.facilities.length === 0 && <p>Thêm sân/phòng để cấu hình giá thuê.</p>}
  </section>;
}
