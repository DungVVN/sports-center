import { useState } from "react";
import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { useCourseWorkspace } from "../api/useCourseWorkspace.js";
import {
  courseLabels,
  coursePrice,
  courseTime,
} from "../domain/course-display.js";
import { CourseCreateForm, CourseSessionForm } from "./CourseForms.jsx";
import "./courses.css";
export function CoursesPage({ session, onNavigate }) {
  const workspace = useCourseWorkspace(session);
  const {
    courses,
    enrollments,
    rooms,
    coaches,
    canManage,
    canEnroll,
    mutation,
  } = workspace;
  const [notice, setNotice] = useState("");
  const [payment, setPayment] = useState(null);
  const [editing, setEditing] = useState(null);
  async function submit(operation) {
    setNotice("");
    try {
      const result = await mutation.mutateAsync(operation);
      if (operation.action === "payment") setPayment(result);
      setNotice(
        operation.action === "payment"
          ? "Đã tạo giao dịch. Quyền học chỉ được kích hoạt sau khi thanh toán được xác nhận."
          : "Đã lưu thao tác khóa học.",
      );
      return true;
    } catch {
      return false;
    }
  }
  return (
    <main className="members-page courses-page">
      <PageHeader eyebrow="Khóa học" title="Khóa có hướng dẫn" />
      {notice && <p role="status">{notice}</p>}
      {mutation.isError && (
        <p role="alert">
          {errorMessageFor(mutation.error, "Không thể xử lý khóa học.")}
        </p>
      )}
      <div className={`course-workspace${canManage ? " course-workspace--manage" : ""}`}>
        {canManage && <CourseCreateForm mutation={mutation} onSubmit={submit} />}
        <section className="course-catalog" aria-label="Danh sách khóa học">
          <header className="course-catalog__header">
            <h2>Danh sách khóa học</h2>
            {courses.data && <span>{courses.data.length} khóa</span>}
          </header>
          {courses.isPending && <p role="status">Đang tải khóa học...</p>}
          {courses.isError && (
            <p role="alert">
              {errorMessageFor(courses.error, "Không tải được khóa.")}{" "}
              <Button onClick={() => courses.refetch()}>Thử lại</Button>
            </p>
          )}
          {!courses.isPending && !courses.isError && !courses.data?.length && (
            <p className="course-catalog__empty">Chưa có khóa học được mở.</p>
          )}
          <div className="course-grid">
            {(courses.data ?? []).map((course) => (
              <article key={course.id} className="course-card">
                <h2>{course.name}</h2>
                <p>{course.description}</p>
                <p>
                  {coursePrice(course.priceVnd)} · {courseLabels[course.status]} ·{" "}
                  {course.reservedSeats}/{course.capacity} chỗ đã giữ
                </p>
                <ul>
                  {course.sessions.map((item) => (
                    <li key={item.id}>
                      {item.name} · {courseTime(item.starts_at)}–
                      {courseTime(item.ends_at)} ·{" "}
                      {courseLabels[item.status] ?? item.status}
                    </li>
                  ))}
                </ul>
                {canManage && course.status === "published" && (
                  <Button
                    loading={mutation.isPending}
                    onClick={() =>
                      submit({
                        action: "complete",
                        id: course.id,
                      })
                    }
                  >
                    Chốt khóa đã kết thúc
                  </Button>
                )}
                {canEnroll && (
                  <Button
                    loading={mutation.isPending}
                    disabled={
                      course.reservedSeats >= course.capacity ||
                      enrollments.isPending ||
                      enrollments.isError ||
                      (enrollments.data ?? []).some(
                        (item) =>
                          item.course_id === course.id &&
                          item.status !== "cancelled",
                      )
                    }
                    onClick={() =>
                      submit({
                        action: "enroll",
                        id: course.id,
                      })
                    }
                  >
                    Đăng ký trọn khóa
                  </Button>
                )}
                {canManage && course.status === "draft" && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setEditing(editing === course.id ? null : course.id)
                      }
                    >
                      Thêm lịch học
                    </Button>
                    <Button
                      loading={mutation.isPending}
                      disabled={!course.sessions.length}
                      onClick={() =>
                        submit({
                          action: "publish",
                          id: course.id,
                        })
                      }
                    >
                      Công bố khóa và lịch
                    </Button>
                    {editing === course.id &&
                      (rooms.isError || coaches.isError ? (
                        <p role="alert">
                          Không tải được phòng/coach.{" "}
                          <Button
                            onClick={() => {
                              void rooms.refetch();
                              void coaches.refetch();
                            }}
                          >
                            Thử lại nguồn lực
                          </Button>
                        </p>
                      ) : (
                        <CourseSessionForm
                          course={course}
                          rooms={rooms.data ?? []}
                          coaches={coaches.data ?? []}
                          mutation={mutation}
                          onSubmit={submit}
                        />
                      ))}
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
      {enrollments.isPending && enrollments.fetchStatus !== "idle" && (
        <p role="status">Đang tải đăng ký...</p>
      )}
      {enrollments.isError && (
        <p role="alert">
          {errorMessageFor(enrollments.error, "Không tải được đăng ký.")}{" "}
          <Button onClick={() => enrollments.refetch()}>Thử lại đăng ký</Button>
        </p>
      )}
      {enrollments.data && (
        <section className="course-enrollments" aria-label="Đăng ký khóa học">
          <h2>{canEnroll ? "Khóa của tôi" : "Đăng ký khóa học"}</h2>
          {enrollments.data.length ? (
            enrollments.data.map((item) => (
              <article className="course-card" key={item.id}>
                <h3>{item.course?.name}</h3>
                <p>
                  {courseLabels[item.status]} · {coursePrice(item.priceVnd)}
                </p>
                {item.payment_expires_at &&
                  item.status === "pending_payment" && (
                    <p>
                      Giữ chỗ đến{" "}
                      {new Date(item.payment_expires_at).toLocaleString(
                        "vi-VN",
                        {
                          timeZone: "Asia/Ho_Chi_Minh",
                        },
                      )}
                    </p>
                  )}
                {item.cancellation_reason && <p>{item.cancellation_reason}</p>}
                {canEnroll && item.status === "pending_payment" && (
                  <>
                    <Button
                      loading={mutation.isPending}
                      onClick={() =>
                        submit({
                          action: "payment",
                          id: item.id,
                          input: {
                            method: "bank_transfer",
                          },
                        })
                      }
                    >
                      Lập thanh toán chuyển khoản
                    </Button>
                    <Button
                      variant="secondary"
                      loading={mutation.isPending}
                      onClick={() =>
                        submit({
                          action: "payment",
                          id: item.id,
                          input: {
                            method: "online",
                          },
                        })
                      }
                    >
                      Thanh toán PayOS
                    </Button>
                    <Button
                      variant="ghost"
                      loading={mutation.isPending}
                      onClick={() =>
                        submit({
                          action: "cancel",
                          id: item.id,
                        })
                      }
                    >
                      Hủy đăng ký chưa thanh toán
                    </Button>
                  </>
                )}
                {canEnroll && item.status === "active" && onNavigate && (
                  <Button onClick={() => onNavigate("bookings")}>
                    Xem lịch học
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p>Chưa có đăng ký khóa học.</p>
          )}
        </section>
      )}
      {payment && (
        <section aria-label="Giao dịch khóa học">
          <h2>Giao dịch {payment.transaction_code}</h2>
          <p>
            Số tiền: {coursePrice(payment.amountVnd)}. Xem hướng dẫn chuyển
            khoản và trạng thái trong Thanh toán của tôi.
          </p>
          {payment.checkoutUrl && (
            <a href={payment.checkoutUrl} target="_blank" rel="noreferrer">
              Mở trang thanh toán PayOS
            </a>
          )}
          {onNavigate && (
            <Button onClick={() => onNavigate("my-payments")}>
              Xem thanh toán của tôi
            </Button>
          )}
        </section>
      )}
    </main>
  );
}
