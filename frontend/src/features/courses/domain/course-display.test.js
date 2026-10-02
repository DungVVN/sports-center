import { describe, expect, it } from "vitest";
import { courseSessionInput } from "./course-display.js";

describe("course time input", () => {
  it("interprets staff-entered dates in Vietnam time independently of browser timezone", () => {
    expect(courseSessionInput({ name: "", coachUserId: "coach", roomId: "room", startsAt: "2099-04-01T08:00", endsAt: "2099-04-01T09:00:30" })).toEqual({
      name: undefined, coachUserId: "coach", roomId: "room", startsAt: "2099-04-01T01:00:00.000Z", endsAt: "2099-04-01T02:00:30.000Z",
    });
  });
});
