import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// This project ships without @types/react, so `Component` resolves to `any` and
// inherited members are invisible to tsc. Describe the base surface explicitly.
type ErrorBoundaryBase = new (props: ErrorBoundaryProps) => {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState;
  setState(next: Partial<ErrorBoundaryState>): void;
};

const BaseComponent = Component as unknown as ErrorBoundaryBase;

/**
 * Prevents a single render-time exception (for example malformed persisted
 * config) from blanking the entire workspace, and offers a recovery path that
 * clears local caches instead of leaving the user on a white screen.
 */
export class ErrorBoundary extends BaseComponent {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace render error:', error, info?.componentStack);
  }

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
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-rose-500/40 rounded-xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-rose-300">界面渲染出错</h1>
          <p className="text-sm text-slate-300">
            工作区遇到一个未预期的错误，已阻止白屏。可以先重新加载页面；若反复出现，请清空本地模型配置后重试。
          </p>
          <pre className="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
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
