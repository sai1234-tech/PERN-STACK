import { useState } from "react";
import "./ExpandableText.css";

export default function ExpandableText({
  text,
  previewLength = 180,
  as: Element = "p",
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);
  const content = String(text || "");
  const isLong = content.length > previewLength;
  const displayedText =
    isLong && !expanded
      ? `${content.slice(0, previewLength).trimEnd()}...`
      : content;

  return (
    <div className={`expandable-text ${className}`.trim()}>
      <Element className="expandable-text-content">{displayedText}</Element>
      {isLong && (
        <button
          type="button"
          className="expandable-text-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          Show {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}
