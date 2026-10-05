import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutationFeedback, useSubmitMutation } from "../../../shared/lib/useMutationFeedback.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { rolePermissionApi } from "../api/role-permission-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import "./role-permissions.css";

const roleOrder = ["manager", "receptionist", "coach", "member"];
const groupLabels = {
  course: "Khóa có hướng dẫn",
  pt: "Huấn luyện cá nhân",
  payment: "Thanh toán, hoàn tiền và đối soát",
  member: "Hồ sơ hội viên",
};

export function RolePermissionPage() {
  const client = useQueryClient();
  const feedback = useMutationFeedback();
  const matrixQuery = useQuery({ queryKey: ["role-permissions"], queryFn: rolePermissionApi.matrix });
  const matrix = matrixQuery.data ?? null;
  const [draft, setDraft] = useState({});
  const [draftVersions, setDraftVersions] = useState({});
  const saveMatrix = useSubmitMutation({
    feedback,
    mutationFn: async (roles) => {
      for (const role of roles) {
        const updated = await rolePermissionApi.replace(role.code, {
          version: draftVersions[role.code] ?? role.version,
          permissionCodes: draft[role.code] ?? role.permissionCodes ?? [],
        });
        client.setQueryData(["role-permissions"], (previous) => ({
          ...previous,
          roles: previous.roles.map((item) =>
            item.code === role.code
              ? { ...item, version: updated.version, permissionCodes: updated.permissionCodes }
              : item,
          ),
        }));
        setDraft((current) => {
          const next = { ...current };
          delete next[role.code];
          return next;
        });
        setDraftVersions((current) => {
          const next = { ...current };
          delete next[role.code];
          return next;
        });
      }
    },
    successMessage: "Đã lưu thay đổi quyền.",
    errorMessage: (cause) =>
      cause.status === 409
        ? "Bảng quyền đã được thay đổi. Hãy tải lại trước khi lưu."
        : errorMessageFor(cause, "Một phần thay đổi có thể đã được lưu. Hãy tải lại bảng trước khi thử lại."),
  });

  const groups = useMemo(() => {
    if (!matrix) return [];
    const grouped = new Map();
    for (const permission of matrix.permissions) {
      const items = grouped.get(permission.group) ?? [];
      items.push(permission);
      grouped.set(permission.group, items);
    }
    return [...grouped.entries()];
  }, [matrix]);
  const displayedDraft = matrix
    ? Object.fromEntries(matrix.roles.map((role) => [role.code, draft[role.code] ?? role.permissionCodes ?? []]))
    : {};

  function toggle(role, code) {
    setDraftVersions((current) => ({
      ...current,
      [role]: current[role] ?? matrix.roles.find((item) => item.code === role).version,
    }));
    setDraft((current) => {
      const selected = new Set(current[role] ?? matrix.roles.find((item) => item.code === role)?.permissionCodes ?? []);
      const requirements = Object.fromEntries(
        matrix.permissions.map((permission) => [
          permission.code,
          [...(permission.requires ?? []), ...(permission.requiresByRole?.[role] ?? [])],
        ]),
      );
      if (selected.has(code)) {
        selected.delete(code);
        let changed;
        do {
          changed = false;
          for (const item of [...selected]) {
            if ((requirements[item] ?? []).some((required) => !selected.has(required))) {
              selected.delete(item);
              changed = true;
            }
          }
        } while (changed);
      } else {
        const add = (item) => {
          if (selected.has(item)) return;
          selected.add(item);
          for (const required of requirements[item] ?? []) add(required);
        };
        add(code);
      }
      return { ...current, [role]: [...selected] };
    });
    feedback.clear();
  }

  const changedRoles =
    matrix?.roles.filter(
      (role) =>
        JSON.stringify([...(draft[role.code] ?? role.permissionCodes ?? [])].sort()) !==
        JSON.stringify([...(role.permissionCodes ?? [])].sort()),
    ) ?? [];

  async function saveAll() {
    if (!changedRoles.length) return;
    await saveMatrix.mutateAsync(changedRoles).catch(() => {});
  }

  async function reload() {
    const result = await matrixQuery.refetch();
    if (result.isError) {
      feedback.setError(errorMessageFor(result.error, "Không tải được bảng phân quyền."));
      return;
    }
    setDraft({});
    setDraftVersions({});
    feedback.clear();
  }

  if (matrixQuery.isLoading) return <p role="status">Đang tải bảng phân quyền...</p>;
  if (!matrix)
    return (
      <section className="role-permissions">
        <p role="alert">{feedback.error || errorMessageFor(matrixQuery.error, "Không tải được bảng phân quyền.")}</p>
        <Button onClick={matrixQuery.refetch}>Thử lại</Button>
      </section>
    );

  return (
    <section className="role-permissions">
      <PageHeader
        eyebrow="Quản trị"
        title="Phân quyền chức năng"
        actions={
          <Button disabled={saveMatrix.isPending} loading={matrixQuery.isFetching} onClick={reload} variant="secondary">
            Tải lại
          </Button>
        }
      />
      {feedback.error && (
        <p role="alert" className="role-permissions__error">
          {feedback.error}
        </p>
      )}
      {feedback.notice && (
        <p role="status" className="role-permissions__success">
          {feedback.notice}
        </p>
      )}
      <div className="role-permissions__scroll">
        <table className="role-permissions__table">
          <thead>
            <tr>
              <th scope="col">Chức năng</th>
              {roleOrder.map((code) => (
                <th key={code} scope="col">
                  {matrix.roles.find((role) => role.code === code)?.label ?? code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, permissions]) => (
              <FragmentGroup
                group={groupLabels[group] ?? group}
                key={group}
                permissions={permissions}
                roles={roleOrder}
                roleLabels={Object.fromEntries(matrix.roles.map((role) => [role.code, role.label]))}
                draft={displayedDraft}
                onToggle={toggle}
                disabled={saveMatrix.isPending || matrixQuery.isFetching}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="role-permissions__actions">
        <Button disabled={!changedRoles.length || saveMatrix.isPending || matrixQuery.isFetching} onClick={saveAll}>
          {saveMatrix.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </section>
  );
}

function FragmentGroup({ group, permissions, roles, roleLabels, draft, onToggle, disabled }) {
  return (
    <>
      <tr className="role-permissions__group">
        <th colSpan={roles.length + 1} scope="colgroup">
          {group}
        </th>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.code}>
          <th scope="row">
            <span>{permission.description}</span>
          </th>
          {roles.map((role) => (
            <td key={role}>
              <input
                aria-label={`${permission.description} — ${role}`}
                checked={(draft[role] ?? []).includes(permission.code)}
                disabled={disabled || Boolean(permission.availableRoles && !permission.availableRoles.includes(role))}
                onChange={() => onToggle(role, permission.code)}
                title={
                  permission.availableRoles && !permission.availableRoles.includes(role)
                    ? `Quyền này chỉ áp dụng cho: ${permission.availableRoles.map((code) => roleLabels[code] ?? code).join(", ")}.`
                    : undefined
                }
                type="checkbox"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
