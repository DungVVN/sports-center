import "./TableSkeleton.css";

export function TableSkeleton({ rows = 5, columns = 5 }) {
  // Use a fixed set of widths to avoid hydration mismatch and random jumps on re-renders
  const widths = [60, 80, 50, 90, 70, 85, 40, 75, 55, 65];

  return (
    <div className="table-scroll">
      <table className="skeleton-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <div className="skeleton skeleton-text skeleton-text--header" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => {
                const widthPercent = widths[(rowIndex * columns + colIndex) % widths.length];
                return (
                  <td key={colIndex}>
                    <div className="skeleton skeleton-text" style={{ width: `${widthPercent}%` }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
