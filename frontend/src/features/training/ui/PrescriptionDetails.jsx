export function PrescriptionDetails({ decision }) {
  return <div className="training-prescription-details"><p>{decision.explanation}</p><p><span className={decision.status === "approved" ? "badge badge--success" : "badge badge--warning"}>{decision.status === "approved" ? "Đã duyệt" : "Bản nháp, chưa áp dụng"}</span></p>
    {decision.prescriptions.map((item) => <article key={item.id} className="training-personalization-dose"><p>Buổi {decision.sessions?.find((session) => session.id === item.training_session_id)?.position ?? "—"} · {decision.sessions?.find((session) => session.id === item.training_session_id)?.scheduled_on?.slice(0, 10) ?? "—"}</p><strong>{item.name} · {item.variant}</strong>
      <p>{item.discipline === "gym" ? `${item.sets ?? "—"} hiệp × ${item.reps ?? "—"} lần; tải ${item.load_kg ?? "—"} kg; nghỉ ${item.rest_seconds ?? "—"} giây` : `Giữ ${item.hold_seconds ?? "—"} giây; ${item.breath_cycles ?? "—"} nhịp thở; dụng cụ: ${(item.props ?? []).join(", ") || "không"}`}</p>
      <p>{item.instructions}</p><p>Tiêu chí điều chỉnh: {item.progression_criteria}</p></article>)}
    <details><summary>Dữ liệu và bằng chứng dùng để lập giáo án</summary>{decision.inputs.map((item) => <p key={item.id}>{item.input_key}: {JSON.stringify(item.value)}</p>)}
      {decision.protocol.evidence.map((item) => <p key={item.id}><a href={item.source.url} target="_blank" rel="noreferrer">{item.source.publisher} · {item.source.version}</a> · {item.section_reference}<br />{item.interpretation}<br />{item.applicability}</p>)}
      <p>Giới hạn: {decision.protocol.limitations}</p></details></div>;
}
