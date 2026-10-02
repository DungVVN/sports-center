import { useEffect, useState } from "react";
import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { usePtWorkspace } from "../api/usePtWorkspace.js";
import { PtPackageForm } from "./PtForms.jsx";
import { PtPackageCatalog } from "./PtPackageCatalog.jsx";
import { PtPurchaseList } from "./PtPurchaseList.jsx";
import { money } from "../domain/pt-display.js";
import "./pt.css";
export function PtPage({ session, onNavigate }) {
  const {
    packages,
    purchases,
    resources,
    canManage,
    canPurchase,
    canComplete,
    mutation,
  } = usePtWorkspace(session);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState(null);
  async function submit(operation) {
    setNotice("");
    try {
      const result = await mutation.mutateAsync(operation);
      if (operation.action === "payment") setPayment(result);
      setNotice("Đã lưu thao tác PT.");
      return true;
    } catch {
      return false;
    }
  }
  return (
    <main className="members-page pt-page">
      <PageHeader eyebrow="Huấn luyện" title="Huấn luyện cá nhân" />
      {notice && <p role="status">{notice}</p>}
      {mutation.isError && (
        <p role="alert">
          {errorMessageFor(mutation.error, "Không xử lý được PT.")}
        </p>
      )}
      {[packages, purchases, resources].map(
        (query, index) =>
          query.isError && (
            <p key={index} role="alert">
              {errorMessageFor(query.error, "Không tải được dữ liệu PT.")}{" "}
              <Button onClick={() => query.refetch()}>Thử lại</Button>
            </p>
          ),
      )}
      {(packages.isPending || purchases.isPending) && (
        <p role="status">Đang tải PT...</p>
      )}
      <div className="pt-workspace">
        {canManage && (
          <PtPackageForm onSubmit={submit} pending={mutation.isPending} />
        )}
        <PtPackageCatalog
          packages={packages}
          canManage={canManage}
          canPurchase={canPurchase}
          mutation={mutation}
          onSubmit={submit}
        />
      </div>
      <PtPurchaseList
        purchases={purchases}
        resources={resources}
        canManage={canManage}
        canPurchase={canPurchase}
        canComplete={canComplete}
        mutation={mutation}
        clock={clock}
        session={session}
        onNavigate={onNavigate}
        onSubmit={submit}
      />
      {payment && (
        <section aria-label="Thanh toán PT">
          <h2>Giao dịch {payment.transaction_code}</h2>
          <p>
            {money(payment.amountVnd)} · Chỉ cấp quyền khi thanh toán được xác
            nhận.
          </p>
          {payment.checkoutUrl && (
            <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">
              Mở thanh toán PayOS
            </a>
          )}
          {onNavigate && (
            <Button onClick={() => onNavigate("my-payments")}>
              Xem phiếu thu
            </Button>
          )}
        </section>
      )}
    </main>
  );
}
