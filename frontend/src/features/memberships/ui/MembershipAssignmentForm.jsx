import { Button } from "../../../shared/ui/Button.jsx";
export function MembershipAssignmentForm({
  changeMembershipField,
  createMembership,
  members,
  membershipErrors,
  membershipExpiresOn,
  membershipForm,
  membershipTouched,
  packages,
  selectedMembershipMember,
  selectedPackage,
  submitting,
}) {
  return (
    <form className="members-form" onSubmit={createMembership} noValidate>
      <h2>Tạo gói cho hội viên</h2>
      <label>
        Hội viên
        <select
          aria-invalid={Boolean(
            membershipTouched.memberId && membershipErrors.memberId,
          )}
          className={
            membershipTouched.memberId && membershipErrors.memberId
              ? "input-error"
              : ""
          }
          onChange={(event) =>
            changeMembershipField("memberId", event.target.value)
          }
          required
          value={membershipForm.memberId}
        >
          <option value="">Chọn hội viên</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName} — {member.memberCode}
            </option>
          ))}
        </select>
        {membershipTouched.memberId && membershipErrors.memberId && (
          <span className="field-error">{membershipErrors.memberId}</span>
        )}
      </label>
      <section className="selected-member-summary" aria-live="polite">
        <div>
          <span>Thông tin hội viên</span>
          <strong>{selectedMembershipMember?.fullName || "—"}</strong>
        </div>
        <dl>
          <div>
            <dt>Mã hội viên</dt>
            <dd>{selectedMembershipMember?.memberCode || "—"}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>{selectedMembershipMember?.phone || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedMembershipMember?.email || "—"}</dd>
          </div>
        </dl>
      </section>
      <label>
        Gói tập
        <select
          aria-invalid={Boolean(
            membershipTouched.packageId && membershipErrors.packageId,
          )}
          className={
            membershipTouched.packageId && membershipErrors.packageId
              ? "input-error"
              : ""
          }
          onChange={(event) =>
            changeMembershipField("packageId", event.target.value)
          }
          required
          value={membershipForm.packageId}
        >
          <option value="">Chọn gói</option>
          {packages
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {Number(item.priceVnd).toLocaleString("vi-VN")} ₫
              </option>
            ))}
        </select>
        {membershipTouched.packageId && membershipErrors.packageId && (
          <span className="field-error">{membershipErrors.packageId}</span>
        )}
      </label>
      <section className="selected-member-summary" aria-live="polite">
        <div>
          <span>Thông tin gói tập</span>
          <strong>{selectedPackage?.name || "—"}</strong>
        </div>
        <dl>
          <div>
            <dt>Mã gói · Hạng</dt>
            <dd>
              {selectedPackage
                ? `${selectedPackage.code} · Hạng ${selectedPackage.tierRank}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Giá</dt>
            <dd>
              {selectedPackage
                ? `${Number(selectedPackage.priceVnd).toLocaleString("vi-VN")} ₫`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Thời hạn</dt>
            <dd>
              {selectedPackage ? `${selectedPackage.durationDays} ngày` : "—"}
            </dd>
          </div>
        </dl>
      </section>
      <label>
        Ngày bắt đầu dự kiến
        <input
          aria-invalid={Boolean(
            membershipTouched.startsOn && membershipErrors.startsOn,
          )}
          className={
            membershipTouched.startsOn && membershipErrors.startsOn
              ? "input-error"
              : ""
          }
          onChange={(event) =>
            changeMembershipField("startsOn", event.target.value)
          }
          required
          type="date"
          value={membershipForm.startsOn}
        />
        {membershipTouched.startsOn && membershipErrors.startsOn && (
          <span className="field-error">{membershipErrors.startsOn}</span>
        )}
      </label>
      <label>
        Ngày hết hạn dự kiến
        <input disabled type="date" value={membershipExpiresOn} />
      </label>
      <Button loading={submitting} type="submit">
        Tạo gói cho hội viên
      </Button>
    </form>
  );
}
