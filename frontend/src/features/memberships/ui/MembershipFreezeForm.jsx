import { Button } from "../../../shared/ui/Button.jsx";
export function MembershipFreezeForm({
  changeFreezeField,
  freezeErrors,
  freezeForm,
  freezeTouched,
  memberships,
  requestFreeze,
  submitting,
}) {
  return (
    <form className="members-form" onSubmit={requestFreeze} noValidate>
      <h2>Yêu cầu đóng băng</h2>
      <label>
        Gói tập
        <select
          aria-invalid={Boolean(
            freezeTouched.membershipId && freezeErrors.membershipId,
          )}
          className={
            freezeTouched.membershipId && freezeErrors.membershipId
              ? "input-error"
              : ""
          }
          onChange={(event) =>
            changeFreezeField("membershipId", event.target.value)
          }
          required
          value={freezeForm.membershipId}
        >
          <option value="">Chọn gói đang hoạt động</option>
          {memberships
            .filter((item) => item.status === "active")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.package_name_snapshot} — hết hạn{" "}
                {new Date(item.expires_on).toLocaleDateString("vi-VN")}
              </option>
            ))}
        </select>
        {freezeTouched.membershipId && freezeErrors.membershipId && (
          <span className="field-error">{freezeErrors.membershipId}</span>
        )}
      </label>
      <label>
        Ngày bắt đầu
        <input
          aria-invalid={Boolean(
            freezeTouched.startsOn && freezeErrors.startsOn,
          )}
          className={
            freezeTouched.startsOn && freezeErrors.startsOn ? "input-error" : ""
          }
          onChange={(event) =>
            changeFreezeField("startsOn", event.target.value)
          }
          required
          type="date"
          value={freezeForm.startsOn}
        />
        {freezeTouched.startsOn && freezeErrors.startsOn && (
          <span className="field-error">{freezeErrors.startsOn}</span>
        )}
      </label>
      <label>
        Ngày kết thúc
        <input
          aria-invalid={Boolean(freezeTouched.endsOn && freezeErrors.endsOn)}
          className={
            freezeTouched.endsOn && freezeErrors.endsOn ? "input-error" : ""
          }
          onChange={(event) => changeFreezeField("endsOn", event.target.value)}
          required
          type="date"
          value={freezeForm.endsOn}
        />
        {freezeTouched.endsOn && freezeErrors.endsOn && (
          <span className="field-error">{freezeErrors.endsOn}</span>
        )}
      </label>
      <label>
        Lý do
        <textarea
          aria-invalid={Boolean(freezeTouched.reason && freezeErrors.reason)}
          className={
            freezeTouched.reason && freezeErrors.reason ? "input-error" : ""
          }
          minLength="3"
          onChange={(event) => changeFreezeField("reason", event.target.value)}
          required
          value={freezeForm.reason}
        />
        {freezeTouched.reason && freezeErrors.reason && (
          <span className="field-error">{freezeErrors.reason}</span>
        )}
      </label>
      <Button loading={submitting} type="submit">
        Gửi yêu cầu
      </Button>
    </form>
  );
}
