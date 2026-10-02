import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LandingPage } from "../LandingPage/LandingPage.jsx";
import { NotFoundPage } from "../NotFoundPage/NotFoundPage.jsx";
import { PublicPageLayout } from "../PublicPageLayout/PublicPageLayout.jsx";
import { PublicPricingSection } from "../Pricing/PublicPricingSection.jsx";
import { SiteBlockView } from "../SiteBlocks/SiteBlockView.jsx";
import { FacilityCalendarPage } from "../../../facilities/index.js";
import "./managed-activity-pages.css";
import { publicSiteApi } from "../../api/site-public-api.js";
import { homeSeo } from "../../model/core-pages.js";
import { pageHead } from "../../model/seo-head.js";
import { serverPageData } from "../../model/server-page-data.js";
import { errorMessageFor } from "../../../../shared/api/error-message.js";
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

function LegacyHomeContent(props) {
  usePageSeo(homeSeo);
  return <LandingPage {...props} />;
}

export function HomeRoute({ onLoginClick, onRegisterClick, onGalleryClick, onCalendarClick, onHomeClick }) {
  const query = useQuery({ queryKey: ["public-site-page", "home"], queryFn: publicSiteApi.home, initialData: () => serverPageData("/")?.page, retry: false, staleTime: 300_000 });
  if (!query.data) return <LegacyHomeContent onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onGalleryClick={onGalleryClick} onCalendarClick={onCalendarClick} />;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick} showBack={false}><PublishedContent page={query.data} /><PublicPricingSection onRegisterClick={onRegisterClick} /></PublicPageLayout>;
}

export function ManagedPublicPage({ onHomeClick, onLoginClick, onRegisterClick, path, fallback }) {
  const query = useQuery({ queryKey: ["public-site-path", path], queryFn: () => publicSiteApi.pageByPath(path), initialData: () => serverPageData(path)?.legacy ? undefined : serverPageData(path)?.page, retry: false, staleTime: 300_000 });
  if (query.isError) {
    if (query.error?.status === 404) return fallback ?? <NotFoundPage onHome={onHomeClick} onLogin={onLoginClick} />;
    return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}>
      <section className="public-page-body" aria-labelledby="public-page-error-title">
        <h1 id="public-page-error-title">Không thể tải trang</h1>
        <p role="alert">{errorMessageFor(query.error, "Không thể tải nội dung trang.")}</p>
        <button type="button" className="btn-primary" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? "Đang thử lại..." : "Thử lại"}</button>
      </section>
    </PublicPageLayout>;
  }
  if (query.isPending) return <main className="public-page-body" role="status">Đang tải trang...</main>;
  return <PublicPageLayout onHomeClick={onHomeClick} onLoginClick={onLoginClick}><div className={path === "/gallery" ? "public-cms-gallery" : path === "/calendar" ? "public-cms-calendar" : undefined}><PublishedContent key={path} page={query.data} />{path === "/calendar" && <FacilityCalendarPage onLoginClick={onLoginClick} embedded />}</div>{path === "/bang-gia" && <PublicPricingSection onRegisterClick={onRegisterClick} initialPackages={serverPageData(path)?.packages} />}</PublicPageLayout>;
}
