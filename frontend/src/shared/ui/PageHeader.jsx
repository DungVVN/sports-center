import "./PageHeader.css";

export function PageHeader({ eyebrow, title, description, actions, back, headingAs: Heading = "h1" }) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-page-header__content">
        {back && <div className="workspace-page-header__back">{back}</div>}
        {eyebrow && <p className="workspace-page-header__eyebrow">{eyebrow}</p>}
        <Heading className="workspace-page-header__title">{title}</Heading>
        {description && <div className="workspace-page-header__description">{description}</div>}
      </div>
      {actions && <div className="workspace-page-header__actions">{actions}</div>}
    </header>
  );
}
