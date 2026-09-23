import { FacilityCalendarPage } from '../../features/facilities/FacilityCalendarPage.jsx';
import { PublicPageLayout } from '../../components/PublicPageLayout/PublicPageLayout.jsx';

export function CalendarPage({ onLoginClick, onHomeClick }) {
  return (
    <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}>
      <FacilityCalendarPage onLoginClick={onLoginClick} />
    </PublicPageLayout>
  );
}
