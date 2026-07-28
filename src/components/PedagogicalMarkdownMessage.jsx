import React, { useId, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import {
  splitPedagogicalMarkdownBlocks,
  validatePedagogicalTableResponse,
} from "../../shared/pedagogicalTableContract.js";

function InlineMarkdown({ children }) {
  if (!children) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: "span" }}>
      {children}
    </ReactMarkdown>
  );
}

function plainCaptionFromIntro(intro = "") {
  const t = String(intro || "")
    .replace(/^#{1,3}\s*/, "")
    .replace(/\*\*?/g, "")
    .replace(/[_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/:\s*$/, "");
  return t || "Tableau pédagogique";
}

function PedagogicalTableBlock({ block, index }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const captionId = useId();
  const caption = plainCaptionFromIntro(block.intro);
  const hasSources = Boolean(block.sources);

  return (
    <div className="pedagogical-block">
      {block.intro ? (
        <div className="message-intro">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.intro}</ReactMarkdown>
        </div>
      ) : null}

      {block.tableMd ? (
        <section
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ children }) => (
                <table>
                  <caption id={captionId} className="pedagogical-table-caption">
                    {caption}
                  </caption>
                  {children}
                </table>
              ),
              th: ({ children }) => <th scope="col">{children}</th>,
            }}
          >
            {block.tableMd}
          </ReactMarkdown>
        </section>
      ) : null}

      {block.note ? (
        <aside className="pedagogical-note">
          <strong>Note :</strong> <InlineMarkdown>{block.note}</InlineMarkdown>
        </aside>
      ) : null}

      {block.takeaway ? (
        <div className="key-takeaway">
          <strong>À retenir :</strong>{" "}
          <InlineMarkdown>{block.takeaway}</InlineMarkdown>
        </div>
      ) : null}

      {hasSources ? (
        <div className="pedagogical-sources">
          <button
            type="button"
            className="pedagogical-sources__toggle"
            onClick={() => setSourcesOpen((v) => !v)}
            aria-expanded={sourcesOpen}
            aria-controls={`pedagogical-sources-${index}`}
          >
            <BookOpen size={12} aria-hidden />
            <span>{sourcesOpen ? "Masquer les sources" : "Afficher les sources"}</span>
            {sourcesOpen ? (
              <ChevronUp size={12} aria-hidden />
            ) : (
              <ChevronDown size={12} aria-hidden />
            )}
          </button>
          {sourcesOpen ? (
            <div
              id={`pedagogical-sources-${index}`}
              className="pedagogical-sources__body"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {block.sources}
              </ReactMarkdown>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rendu spécialisé réponses pédagogiques tabulaires (1 ou N tableaux) :
 * intro → table (scroll) → note → à retenir → sources à la demande.
 */
export default function PedagogicalMarkdownMessage({ content = "" }) {
  const multi = useMemo(() => splitPedagogicalMarkdownBlocks(content), [content]);
  const contractOk = useMemo(
    () => validatePedagogicalTableResponse(content, { minRows: 3 }).ok,
    [content],
  );

  if (!multi.isPedagogical && !contractOk) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    );
  }

  const blocks = multi.blocks.length
    ? multi.blocks
    : [{ intro: "", tableMd: content, note: "", takeaway: "", sources: "" }];

  return (
    <article className="message message--assistant message--pedagogical custom-markdown custom-markdown--pedagogical">
      {multi.preamble ? (
        <div className="message-intro pedagogical-preamble">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {multi.preamble}
          </ReactMarkdown>
        </div>
      ) : null}

      {blocks.map((block, index) => (
        <PedagogicalTableBlock
          key={`pedagogical-block-${index}`}
          block={block}
          index={index}
        />
      ))}
    </article>
  );
}

/** Détection UI : activer le composant dédié. */
export function isPedagogicalTableMessage(content = "") {
  const multi = splitPedagogicalMarkdownBlocks(content);
  return (
    multi.isPedagogical ||
    validatePedagogicalTableResponse(content, { minRows: 3 }).ok
  );
}
