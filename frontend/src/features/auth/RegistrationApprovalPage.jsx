import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../hooks/useMutationFeedback.js";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { authApi } from "./auth-api.js";

export function RegistrationApprovalPage() {
  const client = useQueryClient();
  const feedback = useMutationFeedback();
  const registrationsQuery = useQuery({ queryKey: ["registrations", "pending"], queryFn: authApi.pendingRegistrations });
  const approveRegistration = useSubmitMutation({ feedback, mutationFn: (userId) => authApi.approveRegistration(userId), onSuccess: () => client.invalidateQueries({ queryKey: ["registrations", "pending"] }), successMessage: "Đã duyệt tài khoản hội viên. Hội viên có thể đăng nhập.", errorMessage: "Không thể duyệt tài khoản hội viên." });
  const items = registrationsQuery.data ?? [];
  const registrationsPagination = usePagination(items);
  async function approve(userId) {
    await approveRegistration.mutateAsync(userId).catch(() => {});
  }
  return (
    <main className="members-page">
      <header>
        <p>Đăng ký hội viên</p>
        <h1>Chờ Lễ tân duyệt</h1>
      </header>
      {(feedback.error || registrationsQuery.isError) && (
        <p className="auth-alert" role="alert">
          {feedback.error || registrationsQuery.error.message}
        </p>
      )}
      {feedback.notice && (
        <p className="auth-success" role="status">
          {feedback.notice}
        </p>
      )}
      <section className="members-list">
        <div className="list-heading">
          <h2>Tài khoản chờ duyệt</h2>
          <Button onClick={registrationsQuery.refetch} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {registrationsQuery.isLoading ? (
          <p>Đang tải…</p>
        ) : items.length === 0 ? (
          <p>Không có đăng ký chờ duyệt.</p>
        ) : (
          <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã tài khoản</th>
                  <th>Hội viên</th>
                  <th>Email</th>
                  <th>Số điện thoại</th>
                  <th>Thời điểm đăng ký</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {registrationsPagination.pageItems.map((item) => (
                  <tr key={item.user.id}>
                    <td><code>{item.user.id}</code></td>
                    <td>
                      <strong>
                        {item.member?.full_name ?? item.user.display_name}
                      </strong>
                    </td>
                    <td>{item.user.email}</td>
                    <td>{item.member?.phone ?? "—"}</td>
                    <td>
                      {item.user.created_at
                        ? new Date(item.user.created_at).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                    <td>
                      <Button
                        loading={approveRegistration.isPending && approveRegistration.variables === item.user.id}
                        onClick={() => approve(item.user.id)}
                        size="sm"
                      >
                        Duyệt tài khoản
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...registrationsPagination} />
          </>
        )}
      </section>
    </main>
  );
}
