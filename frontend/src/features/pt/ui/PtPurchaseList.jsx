import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { hasSessionPermission } from "../../auth/index.js";
import { money, time, labels } from "../domain/pt-display.js";
import { PtBookingForm, PtDecisionForm } from "./PtForms.jsx";
export function PtPurchaseList({
  purchases,
  resources,
  canManage,
  canPurchase,
  canComplete,
  mutation,
  clock,
  session,
  onNavigate,
  onSubmit: submit,
}) {
  const [coaches, setCoaches] = useState({});
  return (
    <section className="pt-purchases" aria-label="Gói PT trong phạm vi">
      <h2>{canPurchase ? "PT của tôi" : "Gói PT và lịch phụ trách"}</h2>
      {(purchases.data ?? []).map((purchase) => (
        <article key={purchase.id} className="pt-card">
          <h3>{purchase.package_name_snapshot}</h3>
          <p>
            {purchase.status === "active" &&
            new Date(purchase.expires_at) <= clock
              ? "Hết hạn"
              : labels[purchase.status]}{" "}
            · {money(purchase.priceVnd)}
          </p>
          <p>
            Đã dùng: {purchase.usedSessions}; chưa dùng/chưa đặt:{" "}
            {purchase.remainingSessions}/{purchase.session_count_snapshot}. Hết
            hạn: {time(purchase.expires_at)}.
          </p>
          <p>
            Coach:{" "}
            {resources.data?.coaches.find(
              (coach) => coach.id === purchase.coach_user_id,
            )?.display_name ?? "Chờ trung tâm phân công"}
          </p>
          {canPurchase && purchase.status === "pending_payment" && (
            <Button
              loading={mutation.isPending}
              onClick={() =>
                submit({
                  action: "cancelPurchase",
                  id: purchase.id,
                })
              }
            >
              Hủy đăng ký PT chưa thanh toán
            </Button>
          )}
          {canPurchase &&
            purchase.status === "pending_payment" &&
            ["bank_transfer", "online"].map((method) => (
              <Button
                key={method}
                loading={mutation.isPending}
                onClick={() =>
                  submit({
                    action: "payment",
                    id: purchase.id,
                    input: {
                      method,
                    },
                  })
                }
              >
                {method === "online"
                  ? "Thanh toán PayOS"
                  : "Lập thanh toán chuyển khoản"}
              </Button>
            ))}
          {canManage && purchase.status === "active" && (
            <form
              className="pt-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit({
                  action: "assign",
                  id: purchase.id,
                  input: {
                    coachUserId: coaches[purchase.id],
                  },
                });
              }}
            >
              <label>
                Phân công coach
                <select
                  required
                  value={coaches[purchase.id] ?? ""}
                  onChange={(event) =>
                    setCoaches({
                      ...coaches,
                      [purchase.id]: event.target.value,
                    })
                  }
                >
                  <option value="">Chọn coach</option>
                  {(resources.data?.coaches ?? []).map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" loading={mutation.isPending}>
                Lưu coach
              </Button>
            </form>
          )}
          {canPurchase &&
            purchase.status === "active" &&
            purchase.coach_user_id &&
            purchase.remainingSessions > 0 &&
            new Date(purchase.expires_at) > clock && (
              <PtBookingForm
                purchase={purchase}
                rooms={resources.data?.rooms ?? []}
                onSubmit={submit}
                pending={mutation.isPending}
              />
            )}
          <ul>
            {purchase.appointments.map((appointment) => (
              <li key={appointment.id}>
                <strong>{time(appointment.session?.starts_at)}</strong> ·{" "}
                {labels[appointment.status]}
                {appointment.reason && <p>{appointment.reason}</p>}
                {appointment.status === "scheduled" && (
                  <PtDecisionForm
                    appointment={appointment}
                    canCancel={canPurchase || canManage}
                    canComplete={canComplete}
                    onSubmit={submit}
                    pending={mutation.isPending}
                  />
                )}
              </li>
            ))}
          </ul>
          {canPurchase &&
            hasSessionPermission(session, "training.self.read") &&
            onNavigate && (
              <Button variant="ghost" onClick={() => onNavigate("my-training")}>
                Xem tiến độ tập luyện
              </Button>
            )}
        </article>
      ))}
      {!purchases.isPending &&
        !purchases.isError &&
        !purchases.data?.length && <p>Chưa có gói PT trong phạm vi của bạn.</p>}
    </section>
  );
}
