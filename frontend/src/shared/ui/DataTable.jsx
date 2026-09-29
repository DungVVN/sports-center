import { useEffect, useRef } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

export function DataTableToolbar({ children, onClear, resultCount, search, setSearch, searchPlaceholder = "Tìm kiếm..." }) {
  return (
    <div className="data-table-toolbar">
      {setSearch && (
        <label className="data-table-toolbar__search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label={searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={search}
          />
        </label>
      )}
      {children}
      {onClear && (
        <button className="data-table-toolbar__clear" onClick={onClear} type="button">
          <X aria-hidden="true" size={15} />
          Xóa lọc
        </button>
      )}
      {typeof resultCount === "number" && (
        <span className="data-table-toolbar__count">{resultCount} kết quả</span>
      )}
    </div>
  );
}

export function SortableHeader({ activeSort, children, className, column, direction, onSort }) {
  const isActive = activeSort === column;
  return (
    <th aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button className="sortable-header" onClick={() => onSort(column)} type="button">
        {children}
        {isActive && direction === "asc" ? (
          <ArrowUpAZ aria-hidden="true" size={14} />
        ) : (
          <ArrowDownAZ aria-hidden="true" size={14} />
        )}
      </button>
    </th>
  );
}

export function FilterMenu({ activeCount = 0, children, className = "", isOpen, onClose, onToggle }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        if (onClose) onClose();
        else if (onToggle) onToggle();
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (onClose) onClose();
        else if (onToggle) onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, onToggle]);

  return (
    <div ref={menuRef} className={`filter-menu ${className}`.trim()}>
      <button
        aria-expanded={isOpen}
        className="filter-menu__trigger"
        onClick={onToggle}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" size={16} />
        Bộ lọc{activeCount ? ` (${activeCount})` : ""}
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {isOpen && <div className="filter-menu__panel">{children}</div>}
    </div>
  );
}
