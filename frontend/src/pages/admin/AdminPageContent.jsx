import { ManagerPageContent } from "../manager/ManagerPageContent.jsx";

// Admin has the same operational pages as Manager plus identity/audit controls.
// The API is still the authority; this component only provides the navigation shell.
export function AdminPageContent(props) {
  return <ManagerPageContent {...props} dashboardRole="admin" />;
}
