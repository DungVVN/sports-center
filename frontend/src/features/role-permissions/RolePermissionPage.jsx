import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { rolePermissionApi } from "./role-permission-api.js";
import "./role-permissions.css";

const roleOrder = ["manager", "receptionist", "coach", "member"];

export function RolePermissionPage() {
  const [matrix, setMatrix] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await rolePermissionApi.matrix();
      setMatrix(result);
      setDraft(Object.fromEntries(result.roles.map((role) => [role.code, role.permissionCodes])));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    rolePermissionApi.matrix().then((result) => {
      if (!active) return;
      setMatrix(result);
      setDraft(Object.fromEntries(result.roles.map((role) => [role.code, role.permissionCodes])));
    }).catch((cause) => {
      if (active) setError(cause.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

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

  function toggle(role, code) {
    setDraft((current) => {
      const selected = new Set(current[role] ?? []);
      const requirements = Object.fromEntries(matrix.permissions.map((permission) => [permission.code, [...(permission.requires ?? []), ...(permission.requiresByRole?.[role] ?? [])]]));
      if (selected.has(code)) {
        selected.delete(code);
        let changed;
        do {
          changed = false;
          for (const item of [...selected]) {
            if ((requirements[item] ?? []).some((required) => !selected.has(required))) { selected.delete(item); changed = true; }
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
    setMessage("");
  }

  async function save(role) {
    const current = matrix.roles.find((item) => item.code === role);
    if (!current) return;
    setSaving(role);
    setError("");
    setMessage("");
    try {
      const updated = await rolePermissionApi.replace(role, { version: current.version, permissionCodes: draft[role] ?? [] });
      setMatrix((previous) => ({
        ...previous,
        roles: previous.roles.map((item) => item.code === role
          ? { ...item, version: updated.version, permissionCodes: updated.permissionCodes }
          : item),
      }));
      setMessage(`Đã lưu quyền cho ${current.label}.`);
    } catch (cause) {
      setError(cause.status === 409 ? "Bảng quyền đã được thay đổi. Hãy tải lại trước khi lưu." : cause.message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p role="status">Đang tải bảng phân quyền...</p>;
  if (!matrix) return <section className="role-permissions"><p role="alert">{error || "Không tải được bảng phân quyền."}</p><Button onClick={load}>Thử lại</Button></section>;

  return (
    <section className="role-permissions">
      <header className="role-permissions__header">
        <div><p className="role-permissions__eyebrow">QUẢN TRỊ</p><h1>Phân quyền chức năng</h1><p>Tích chọn chức năng cho bốn vai trò. Admin luôn có toàn quyền.</p></div>
        <Button onClick={load} variant="secondary">Tải lại</Button>
      </header>
      {error && <p role="alert" className="role-permissions__error">{error}</p>}
      {message && <p role="status" className="role-permissions__success">{message}</p>}
      <div className="role-permissions__scroll">
        <table className="role-permissions__table">
          <thead><tr><th scope="col">Chức năng</th>{roleOrder.map((code) => <th key={code} scope="col">{matrix.roles.find((role) => role.code === code)?.label ?? code}</th>)}</tr></thead>
          <tbody>{groups.map(([group, permissions]) => (
            <FragmentGroup group={group} key={group} permissions={permissions} roles={roleOrder} draft={draft} onToggle={toggle} />
          ))}</tbody>
        </table>
      </div>
      <div className="role-permissions__actions">{roleOrder.map((code) => {
        const role = matrix.roles.find((item) => item.code === code);
        const changed = JSON.stringify([...(draft[code] ?? [])].sort()) !== JSON.stringify([...(role?.permissionCodes ?? [])].sort());
        return <Button disabled={!changed || Boolean(saving)} key={code} onClick={() => save(code)}>{saving === code ? "Đang lưu..." : `Lưu ${role?.label ?? code}`}</Button>;
      })}</div>
    </section>
  );
}

function FragmentGroup({ group, permissions, roles, draft, onToggle }) {
  return <><tr className="role-permissions__group"><th colSpan={roles.length + 1} scope="colgroup">{group}</th></tr>{permissions.map((permission) => <tr key={permission.code}><th scope="row"><span>{permission.description}</span><code>{permission.code}</code></th>{roles.map((role) => <td key={role}><input aria-label={`${permission.description} — ${role}`} checked={(draft[role] ?? []).includes(permission.code)} disabled={Boolean(permission.availableRoles && !permission.availableRoles.includes(role))} onChange={() => onToggle(role, permission.code)} title={permission.availableRoles && !permission.availableRoles.includes(role) ? "Cần hồ sơ hội viên" : undefined} type="checkbox" /></td>)}</tr>)}</>;
}
