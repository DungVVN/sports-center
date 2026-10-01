import { MembershipList } from "./MembershipList.jsx";
import "./membership-layout.css";
export function MemberMembershipOverview({
  items,
  loading,
  members,
  onCancel,
  onMemberChange,
  selectedMemberId,
  submitting,
}) {
  return (
    <section className="members-list membership-member-overview">
      <h2>Gói tập theo hội viên</h2>
      <label className="field-inline">
        Hội viên
        <select
          onChange={(event) => void onMemberChange(event.target.value)}
          value={selectedMemberId}
        >
          <option value="">Chọn hội viên để xem gói</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName} — {member.memberCode}
            </option>
          ))}
        </select>
      </label>
      {selectedMemberId && (
        <MembershipList
          embedded
          items={items}
          loading={loading}
          onCancel={onCancel}
          submitting={submitting}
        />
      )}
    </section>
  );
}
