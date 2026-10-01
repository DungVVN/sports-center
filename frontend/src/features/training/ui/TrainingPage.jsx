import {
  newPlan,
  newTemplate,
  newResult,
  createSessionForm,
} from "../domain/training-form.js";
import { TrainingAiReview } from "./TrainingAiReview.jsx";
import { TrainingTemplateForm } from "./TrainingTemplateForm.jsx";
import { TrainingPlanForm } from "./TrainingPlanForm.jsx";
import { TrainingResultForm } from "./TrainingResultForm.jsx";
import { TrainingSessionForm } from "./TrainingSessionForm.jsx";
import { TrainingPlanList } from "./TrainingPlanList.jsx";
import { useMemo, useState } from "react";
import { hasSessionPermission } from "../../auth/index.js";
import { trainingApi } from "../api/training-api.js";
import { useTrainingWorkspace } from "../api/useTrainingWorkspace.js";
export function TrainingPage({ session }) {
  const [plan, setPlan] = useState(newPlan);
  const [template, setTemplate] = useState(newTemplate);
  const [result, setResult] = useState(newResult);
  const [sessionForm, setSessionForm] = useState(createSessionForm);
  const [delivery, setDelivery] = useState(null);
  const canViewAi = hasSessionPermission(session, "ai.assist.read");
  const canDeliverAi = hasSessionPermission(session, "ai.assist.deliver");
  const canCreateTemplate = hasSessionPermission(
    session,
    "training.template.manage",
  );
  const workspace = useTrainingWorkspace({
    canViewAi,
    planId: sessionForm.planId,
  });
  const { aiDrafts, members, plans, sessions, templates } = workspace;
  const aiSuggestions = useMemo(
    () => aiDrafts.flatMap((group) => group.suggestions),
    [aiDrafts],
  );
  const submitting = workspace.runAction.isPending;
  const planCreatorName =
    session?.user?.displayName ??
    session?.user?.email ??
    "Tài khoản đang đăng nhập";
  async function submit(task, success) {
    if (workspace.runAction.isPending) return;
    try {
      await workspace.runAction.mutateAsync({
        task,
        success,
      });
    } catch {
      // Shared mutation feedback renders the error while leaving the form state intact.
    }
  }
  async function moveSession(index, direction) {
    const reordered = [...sessions];
    const target = index + direction;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    await submit(
      () =>
        trainingApi.reorderSessions(
          sessionForm.planId,
          reordered.map((item) => item.id),
        ),
      "Đã cập nhật thứ tự buổi tập.",
    );
  }
  async function moveSessionExercise(sessionItem, index, direction) {
    const reordered = [...sessionItem.exercises];
    const target = index + direction;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    await submit(
      () =>
        trainingApi.reorderSessionExercises(
          sessionItem.id,
          reordered.map((item) => item.id),
        ),
      "Đã cập nhật thứ tự bài tập.",
    );
  }
  function updateSessionExercise(index, field, value) {
    setSessionForm((current) => ({
      ...current,
      exercises: current.exercises.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  }
  return (
    <main className="members-page">
      <header>
        <p>Giáo án</p>
        <h1>Mẫu và kế hoạch tập luyện</h1>
      </header>
      {workspace.error && (
        <p className="auth-alert" role="alert">
          {workspace.error}
        </p>
      )}
      {workspace.notice && (
        <p className="auth-success" role="status">
          {workspace.notice}
        </p>
      )}
      {canViewAi && (
        <TrainingAiReview
          aiSuggestions={aiSuggestions}
          canDeliverAi={canDeliverAi}
          delivery={delivery}
          members={members}
          setDelivery={setDelivery}
          submit={submit}
          submitting={submitting}
          workspace={workspace}
        />
      )}
      {canCreateTemplate && (
        <TrainingTemplateForm
          setTemplate={setTemplate}
          submit={submit}
          submitting={submitting}
          template={template}
        />
      )}
      <div className="training-action-grid">
        <TrainingPlanForm
          members={members}
          plan={plan}
          planCreatorName={planCreatorName}
          setPlan={setPlan}
          submit={submit}
          submitting={submitting}
          templates={templates}
        />
        <TrainingResultForm
          plans={plans}
          result={result}
          setResult={setResult}
          submit={submit}
          submitting={submitting}
        />
        <TrainingSessionForm
          moveSession={moveSession}
          moveSessionExercise={moveSessionExercise}
          plans={plans}
          sessionForm={sessionForm}
          sessions={sessions}
          setSessionForm={setSessionForm}
          submit={submit}
          submitting={submitting}
          updateSessionExercise={updateSessionExercise}
        />
      </div>
      <TrainingPlanList
        submit={submit}
        submitting={submitting}
        workspace={workspace}
        members={members}
        plans={plans}
      />
    </main>
  );
}
