import { FacilityCalendarPage } from '../../../facilities/index.js';
import { PublicPageLayout } from '../PublicPageLayout/PublicPageLayout.jsx';
import { ManagedPublicPage } from '../SiteRoute/SiteRoute.jsx';

export function CalendarPage({ onLoginClick, onHomeClick }) {
  return (
    <ManagedPublicPage path="/calendar" onHomeClick={onHomeClick} onLoginClick={onLoginClick} fallback={<PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}>
      <FacilityCalendarPage onLoginClick={onLoginClick} />
    </PublicPageLayout>} />
  );
}
