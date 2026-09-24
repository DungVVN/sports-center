import { useMemo, useState } from "react";
import { usePagination } from "../../components/ui/usePagination.js";
import { CoachAssignmentDialog } from "./dialogs/CoachAssignmentDialog.jsx";
import { MemberEditorDialog } from "./dialogs/MemberEditorDialog.jsx";
import { MemberCreateForm } from "./forms/MemberCreateForm.jsx";
import { useMembersWorkspace } from "./hooks/useMembersWorkspace.js";
import { MembersTable } from "./tables/MembersTable.jsx";

const emptyMember = { fullName: "", email: "", phone: "" };

export function MembersPage({ readOnly = false }) {
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [assignmentMember, setAssignmentMember] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [search, setSearch] = useState("");
  const [coachFilters, setCoachFilters] = useState([]);
  const [packageFilters, setPackageFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const workspace = useMembersWorkspace({ assignmentMemberId: assignmentMember?.id, editingMemberId });
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi-VN");
    return workspace.members.filter((member) => (!coachFilters.length || coachFilters.includes(member.coachName ?? "__unassigned")) && (!packageFilters.length || packageFilters.includes(member.registeredPackageName ?? "__unregistered")) && (!statusFilters.length || statusFilters.includes(member.membershipStatus ?? "__no_membership")) && (!query || [member.fullName, member.email, member.phone, member.memberCode].filter(Boolean).some((value) => value.toLocaleLowerCase("vi-VN").includes(query))));
  }, [coachFilters, packageFilters, search, statusFilters, workspace.members]);
  const pagination = usePagination(visibleMembers);
  const toggleFilterValue = (kind, value) => ({ coach: setCoachFilters, package: setPackageFilters, status: setStatusFilters }[kind])((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const clearFilters = () => { setSearch(""); setCoachFilters([]); setPackageFilters([]); setStatusFilters([]); };
  const create = (event) => { event.preventDefault(); workspace.createMember.mutate(memberForm, { onSuccess: () => setMemberForm(emptyMember) }); };
  const assign = async (input) => {
    if (!assignmentMember) return;
    try {
      await workspace.assignCoach.mutateAsync({ memberId: assignmentMember.id, input });
      setAssignmentMember(null);
    } catch {
      // Feedback is rendered from the shared mutation hook; keep the dialog open for correction.
    }
  };
  const save = async (form) => {
    if (!editingMemberId) return;
    try {
      await workspace.saveMember.mutateAsync({ memberId: editingMemberId, input: { fullName: form.fullName, email: form.email || null, phone: form.phone }, contacts: form.contacts });
      setEditingMemberId(null);
    } catch {
      // Feedback is rendered from the shared mutation hook; keep the dialog open for correction.
    }
  };
  return <main className="members-page"><header><p>Hội viên</p><h1>Quản lý hội viên</h1></header>
    {workspace.error && <p className="auth-alert" role="alert">{workspace.error}</p>}{workspace.notice && <p className="auth-success" role="status">{workspace.notice}</p>}
    <section className="members-workspace-stacked">{!readOnly && <MemberCreateForm form={memberForm} onChange={(event) => setMemberForm((current) => ({ ...current, [event.target.name]: event.target.value }))} onSubmit={create} submitting={workspace.createMember.isPending} />}<MembersTable filters={{ coach: coachFilters, isOpen: isFilterOpen, package: packageFilters, search, status: statusFilters }} loading={workspace.loading} members={workspace.members} onEdit={(member) => setEditingMemberId(member.id)} onFilterToggle={() => setIsFilterOpen((value) => !value)} onOpenAssignment={setAssignmentMember} onReload={workspace.reload} onSearchChange={setSearch} onToggleFilterValue={toggleFilterValue} onClearFilters={clearFilters} pagination={pagination} readOnly={readOnly} visibleMembers={visibleMembers} /></section>
    <CoachAssignmentDialog coaches={workspace.coaches} history={workspace.assignmentHistory} loading={workspace.assignmentLoading} member={assignmentMember} onClose={() => setAssignmentMember(null)} onSubmit={assign} />
    <MemberEditorDialog detail={workspace.detail} loading={workspace.detailLoading} memberId={editingMemberId} onClose={() => setEditingMemberId(null)} onSubmit={save} />
  </main>;
}
