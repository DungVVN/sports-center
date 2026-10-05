import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { hasSessionPermission } from "../../auth/index.js";
import { usePersonalizationWorkspace } from "../api/usePersonalizationWorkspace.js";
import { personalizationApi } from "../api/personalization-api.js";
import { AssessmentForm, AuthorizationForm, ProtocolForm } from "./PersonalizationForms.jsx";
import { PrescriptionDetails } from "./PrescriptionDetails.jsx";
import "./training-personalization.css";

function DecisionForm({ assessments, protocols, run, pending }) {
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <form
      className="members-form training-action-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const result = await run(() =>
          personalizationApi.decision({
            assessmentId: data.assessment,
            protocolId: data.protocol,
            startsOn: dates[0],
            endsOn: dates.at(-1),
            sessionDates: dates,
            idempotencyKey: key,
          }),
        );
        if (result) setKey(crypto.randomUUID());
      }}
    >
      <h3>Tạo giáo án từ quy tắc đã duyệt</h3>
      <p>
        HLV chọn lịch phù hợp đánh giá. Hệ thống kiểm tra từng ngày và tạo nội dung nháp từ dữ liệu nguồn, không tự suy
        ra tần suất tập từ ngày rảnh.
      </p>
      <label>
        Đánh giá đã duyệt
        <select name="assessment" required>
          <option value="">Chọn đánh giá</option>
          {assessments
            .filter((item) => item.status === "reviewed")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.discipline} · v{item.version} · {item.goal}
              </option>
            ))}
        </select>
      </label>
      <label>
        Quy tắc đã duyệt
        <select name="protocol" required>
          <option value="">Chọn quy tắc</option>
          {protocols
            .filter((item) => item.status === "approved")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.discipline} · {item.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Ngày tập
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <Button
        type="button"
        variant="ghost"
        disabled={!date || dates.length >= 100}
        onClick={() => setDates([...new Set([...dates, date])].sort())}
      >
        Thêm ngày tập
      </Button>
      {dates.map((item) => (
        <p key={item}>
          {item}{" "}
          <Button type="button" variant="ghost" onClick={() => setDates(dates.filter((value) => value !== item))}>
            Bỏ ngày
          </Button>
        </p>
      ))}
      <Button type="submit" loading={pending} disabled={!dates.length}>
        Tạo giáo án nháp
      </Button>
    </form>
  );
}

function ObservationForm({ profile, metrics, run, pending }) {
  const [code, setCode] = useState("");
  const metric = metrics.find((item) => item.code === code);
  const sessions = [
    ...new Set(
      profile.decisions
        .filter((item) => item.status === "approved")
        .flatMap((item) => item.prescriptions.map((p) => p.training_session_id)),
    ),
  ];
  return (
    <form
      className="members-form training-action-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        void run(() =>
          personalizationApi.observe(data.session, {
            metricCode: code,
            unit: metric.unit,
            ...(metric.value_type === "numeric" ? { valueNumeric: Number(data.value) } : { valueText: data.value }),
            dataKind: data.kind,
            method: data.method,
            recordedAt: new Date().toISOString(),
          }),
        );
      }}
    >
      <h3>Ghi kết quả thực tế</h3>
      <label>
        Buổi tập
        <select name="session" required>
          <option value="">Chọn buổi</option>
          {sessions.map((id) => (
            <option key={id} value={id}>
              #{id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Chỉ số
        <select required value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Chọn chỉ số</option>
          {metrics.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} ({item.unit})
            </option>
          ))}
        </select>
      </label>
      {metric && (
        <label>
          Giá trị ({metric.unit})
          <input name="value" required step="any" type={metric.value_type === "numeric" ? "number" : "text"} />
        </label>
      )}
      <label>
        Loại dữ liệu
        <select name="kind">
          <option value="observed">Đo/quan sát thực tế</option>
          <option value="self_reported">Hội viên tự báo</option>
          <option value="estimated">Ước tính</option>
        </select>
      </label>
      <label>
        Phương pháp
        <input required name="method" />
      </label>
      <Button type="submit" disabled={!metric} loading={pending}>
        Lưu kết quả
      </Button>
    </form>
  );
}

export function TrainingPersonalizationWorkspace({ members, session }) {
  const [memberId, setMemberId] = useState("");
  const [authorizationId, setAuthorizationId] = useState("");
  const workspace = usePersonalizationWorkspace(memberId);
  const reference = workspace.reference.data;
  const profile = workspace.profile.data;
  const pending = workspace.mutation.isPending;
  const run = async (task) => {
    try {
      return await workspace.mutation.mutateAsync(task);
    } catch {
      return null;
    }
  };
  const canWrite = hasSessionPermission(session, "training.assessment.write");
  const canProtocol = hasSessionPermission(session, "training.protocol.manage");
  return (
    <section className="members-list training-personalization">
      <div className="list-heading">
        <h2>Giáo án cá nhân theo bằng chứng</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void workspace.reference.refetch();
            if (memberId) void workspace.profile.refetch();
          }}
        >
          Tải lại hồ sơ
        </Button>
      </div>
      <p className="training-personalization__intro">
        Mỗi hồ sơ được đánh giá riêng. Nguồn khoa học, giới hạn áp dụng và người duyệt được lưu cùng giáo án.
      </p>
      {workspace.notice && <p role="status">{workspace.notice}</p>}
      {workspace.error && (
        <p role="alert" className="auth-alert">
          {workspace.error}
        </p>
      )}
      <div className="members-form training-personalization__selectors">
        <label>
          Hội viên
          <select aria-label="Hội viên" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Chọn hội viên được phân công</option>
            {members.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name ?? item.display_name ?? item.member_code ?? item.id}
              </option>
            ))}
          </select>
        </label>
        {reference && (
          <label>
            Xác minh chuyên môn dùng để duyệt
            <select
              aria-label="Xác minh chuyên môn dùng để duyệt"
              value={authorizationId}
              onChange={(e) => setAuthorizationId(e.target.value)}
            >
              <option value="">Chọn xác minh của chính bạn</option>
              {reference.authorizations
                .filter(
                  (item) =>
                    item.user_id === session.user.id && !item.revoked_at && new Date(item.expires_at) > new Date(),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.discipline} · {item.credential_reference}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {workspace.reference.isLoading && <p>Đang tải danh mục chuyên môn…</p>}
      {reference && (
        <>
          {!reference.authorizations.length && (
            <p className="training-personalization__notice">
              Chưa có người được xác minh chuyên môn. Có thể soạn nháp; chưa thể duyệt hoặc áp dụng.
            </p>
          )}
          {hasSessionPermission(session, "training.review.authorize") && (
            <details>
              <summary>Xác minh người duyệt</summary>
              <AuthorizationForm users={reference.users} run={run} pending={pending} />
            </details>
          )}
          {hasSessionPermission(session, "training.review.authorize") && (
            <details>
              <summary>Thu hồi xác minh chuyên môn</summary>
              {reference.authorizations
                .filter((item) => !item.revoked_at)
                .map((item) => (
                  <p key={item.id}>
                    {item.discipline} · {item.credential_reference}{" "}
                    <Button loading={pending} onClick={() => void run(() => personalizationApi.revoke(item.id))}>
                      Thu hồi xác minh
                    </Button>
                  </p>
                ))}
            </details>
          )}
          <details>
            <summary>Nguồn bằng chứng và giới hạn</summary>
            {reference.sources.map((item) => (
              <article key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.publisher} · {item.version}
                </a>
                <p>{item.limitations}</p>
              </article>
            ))}
          </details>
          {canProtocol && (
            <details>
              <summary>Soạn quy tắc mới</summary>
              <ProtocolForm sources={reference.sources} metrics={reference.metrics} run={run} pending={pending} />
            </details>
          )}
          <details>
            <summary>Danh mục quy tắc ({reference.protocols.length})</summary>
            {reference.protocols.map((item) => (
              <article key={item.id}>
                <h3>
                  {item.name} · {item.discipline} · {item.status}
                </h3>
                <p>{item.limitations}</p>
                {item.rules.map((rule) => (
                  <p key={rule.id}>{rule.rationale}</p>
                ))}
                {item.status === "draft" && canProtocol && (
                  <Button
                    disabled={!authorizationId}
                    loading={pending}
                    onClick={() => void run(() => personalizationApi.approveProtocol(item.id, authorizationId))}
                  >
                    Duyệt quy tắc
                  </Button>
                )}
                {canProtocol &&
                  item.status !== "retired" &&
                  (session.user.role === "admin" || item.created_by === session.user.id) && (
                    <Button
                      variant="ghost"
                      loading={pending}
                      onClick={() => void run(() => personalizationApi.retire(item.id))}
                    >
                      Ngừng áp dụng quy tắc
                    </Button>
                  )}
              </article>
            ))}
          </details>
          {memberId && workspace.profile.isLoading && <p>Đang tải đánh giá hội viên…</p>}
          {profile && (
            <>
              {canWrite && (
                <details>
                  <summary>Lập đánh giá mới</summary>
                  <AssessmentForm memberId={memberId} metrics={reference.metrics} run={run} pending={pending} />
                </details>
              )}
              {profile.assessments.map((item) => (
                <article key={item.id}>
                  <h3>
                    {item.discipline} · Đánh giá v{item.version} · {item.status}
                  </h3>
                  <p>
                    {item.goal} · {item.minutes_per_session} phút/buổi · review đến{" "}
                    {new Date(item.review_due_at).toLocaleDateString("vi-VN")}
                  </p>
                  {item.findings.map((finding) => (
                    <p key={finding.id}>{finding.description}</p>
                  ))}
                  {item.measurements.map((m) => (
                    <p key={m.id}>
                      {m.metric_code}: {m.value_numeric ?? m.value_text} {m.unit} · {m.data_kind} · {m.method}
                    </p>
                  ))}
                  {item.status === "draft" && canWrite && (
                    <Button
                      disabled={!authorizationId}
                      loading={pending}
                      onClick={() => void run(() => personalizationApi.reviewAssessment(item.id, authorizationId))}
                    >
                      Duyệt đánh giá
                    </Button>
                  )}
                </article>
              ))}
              {canWrite && (
                <details>
                  <summary>Tạo lịch và giáo án cá nhân</summary>
                  <DecisionForm
                    assessments={profile.assessments}
                    protocols={reference.protocols}
                    run={run}
                    pending={pending}
                  />
                </details>
              )}
              {profile.decisions.map((item) => (
                <article key={item.id}>
                  <h3>{item.protocol.name}</h3>
                  <PrescriptionDetails decision={item} />
                  {item.status === "draft" && canWrite && (
                    <Button
                      disabled={!authorizationId}
                      loading={pending}
                      onClick={() => void run(() => personalizationApi.approveDecision(item.id, authorizationId))}
                    >
                      Duyệt để áp dụng cho hội viên
                    </Button>
                  )}
                  {item.status === "approved" &&
                    canWrite &&
                    item.sessions?.map((sessionItem) => (
                      <form
                        key={sessionItem.id}
                        className="members-form training-action-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = Object.fromEntries(new FormData(event.currentTarget));
                          void run(() =>
                            personalizationApi.outcome(sessionItem.id, {
                              status: data.status,
                              coachComment: data.comment,
                            }),
                          );
                        }}
                      >
                        <p>
                          Buổi {sessionItem.position} · {sessionItem.status}
                        </p>
                        {sessionItem.status === "pending" && (
                          <>
                            <label>
                              Kết quả buổi
                              <select name="status">
                                <option value="completed">Hoàn thành sau review check-in</option>
                                <option value="skipped">Không thực hiện</option>
                              </select>
                            </label>
                            <label>
                              Nhận xét HLV
                              <input name="comment" required />
                            </label>
                            <Button type="submit" loading={pending}>
                              Lưu kết quả buổi
                            </Button>
                          </>
                        )}
                      </form>
                    ))}
                </article>
              ))}
              <details>
                <summary>Check-in cần theo dõi</summary>
                {profile.checkins.map((item) => (
                  <article key={item.id}>
                    <p>
                      {String(item.session_date).slice(0, 10)} · {item.available_minutes} phút · {item.review_status}
                    </p>
                    <p>
                      {item.new_symptoms
                        ? "Có triệu chứng mới — cần tạm dừng và xử lý chuyên môn"
                        : "Không báo triệu chứng mới"}{" "}
                      · {item.notes}
                    </p>
                    {canWrite && item.review_status === "pending" && (
                      <>
                        <Button
                          loading={pending}
                          onClick={() => void run(() => personalizationApi.reviewCheckin(item.id, "hold"))}
                        >
                          Tạm dừng để xử lý
                        </Button>
                        <Button
                          disabled={item.new_symptoms}
                          loading={pending}
                          onClick={() => void run(() => personalizationApi.reviewCheckin(item.id, "reviewed"))}
                        >
                          Đã xem và xử lý
                        </Button>
                      </>
                    )}
                  </article>
                ))}
              </details>
              {canWrite && (
                <details>
                  <summary>Ghi kết quả buổi tập</summary>
                  <ObservationForm profile={profile} metrics={reference.metrics} run={run} pending={pending} />
                </details>
              )}
              <details>
                <summary>Kết quả và nhật ký năng lượng đã ghi</summary>
                {profile.observations.map((item) => (
                  <p key={item.id}>
                    {item.metric_code}: {item.value_numeric ?? item.value_text} {item.unit} · {item.data_kind} ·{" "}
                    {item.method}
                  </p>
                ))}
                {profile.energy.map((item) => (
                  <p key={item.id}>
                    {String(item.recorded_on).slice(0, 10)}: {item.value_kcal} kcal · {item.energy_type} ·{" "}
                    {item.data_kind} · {item.method}
                  </p>
                ))}
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
