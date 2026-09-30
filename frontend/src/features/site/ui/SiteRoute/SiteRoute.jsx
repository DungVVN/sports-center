import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LandingPage } from "../LandingPage/LandingPage.jsx";
import { NotFoundPage } from "../NotFoundPage/NotFoundPage.jsx";
import { PublicPageLayout } from "../PublicPageLayout/PublicPageLayout.jsx";
import { PublicPricingSection } from "../Pricing/PublicPricingSection.jsx";
import { SiteBlockView } from "../SiteBlocks/SiteBlockView.jsx";
import { publicSiteApi, siteCmsPublicEnabled } from "../../api/site-public-api.js";
import "../LandingPage/LandingPage.css";

function PublishedContent({ page }) {
  useEffect(() => {
    const previous = document.title;
    document.title = page.seoTitle || page.title;
    return () => { document.title = previous; };
  }, [page.seoTitle, page.title]);
  return <SiteBlockView blocks={page.blocks} />;
}

export function HomeRoute({ onLoginClick, onRegisterClick, onGalleryClick, onCalendarClick, onHomeClick }) {
  const query = useQuery({ queryKey: ["public-site-page", "home"], queryFn: publicSiteApi.home, enabled: siteCmsPublicEnabled, retry: false, staleTime: 300_000 });
  if (!siteCmsPublicEnabled || !query.data) return <LandingPage onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onGalleryClick={onGalleryClick} onCalendarClick={onCalendarClick} />;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick} showBack={false}><PublishedContent page={query.data} /><PublicPricingSection onRegisterClick={onRegisterClick} /></PublicPageLayout>;
}

export function ManagedPublicPage({ onHomeClick, onLoginClick, path }) {
  const query = useQuery({ queryKey: ["public-site-path", path], queryFn: () => publicSiteApi.pageByPath(path), enabled: siteCmsPublicEnabled, retry: false, staleTime: 300_000 });
  if (!siteCmsPublicEnabled || query.isError) return <NotFoundPage onHome={onHomeClick} onLogin={onLoginClick} />;
  if (query.isPending) return <main className="public-page-body" role="status">Đang tải trang...</main>;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}><PublishedContent page={query.data} /></PublicPageLayout>;
}
