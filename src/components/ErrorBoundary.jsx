import React from "react";

/**
 * Shows a readable crash message instead of a blank white screen.
 * Useful when debugging on a real phone without Safari Web Inspector.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crash:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error);
    const stack = this.state.error?.stack || "";

    return (
      <div className="min-h-screen bg-white p-4 text-left">
        <h1 className="font-heading font-bold text-lg text-red-600 mb-2">Something broke on this page</h1>
        <p className="text-sm text-muted-foreground mb-3">
          Screenshot this and send it so we can fix the phone crash.
        </p>
        <pre className="text-xs whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded-xl p-3 text-red-800 mb-3">
          {message}
        </pre>
        {stack ? (
          <pre className="text-[10px] whitespace-pre-wrap break-words bg-muted/40 rounded-xl p-3 text-muted-foreground max-h-64 overflow-auto">
            {stack}
          </pre>
        ) : null}
        <button
          type="button"
          className="mt-4 rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-sm font-medium px-4 py-2"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
