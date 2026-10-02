import { FacilityCalendarPage } from "./ui/FacilityCalendarPage.jsx";

export { FacilityCalendarPage };
export { facilityApi } from "./api/facility-api.js";
export const loadFacilityCalendarPage = () => Promise.resolve({ FacilityCalendarPage });
