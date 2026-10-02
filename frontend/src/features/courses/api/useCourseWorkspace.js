import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSessionPermission } from "../../auth/index.js";
import { classApi } from "../../classes/index.js";
import { courseApi } from "./course-api.js";

export function useCourseWorkspace(session) {
  const client = useQueryClient();
  const canManage = hasSessionPermission(session, "course.manage");
  const canEnroll = session.user.role === "member" && hasSessionPermission(session, "course.enroll");
  const canReadEnrollments = hasSessionPermission(session, "course.enrollment.read");
  const courses = useQuery({ queryKey: ["courses"], queryFn: courseApi.list });
  const enrollments = useQuery({ queryKey: ["course-enrollments", canEnroll ? "me" : "staff"], queryFn: canEnroll ? courseApi.mine : courseApi.enrollments, enabled: canEnroll || canReadEnrollments, refetchInterval: 30_000 });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: classApi.rooms, enabled: canManage });
  const coaches = useQuery({ queryKey: ["coaches"], queryFn: classApi.coaches, enabled: canManage });
  const mutation = useMutation({
    mutationFn: ({ action, id, input }) => {
      if (action === "create") return courseApi.create(input);
      if (action === "session") return courseApi.addSession(id, input);
      if (action === "publish") return courseApi.publish(id);
      if (action === "complete") return courseApi.complete(id);
      if (action === "enroll") return courseApi.enroll(id);
      if (action === "cancel") return courseApi.cancel(id);
      if (action === "payment") return courseApi.payment(id, input.method);
      throw new Error("Thao tác khóa học không hợp lệ.");
    },
    onSuccess: async () => {
      await Promise.all(["courses", "course-enrollments", "bookings", "classes", "payments"].map((key) => client.invalidateQueries({ queryKey: [key] })));
      await client.invalidateQueries({ queryKey: ["member", "payments"] });
    },
  });
  return { canManage, canEnroll, courses, enrollments, rooms, coaches, mutation };
}
