import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

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

const MAX_AUTO_RECOVERIES = 2;

/**
 * Errors raised when the React virtual tree and the real DOM disagree. They are
 * usually caused by something outside React mutating managed nodes (translation
 * or reader browser extensions are the common source), and remounting the
 * subtree restores a consistent tree without losing the whole page.
 */
const DOM_DESYNC_PATTERN = /insertBefore|removeChild|appendChild|NotFoundError|is not a child of this node|不是此节点的子节点/i;

export function isRecoverableDomError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return DOM_DESYNC_PATTERN.test(message);
}

/**
 * Prevents a single render-time exception (for example malformed persisted
 * config) from blanking the workspace. DOM desync errors are healed by
 * remounting the subtree; anything else surfaces a recovery card.
 */
export class ErrorBoundary extends BaseComponent {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, remountKey: 0, recoveryAttempts: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace render error:', error, info?.componentStack);

    if (isRecoverableDomError(error)) {
      this.setState((prev) => {
        if (prev.recoveryAttempts >= MAX_AUTO_RECOVERIES) return { error };
        return {
          error: null,
          remountKey: prev.remountKey + 1,
          recoveryAttempts: prev.recoveryAttempts + 1
        };
      });
    }
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, remountKey: prev.remountKey + 1, recoveryAttempts: 0 }));
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
    const { error, remountKey } = this.state;
    const { children, variant = 'page', label } = this.props;

    // The key makes a recovery attempt discard the corrupted subtree instead of
    // trying to patch it in place.
    if (!error) return <Fragment key={remountKey}>{children}</Fragment>;

    const detail = (
      <pre className="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
        {error.message}
      </pre>
    );

    if (variant === 'panel') {
      return (
        <div className="max-w-3xl mx-auto my-10 w-full bg-slate-900 border border-amber-500/40 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-bold text-amber-300">
            {label ? `${label}加载失败` : '该工作区加载失败'}
          </h2>
          <p className="text-sm text-slate-300">
            其他工作区仍可使用。可以先重试加载；若反复失败，请重新加载页面。
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
          </div>
        </div>
      </div>
    );
  }
}
