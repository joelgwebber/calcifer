/**
 * Document/prose primitive (calcifer-7b34).
 *
 * Renders a markdown string. Deliberately source-agnostic and context-portable:
 * it takes raw markdown and knows nothing about wikis, routes, or where the text
 * came from — a wiki file, an apartment's `notes`, or an agent-authored blob all
 * render through this one component. Link *semantics* are a context decision, so
 * the host passes an `onNavigate` callback; the primitive only distinguishes
 * external (open in a new tab) from internal (defer to the context).
 *
 * Safety: react-markdown does not render raw HTML unless rehype-raw is added, so
 * embedded HTML in wiki content is inert by default (no XSS surface).
 */
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ProseNav {
  /**
   * Called when a non-external link is clicked. Return true if the context
   * handled it (navigation is then suppressed); false to let the browser follow
   * the href normally (e.g. in-page anchors, or links the context doesn't own).
   */
  onNavigate?: (href: string) => boolean;
}

function isExternal(href: string): boolean {
  return /^[a-z]+:/i.test(href) || href.startsWith('//');
}

export function Prose({ markdown, nav }: { markdown: string; nav?: ProseNav }): ReactNode {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...rest }) {
            const h = href ?? '';
            if (h && !isExternal(h) && nav?.onNavigate) {
              return (
                <a
                  href={h}
                  onClick={(e) => {
                    if (nav.onNavigate!(h)) e.preventDefault();
                  }}
                  {...rest}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={h} target="_blank" rel="noreferrer noopener" {...rest}>
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
