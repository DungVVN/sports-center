import { useQuery } from "@tanstack/react-query";
import { hasSessionPermission } from "../../auth/index.js";
import { membershipApi } from "../../memberships/index.js";
import { courseApi } from "../../courses/index.js";
import { ptApi } from "../../pt/index.js";
import { facilityApi } from "../../facilities/index.js";

export function useMyServices(session) {
  const own = session.user.role === "member";
  const memberships = useQuery({ queryKey: ["member", "memberships"], queryFn: membershipApi.mine, enabled: own && hasSessionPermission(session, "membership.self.read") });
  const courses = useQuery({ queryKey: ["course-enrollments", "me"], queryFn: courseApi.mine, enabled: own && hasSessionPermission(session, "course.enroll"), refetchInterval: 30_000 });
  const pt = useQuery({ queryKey: ["pt-purchases"], queryFn: ptApi.purchases, enabled: own && hasSessionPermission(session, "pt.read"), refetchInterval: 30_000 });
  const rentals = useQuery({ queryKey: ["facility-reservations-me"], queryFn: facilityApi.mine, enabled: own && hasSessionPermission(session, "facility.booking.self.read"), refetchInterval: 30_000 });
  return [
    { type: "membership", label: "Gói hội viên", view: "my-memberships", query: memberships },
    { type: "course", label: "Khóa có hướng dẫn", view: "courses", query: courses },
    { type: "pt", label: "Huấn luyện cá nhân", view: "pt", query: pt },
    { type: "facility", label: "Thuê sân/phòng", view: "facility-calendar", query: rentals },
  ];
}
