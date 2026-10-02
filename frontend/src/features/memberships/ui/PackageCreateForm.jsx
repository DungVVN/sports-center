import {
  entitlementLabels,
  packageTemplates,
} from "../domain/membership-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
export function PackageCreateForm({
  changePackageField,
  createPackage,
  packageForm,
  packageFormErrors,
  setPackageForm,
  submitting,
  toggleEntitlement,
}) {
  return (
    <form
      className="members-form package-create-form"
      onSubmit={createPackage}
      noValidate
    >
      <h2>Tạo gói tập</h2>
      <label className="package-create-form__identity">
        Mã gói
        <input
          list="package-code-options"
          className={packageFormErrors.code ? "input-error" : ""}
          onChange={(event) =>
            changePackageField("code", event.target.value.toUpperCase())
          }
          placeholder="Ví dụ: STANDARD"
          pattern="[A-Z0-9_-]{2,30}"
          required
          title="Mã gói gồm 2–30 ký tự in hoa, số, dấu gạch dưới hoặc gạch ngang."
          value={packageForm.code}
        />
        {packageFormErrors.code && (
          <span className="field-error">{packageFormErrors.code}</span>
        )}
        <datalist id="package-code-options">
          {packageTemplates.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </datalist>
      </label>
      <label className="package-create-form__identity">
        Tên gói
        <input
          list="package-name-options"
          className={packageFormErrors.name ? "input-error" : ""}
          onChange={(event) => changePackageField("name", event.target.value)}
          placeholder="Ví dụ: Gói Tiêu chuẩn"
          required
          minLength={2}
          maxLength={100}
          value={packageForm.name}
        />
        {packageFormErrors.name && (
          <span className="field-error">{packageFormErrors.name}</span>
        )}
        <datalist id="package-name-options">
          {packageTemplates.map((item) => (
            <option key={item.name} value={item.name}>
              {item.code}
            </option>
          ))}
        </datalist>
      </label>
      {[
        ["priceVnd", "Giá (VNĐ)", 0, undefined],
        ["durationDays", "Số ngày", 1, 730],
        ["tierRank", "Thứ hạng quyền", 1, undefined],
      ].map(([key, label]) => (
        <label className="package-create-form__metric" key={key}>
          {label}
          <input
            className={packageFormErrors[key] ? "input-error" : ""}
            min={key === "priceVnd" ? 0 : 1}
            max={key === "durationDays" ? 730 : undefined}
            onChange={(event) => changePackageField(key, event.target.value)}
            required
            step="1"
            type="number"
            value={packageForm[key]}
          />
          {packageFormErrors[key] && (
            <span className="field-error">{packageFormErrors[key]}</span>
          )}
        </label>
      ))}
      <fieldset className="entitlement-fieldset">
        <legend>Quyền sử dụng</legend>
        {Object.entries(entitlementLabels).map(([code, label]) => (
          <label key={code}>
            <input
              checked={packageForm.entitlements.includes(code)}
              onChange={() => toggleEntitlement(code)}
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
            setPackageForm({
              ...packageForm,
              benefits: event.target.value,
            })
          }
          value={packageForm.benefits}
        />
      </label>
      <Button loading={submitting} type="submit">
        Tạo gói
      </Button>
    </form>
  );
}
