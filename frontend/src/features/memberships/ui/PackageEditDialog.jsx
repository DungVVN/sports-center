import { entitlementLabels } from "../domain/membership-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
export function PackageEditDialog({
  changeEditingPackageField,
  editingPackage,
  editingPackageErrors,
  setEditingPackage,
  submitting,
  toggleEditingEntitlement,
  updatePackage,
}) {
  return (
    <Dialog
      isOpen={Boolean(editingPackage)}
      onClose={() => setEditingPackage(null)}
      title="Cập nhật gói tập"
    >
      {editingPackage && (
        <form
          className="members-form dialog-scrollable-form"
          onSubmit={updatePackage}
          noValidate
        >
          <div className="dialog-scrollable-content">
            <label>
              Tên gói
              <input
                className={editingPackageErrors.name ? "input-error" : ""}
                onChange={(event) =>
                  changeEditingPackageField("name", event.target.value)
                }
                required
                value={editingPackage.name}
              />
              {editingPackageErrors.name && (
                <span className="field-error">{editingPackageErrors.name}</span>
              )}
            </label>
            <label>
              Giá (VNĐ)
              <input
                min="0"
                className={editingPackageErrors.priceVnd ? "input-error" : ""}
                onChange={(event) =>
                  changeEditingPackageField("priceVnd", event.target.value)
                }
                required
                type="number"
                value={editingPackage.priceVnd}
              />
              {editingPackageErrors.priceVnd && (
                <span className="field-error">
                  {editingPackageErrors.priceVnd}
                </span>
              )}
            </label>
            <label>
              Số ngày
              <input
                min="1"
                className={
                  editingPackageErrors.durationDays ? "input-error" : ""
                }
                onChange={(event) =>
                  changeEditingPackageField("durationDays", event.target.value)
                }
                required
                type="number"
                value={editingPackage.durationDays}
              />
              {editingPackageErrors.durationDays && (
                <span className="field-error">
                  {editingPackageErrors.durationDays}
                </span>
              )}
            </label>
            <label>
              Thứ hạng quyền
              <input
                min="1"
                className={editingPackageErrors.tierRank ? "input-error" : ""}
                onChange={(event) =>
                  changeEditingPackageField("tierRank", event.target.value)
                }
                required
                type="number"
                value={editingPackage.tierRank}
              />
              {editingPackageErrors.tierRank && (
                <span className="field-error">
                  {editingPackageErrors.tierRank}
                </span>
              )}
            </label>
            <fieldset className="entitlement-fieldset">
              <legend>Quyền sử dụng</legend>
              <p>
                Gói hạng cao kế thừa quyền sử dụng của các gói hạng thấp hơn.
                Các ô bên dưới là quyền thêm riêng cho gói này.
              </p>
              {Object.entries(entitlementLabels).map(([code, label]) => (
                <label key={code}>
                  <input
                    checked={editingPackage.entitlements.includes(code)}
                    onChange={() => toggleEditingEntitlement(code)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Quyền hiển thị (mỗi dòng một quyền)
              <textarea
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    benefits: event.target.value,
                  })
                }
                value={editingPackage.benefits}
              />
            </label>
            <label>
              <input
                checked={editingPackage.isActive}
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    isActive: event.target.checked,
                  })
                }
                type="checkbox"
              />{" "}
              Gói đang khả dụng
            </label>
          </div>
          <div className="dialog-sticky-footer">
            <Button loading={submitting} type="submit">
              Lưu gói tập
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
