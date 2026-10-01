import { emptyContact, toForm } from "../domain/profile-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
export function ProfileContacts({
  choosePrimary,
  form,
  profile,
  setFormDraft,
  updateContact,
}) {
  return (
    <section className="members-list profile-page__contacts">
      <div className="list-heading">
        <h2>Liên hệ khẩn cấp</h2>
        <Button
          disabled={form.contacts.length >= 3}
          onClick={() =>
            setFormDraft((current) => ({
              ...(current ?? toForm(profile)),
              contacts: [
                ...(current ?? toForm(profile)).contacts,
                {
                  ...emptyContact,
                  isPrimary: (current ?? toForm(profile)).contacts.length === 0,
                },
              ],
            }))
          }
          size="sm"
          type="button"
          variant="secondary"
        >
          Thêm liên hệ
        </Button>
      </div>
      {form.contacts.length === 0 ? (
        <p className="profile-page__empty">
          Chưa có liên hệ khẩn cấp. Bạn có thể thêm tối đa ba người liên hệ.
        </p>
      ) : (
        <div className="profile-page__contact-list">
          {form.contacts.map((contact, index) => (
            <fieldset key={contact.id ?? `new-${index}`}>
              <legend>Liên hệ {index + 1}</legend>
              <label>
                Họ tên
                <input
                  onChange={(event) =>
                    updateContact(index, "fullName", event.target.value)
                  }
                  required
                  value={contact.fullName}
                />
              </label>
              <label>
                Mối quan hệ
                <input
                  onChange={(event) =>
                    updateContact(index, "relationship", event.target.value)
                  }
                  required
                  value={contact.relationship}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  inputMode="tel"
                  onChange={(event) =>
                    updateContact(index, "phone", event.target.value)
                  }
                  required
                  value={contact.phone}
                />
              </label>
              <label className="profile-page__primary">
                <input
                  checked={contact.isPrimary}
                  name="primary-contact"
                  onChange={() => choosePrimary(index)}
                  type="radio"
                />
                Liên hệ chính
              </label>
              <Button
                onClick={() =>
                  setFormDraft((current) => ({
                    ...(current ?? toForm(profile)),
                    contacts: (current ?? toForm(profile)).contacts
                      .filter((_, contactIndex) => contactIndex !== index)
                      .map((item, contactIndex) => ({
                        ...item,
                        isPrimary:
                          contactIndex === 0 &&
                          !(current ?? toForm(profile)).contacts
                            .filter((_, i) => i !== index)
                            .some((entry) => entry.isPrimary),
                      })),
                  }))
                }
                size="sm"
                type="button"
                variant="danger"
              >
                Xóa
              </Button>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
