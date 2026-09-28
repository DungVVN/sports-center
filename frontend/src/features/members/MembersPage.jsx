import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { CoachAssignmentDialog } from "./dialogs/CoachAssignmentDialog.jsx";
import { MemberEditorDialog } from "./dialogs/MemberEditorDialog.jsx";
import { MemberCreateForm } from "./forms/MemberCreateForm.jsx";
import { useMembersWorkspace } from "./hooks/useMembersWorkspace.js";
import { useToast } from "../../contexts/useToast.js";
import { MembersTable } from "./tables/MembersTable.jsx";

const emptyMember = { fullName: "", email: "", phone: "", createAccount: true };

export function MembersPage({ readOnly = false }) {
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [assignmentMember, setAssignmentMember] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [search, setSearch] = useState("");
  const [coachFilters, setCoachFilters] = useState([]);
  const [packageFilters, setPackageFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const showToast = useToast();
  const workspace = useMembersWorkspace({ assignmentMemberId: assignmentMember?.id, editingMemberId });
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi-VN");
    return workspace.members.filter((member) => (!coachFilters.length || coachFilters.includes(member.coachName ?? "__unassigned")) && (!packageFilters.length || packageFilters.includes(member.registeredPackageName ?? "__unregistered")) && (!statusFilters.length || statusFilters.includes(member.membershipStatus ?? "__no_membership")) && (!query || [member.fullName, member.email, member.phone, member.memberCode].filter(Boolean).some((value) => value.toLocaleLowerCase("vi-VN").includes(query))));
  }, [coachFilters, packageFilters, search, statusFilters, workspace.members]);
  const pagination = usePagination(visibleMembers);
  const toggleFilterValue = (kind, value) => ({ coach: setCoachFilters, package: setPackageFilters, status: setStatusFilters }[kind])((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  const clearFilters = () => { setSearch(""); setCoachFilters([]); setPackageFilters([]); setStatusFilters([]); };
  const updateMemberForm = (event) => {
    const { checked, name, type, value } = event.target;
    setMemberForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };
  const create = (event) => {
    event.preventDefault();
    setCredentials(null);
    workspace.createMember.mutate(memberForm, { onSuccess: (result) => {
      setCredentials(result.temporaryPassword ? { email: result.email, password: result.temporaryPassword } : null);
      setMemberForm(emptyMember);
    } });
  };
  const copyPassword = async () => {
    if (!credentials?.password) return;
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopiedPassword(true);
      showToast?.("Đã sao chép mật khẩu tạm thời.", "success");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      showToast?.("Không thể sao chép mật khẩu. Vui lòng chọn và sao chép thủ công từ ô đang hiển thị.", "error");
    }
  };
  const issueAccountCredentials = (member) => {
    const action = member.hasAccount ? "gửi mật khẩu tạm mới" : "tạo tài khoản và gửi mật khẩu tạm";
    if (!window.confirm(`Bạn có chắc muốn ${action} cho ${member.fullName}?`)) return;
    setCredentials(null);
    workspace.issueAccountCredentials.mutate(member.id, { onSuccess: (result) => {
      setCredentials(result.temporaryPassword ? { email: member.email, password: result.temporaryPassword } : null);
    } });
  };
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
    {credentials && <section className="member-credentials"><strong>Mật khẩu tạm thời — chỉ hiển thị lần này</strong><div><code>{credentials.password}</code><Button onClick={copyPassword} size="sm" type="button" variant="outline">{copiedPassword ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copiedPassword ? "Đã sao chép!" : "Sao chép"}</Button></div><p>Email chưa gửi được. Hãy gửi riêng thông tin đăng nhập đến {credentials.email}; mật khẩu này không được lưu hoặc hiển thị lại.</p><Button onClick={() => setCredentials(null)} type="button" variant="secondary">Đã lưu an toàn</Button></section>}
    <section className="members-workspace-stacked">{!readOnly && <MemberCreateForm form={memberForm} onChange={updateMemberForm} onSubmit={create} submitting={workspace.createMember.isPending} />}<MembersTable filters={{ coach: coachFilters, isOpen: isFilterOpen, package: packageFilters, search, status: statusFilters }} loading={workspace.loading} members={workspace.members} onEdit={(member) => setEditingMemberId(member.id)} onFilterToggle={() => setIsFilterOpen((value) => !value)} onIssueAccountCredentials={issueAccountCredentials} onOpenAssignment={setAssignmentMember} onReload={workspace.reload} onSearchChange={setSearch} onToggleFilterValue={toggleFilterValue} onClearFilters={clearFilters} pagination={pagination} readOnly={readOnly} visibleMembers={visibleMembers} /></section>
    <CoachAssignmentDialog coaches={workspace.coaches} history={workspace.assignmentHistory} loading={workspace.assignmentLoading} member={assignmentMember} onClose={() => setAssignmentMember(null)} onSubmit={assign} />
    <MemberEditorDialog detail={workspace.detail} loading={workspace.detailLoading} memberId={editingMemberId} onClose={() => setEditingMemberId(null)} onSubmit={save} />
  </main>;
}
