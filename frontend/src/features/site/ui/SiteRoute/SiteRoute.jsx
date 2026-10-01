import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LandingPage } from "../LandingPage/LandingPage.jsx";
import { NotFoundPage } from "../NotFoundPage/NotFoundPage.jsx";
import { PublicPageLayout } from "../PublicPageLayout/PublicPageLayout.jsx";
import { PublicPricingSection } from "../Pricing/PublicPricingSection.jsx";
import { SiteBlockView } from "../SiteBlocks/SiteBlockView.jsx";
import { publicSiteApi, siteCmsPublicEnabled } from "../../api/site-public-api.js";
import { homeSeo, isCorePage } from "../../model/core-pages.js";
import { pageHead } from "../../model/seo-head.js";
import { serverPageData } from "../../model/server-page-data.js";
import "../LandingPage/LandingPage.css";

function usePageSeo(page) {
  useEffect(() => {
    const previous = document.title;
    const selector = 'meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], #public-seo-schema';
    const previousNodes = [...document.head.querySelectorAll(selector)];
    previousNodes.forEach((node) => node.remove());
    const template = document.createElement("template");
    template.innerHTML = pageHead({ path: window.location.pathname, page, noindex: window.location.hostname !== "kineticsports.io.vn" });
    const nodes = [...template.content.childNodes];
    document.head.append(...nodes);
    document.title = page.seoTitle || page.title;
    return () => {
      document.title = previous;
      nodes.forEach((node) => node.remove());
      document.head.append(...previousNodes);
    };
  }, [page]);
}

function PublishedContent({ page }) {
  usePageSeo(page);
  return <SiteBlockView blocks={page.blocks} />;
}

export function HomeRoute({ onLoginClick, onRegisterClick, onGalleryClick, onCalendarClick, onHomeClick }) {
  usePageSeo(homeSeo);
  const query = useQuery({ queryKey: ["public-site-page", "home"], queryFn: publicSiteApi.home, enabled: siteCmsPublicEnabled, retry: false, staleTime: 300_000 });
  if (!siteCmsPublicEnabled || !query.data) return <LandingPage onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onGalleryClick={onGalleryClick} onCalendarClick={onCalendarClick} />;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick} showBack={false}><PublishedContent page={query.data} /><PublicPricingSection onRegisterClick={onRegisterClick} /></PublicPageLayout>;
}

export function ManagedPublicPage({ onHomeClick, onLoginClick, onRegisterClick, path }) {
  const enabled = siteCmsPublicEnabled || isCorePage(path);
  const query = useQuery({ queryKey: ["public-site-path", path], queryFn: () => publicSiteApi.pageByPath(path), initialData: () => serverPageData(path)?.page, enabled, retry: false, staleTime: 300_000 });
  if (!enabled || query.isError) return <NotFoundPage onHome={onHomeClick} onLogin={onLoginClick} />;
  if (query.isPending) return <main className="public-page-body" role="status">Đang tải trang...</main>;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}><PublishedContent key={path} page={query.data} />{path === "/bang-gia" && <PublicPricingSection onRegisterClick={onRegisterClick} initialPackages={serverPageData(path)?.packages} />}</PublicPageLayout>;
}
