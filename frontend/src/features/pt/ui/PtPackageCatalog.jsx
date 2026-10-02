import { Button } from "../../../shared/ui/Button.jsx";
import { money } from "../domain/pt-display.js";
export function PtPackageCatalog({
  packages,
  canManage,
  canPurchase,
  mutation,
  onSubmit: submit,
}) {
  return (
    <section aria-label="Danh mục PT" className="pt-catalog">
      <header className="pt-catalog__header">
        <h2>Danh sách gói PT</h2>
        {packages.data && <span>{packages.data.length} gói</span>}
      </header>
      <div className="pt-grid">
      {(packages.data ?? []).map((pack) => (
        <article className="pt-card" key={pack.id}>
          <h2>{pack.name}</h2>
          {canManage && <span className={`pt-package-status${pack.is_active ? " pt-package-status--active" : ""}`}>{pack.is_active ? "Đang mở bán" : "Đã dừng bán"}</span>}
          <p>
            {money(pack.priceVnd)} · {pack.session_count} buổi ·{" "}
            {pack.duration_days} ngày từ khi kích hoạt
          </p>
          <p>
            {pack.session_minutes} phút/buổi · Hủy trước{" "}
            {pack.cancellation_hours} giờ
          </p>
          {canManage && (
            <Button
              loading={mutation.isPending}
              onClick={() =>
                submit({
                  action: "setPackageActive",
                  id: pack.id,
                  input: {
                    isActive: !pack.is_active,
                  },
                })
              }
            >
              {pack.is_active ? "Dừng bán gói" : "Mở bán gói"}
            </Button>
          )}
          {canPurchase && (
            <Button
              loading={mutation.isPending}
              onClick={() =>
                submit({
                  action: "buy",
                  id: pack.id,
                })
              }
            >
              Mua gói PT
            </Button>
          )}
        </article>
      ))}
      {!packages.isPending && !packages.isError && !packages.data?.length && (
        <p className="pt-catalog__empty">Chưa có gói PT.</p>
      )}
      </div>
    </section>
  );
}
