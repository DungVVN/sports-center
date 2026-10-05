import "./site-blocks.css";

export function SiteBlockView({ blocks = [] }) {
  return (
    <div className="site-blocks">
      {blocks
        .filter((block) => block.active)
        .map((block) => (
          <section className={`site-blocks__section site-blocks__section--${block.type}`} key={block.id}>
            {block.type === "hero" && (
              <div className={`site-blocks__hero${block.imageUrl ? " site-blocks__hero--with-image" : ""}`}>
                {block.imageUrl && <img alt={block.imageAlt || ""} src={block.imageUrl} />}
                <div>
                  {block.eyebrow && <p className="site-blocks__eyebrow">{block.eyebrow}</p>}
                  <h1>{block.title}</h1>
                  {block.description && <p>{block.description}</p>}
                  {block.buttonLabel && block.buttonHref && (
                    <a className="site-blocks__button" href={block.buttonHref}>
                      {block.buttonLabel}
                    </a>
                  )}
                </div>
              </div>
            )}
            {block.type === "richText" && (
              <div className="site-blocks__copy">
                <h2>{block.title}</h2>
                <p>{block.body}</p>
              </div>
            )}
            {block.type === "imageText" && (
              <div className={`site-blocks__split${block.imageUrl ? " site-blocks__split--with-image" : ""}`}>
                {block.imageUrl && <img alt={block.imageAlt || ""} src={block.imageUrl} />}
                <div>
                  <h2>{block.title}</h2>
                  <p>{block.body}</p>
                </div>
              </div>
            )}
            {block.type === "cta" && (
              <div
                className={`site-blocks__cta${block.buttonLabel && block.buttonHref ? " site-blocks__cta--with-action" : ""}`}
              >
                <div>
                  <h2>{block.title}</h2>
                  <p>{block.body}</p>
                </div>
                {block.buttonLabel && block.buttonHref && (
                  <a className="site-blocks__button" href={block.buttonHref}>
                    {block.buttonLabel}
                  </a>
                )}
              </div>
            )}
            {block.type === "faq" && (
              <div className="site-blocks__copy">
                <h2>{block.title}</h2>
                {block.items.map((item, index) => (
                  <details key={`${block.id}-${index}`}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            )}
          </section>
        ))}
    </div>
  );
}
