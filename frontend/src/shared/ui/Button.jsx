import "./Button.css";

const supportedVariants = new Set(["primary", "accent", "secondary", "ghost", "danger", "outline"]);
const supportedSizes = new Set(["sm", "md", "lg"]);

export function Button({ children, className = "", disabled = false, loading = false, size = "md", type = "button", variant = "primary", ...buttonProps }) {
  const resolvedVariant = supportedVariants.has(variant) ? variant : "primary";
  const resolvedSize = supportedSizes.has(size) ? size : "md";

  return (
    <button {...buttonProps} className={`button button--${resolvedVariant} button--${resolvedSize} ${className}`.trim()} disabled={disabled || loading} type={type}>
      {loading ? <span aria-hidden="true" className="button__spinner" /> : null}
      <span>{children}</span>
    </button>
  );
}
