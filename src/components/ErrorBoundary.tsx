import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { requestAppRemount } from '../utils/appRemount';
import { formatDiagnostics, recordRenderError, type RenderErrorDiagnostics } from '../utils/renderDiagnostics';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown instead of the full-page card when a nested workspace fails. */
  variant?: 'page' | 'panel';
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped to remount the subtree after a recoverable DOM desync. */
  remountKey: number;
  recoveryAttempts: number;
  diagnostics: RenderErrorDiagnostics | null;
  copied: boolean;
}

// This project ships without @types/react, so `Component` resolves to `any` and
// inherited members are invisible to tsc. Describe the base surface explicitly.
type ErrorBoundaryBase = new (props: ErrorBoundaryProps) => {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState;
  setState(
    next: Partial<ErrorBoundaryState> | ((prev: ErrorBoundaryState) => Partial<ErrorBoundaryState>)
  ): void;
};

const BaseComponent = Component as unknown as ErrorBoundaryBase;

/** After this much uninterrupted rendering, past failures stop counting. */
const STABLE_RESET_MS = 15000;

/**
 * Errors raised when the React virtual tree and the real DOM disagree. They are
 * usually caused by something outside React mutating managed nodes (translation
 * or reader browser extensions are the common source).
 */
const DOM_DESYNC_PATTERN = /insertBefore|removeChild|appendChild|NotFoundError|is not a child of this node|不是此节点的子节点/i;

export function isRecoverableDomError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return DOM_DESYNC_PATTERN.test(message);
}

/**
 * Prevents a single render-time exception from blanking the workspace.
 *
 * Recovery escalates, because a DOM desync corrupts the container the subtree
 * lives in rather than just the subtree:
 *   1. remount the subtree with a fresh key,
 *   2. if that fails again, rebuild the whole React root from clean markup,
 *   3. only then show a recovery card, with copyable diagnostics.
 */
export class ErrorBoundary extends BaseComponent {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, remountKey: 0, recoveryAttempts: 0, diagnostics: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  private scheduleAttemptReset() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.setState({ recoveryAttempts: 0 });
    }, STABLE_RESET_MS);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label || (this.props.variant === 'panel' ? '工作区' : '应用根');
    const diagnostics = recordRenderError(error, info?.componentStack || '', label);
    this.setState({ diagnostics });

    if (!isRecoverableDomError(error)) return;

    const attempts = this.state.recoveryAttempts;

    if (attempts === 0) {
      // First try: rebuild just this subtree.
      this.setState((prev) => ({
        error: null,
        remountKey: prev.remountKey + 1,
        recoveryAttempts: prev.recoveryAttempts + 1
      }));
      this.scheduleAttemptReset();
      return;
    }

    if (attempts === 1) {
      // The subtree remount hit the same broken parent, so discard the entire
      // root. Deferred to a macrotask so React finishes this commit first.
      this.setState((prev) => ({ recoveryAttempts: prev.recoveryAttempts + 1 }));
      setTimeout(() => {
        if (!requestAppRemount()) {
          console.warn('No app remount handler registered; leaving the recovery card visible.');
        }
      }, 0);
    }
  }

  private handleRetry = () => {
    // A manual retry gets the strongest option straight away.
    if (requestAppRemount()) return;
    this.setState((prev) => ({ error: null, remountKey: prev.remountKey + 1, recoveryAttempts: 0 }));
  };

  private handleCopyDiagnostics = async () => {
    const { diagnostics } = this.state;
    if (!diagnostics) return;
    const text = formatDiagnostics(diagnostics);
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
    } catch {
      console.info('[render-diagnostics] clipboard unavailable, printing instead:\n' + text);
      this.setState({ copied: true });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocalState = () => {
    try {
      for (const key of ['CUSTOM_PROMPT_CONFIG', 'CUSTOM_IMAGE_CONFIG', 'SELECTED_PROMPT_MODEL', 'SELECTED_IMAGE_MODEL']) {
        localStorage.removeItem(key);
      }
    } catch (storageError) {
      console.warn('Unable to clear local model config:', storageError);
    }
    window.location.reload();
  };

  render() {
    const { error, remountKey, diagnostics, copied } = this.state;
    const { children, variant = 'page', label } = this.props;

    // The key makes a recovery attempt discard the corrupted subtree instead of
    // trying to patch it in place.
    if (!error) return <Fragment key={remountKey}>{children}</Fragment>;

    const detail = (
      <pre className="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
        {error.message}
        {diagnostics?.domSignals.length ? '\n\n' + diagnostics.domSignals.join('\n') : ''}
      </pre>
    );

    const copyButton = diagnostics ? (
      <button
        type="button"
        onClick={this.handleCopyDiagnostics}
        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700"
      >
        {copied ? '诊断信息已复制' : '复制诊断信息'}
      </button>
    ) : null;

    if (variant === 'panel') {
      return (
        <div className="max-w-3xl mx-auto my-10 w-full bg-slate-900 border border-amber-500/40 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-amber-300">
            {label ? `${label}加载失败` : '该工作区加载失败'}
          </h2>
          <p className="text-sm text-slate-300">
            其他工作区仍可使用。可以先重试加载；若再次失败，请重新加载页面。若浏览器装了网页翻译或阅读增强类扩展，请在本页面停用后重试。
          </p>
          {detail}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-slate-950"
            >
              重试加载
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700"
            >
              重新加载页面
            </button>
            {copyButton}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-rose-300">界面渲染出错</h1>
          <p className="text-sm text-slate-300">
            工作区遇到一个未预期的错误，已阻止白屏。可以先重试恢复或重新加载页面；若反复出现，请清空本地模型配置后重试。
          </p>
          {detail}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            >
              重试恢复界面
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700"
            >
              重新加载页面
            </button>
            <button
              type="button"
              onClick={this.handleResetLocalState}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700"
            >
              清空本地模型配置并重载
            </button>
            {copyButton}
          </div>
        </div>
      </div>
    );
  }
}
