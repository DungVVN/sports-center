import { FacilityCalendarPage } from '../../../facilities/index.js';
import { PublicPageLayout } from '../PublicPageLayout/PublicPageLayout.jsx';

export function CalendarPage({ onLoginClick, onHomeClick }) {
  return (
    <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}>
      <FacilityCalendarPage onLoginClick={onLoginClick} />
    </PublicPageLayout>
  );
}
