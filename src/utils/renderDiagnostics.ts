export interface RenderErrorDiagnostics {
  message: string;
  componentStack: string;
  label: string;
  url: string;
  userAgent: string;
  at: string;
  /** Extensions that rewrite the page are the usual cause of DOM desync. */
  domSignals: string[];
}

const STORAGE_KEY = 'ECOM_STUDIO_LAST_RENDER_ERROR';

/**
 * Collects traces of scripts or attributes that were not produced by this app.
 * Translation and reader extensions leave these behind, and they explain most
 * "node is not a child of this node" failures.
 */
function collectDomSignals(): string[] {
  const signals: string[] = [];
  try {
    const injectedScripts = [...document.querySelectorAll('script[src]')]
      .map((node) => (node as HTMLScriptElement).src)
      .filter((src) => src && !src.startsWith(location.origin));
    if (injectedScripts.length) signals.push(`external scripts: ${injectedScripts.join(', ')}`);

    const suspiciousAttributes = ['data-immersive-translate-walked', 'data-translate', 'x-bergamot-translated', 'data-gt-block'];
    for (const attribute of suspiciousAttributes) {
      const count = document.querySelectorAll(`[${attribute}]`).length;
      if (count) signals.push(`${attribute}: ${count} nodes`);
    }

    const fontWrappers = document.querySelectorAll('font').length;
    if (fontWrappers) signals.push(`<font> wrappers: ${fontWrappers} (typical of page translators)`);

    const rootChildren = document.getElementById('root')?.children.length ?? -1;
    if (rootChildren !== 1) signals.push(`#root has ${rootChildren} children`);

    const bodyTags = [...document.body.children].map((node) => node.tagName).join(',');
    signals.push(`body children: ${bodyTags}`);
  } catch (error) {
    signals.push(`signal collection failed: ${String(error)}`);
  }
  return signals;
}

export function recordRenderError(error: Error, componentStack: string, label: string): RenderErrorDiagnostics {
  const diagnostics: RenderErrorDiagnostics = {
    message: error.message,
    componentStack: (componentStack || '').split('\n').slice(0, 25).join('\n'),
    label,
    url: location.href,
    userAgent: navigator.userAgent,
    at: new Date().toISOString(),
    domSignals: collectDomSignals()
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(diagnostics));
  } catch {
    // Storage is a convenience only; the console log below is the real record.
  }
  console.error('[render-diagnostics]', diagnostics);
  return diagnostics;
}

export function formatDiagnostics(diagnostics: RenderErrorDiagnostics): string {
  return [
    `错误: ${diagnostics.message}`,
    `位置: ${diagnostics.label}`,
    `时间: ${diagnostics.at}`,
    `页面: ${diagnostics.url}`,
    `UA: ${diagnostics.userAgent}`,
    `DOM 信号:\n  ${diagnostics.domSignals.join('\n  ')}`,
    `组件栈:${diagnostics.componentStack}`
  ].join('\n');
}
