import { Button } from "../../../shared/ui/Button.jsx";
import { trainingApi } from "../api/training-api.js";
export function TrainingAiReview({
  aiSuggestions,
  canDeliverAi,
  delivery,
  members,
  setDelivery,
  submit,
  submitting,
  workspace,
}) {
  return (
    <section className="members-list ai-review">
      <div className="list-heading">
        <h2>Gợi ý AI cần duyệt</h2>
        <Button onClick={workspace.reload} size="sm" variant="ghost">
          Tải lại
        </Button>
      </div>
      {aiSuggestions.length === 0 ? (
        <p>Chưa có gợi ý mới.</p>
      ) : (
        <div className="ai-review__grid">
          {aiSuggestions.map((draft) => (
            <article
              className="ai-review__item"
              key={`${draft.subject}-${draft.body}`}
            >
              <strong>{draft.subject}</strong>
              <p>{draft.body}</p>
              <small>
                Nội dung cần được rà soát trước khi gửi cho hội viên.
              </small>
              {canDeliverAi && (
                <Button
                  disabled={submitting}
                  onClick={() =>
                    setDelivery({
                      memberId: "",
                      subject: draft.subject,
                      body: draft.body,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Rà soát và gửi
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {canDeliverAi && delivery && (
        <form
          className="members-form training-action-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(async () => {
              await trainingApi.deliverAiSuggestion(delivery);
              setDelivery(null);
            }, "Đã duyệt và gửi hướng dẫn cho hội viên.");
          }}
        >
          <h3>Duyệt hướng dẫn trước khi gửi</h3>
          <label>
            Hội viên
            <select
              onChange={(event) =>
                setDelivery({
                  ...delivery,
                  memberId: event.target.value,
                })
              }
              required
              value={delivery.memberId}
            >
              <option value="">Chọn hội viên trong phạm vi</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} — {member.member_code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tiêu đề
            <input
              maxLength="160"
              onChange={(event) =>
                setDelivery({
                  ...delivery,
                  subject: event.target.value,
                })
              }
              required
              value={delivery.subject}
            />
          </label>
          <label>
            Nội dung
            <textarea
              maxLength="1000"
              onChange={(event) =>
                setDelivery({
                  ...delivery,
                  body: event.target.value,
                })
              }
              required
              value={delivery.body}
            />
          </label>
          <Button loading={submitting} type="submit">
            Xác nhận gửi cho hội viên
          </Button>{" "}
          <Button
            disabled={submitting}
            onClick={() => setDelivery(null)}
            type="button"
            variant="ghost"
          >
            Hủy
          </Button>
        </form>
      )}
    </section>
  );
}
