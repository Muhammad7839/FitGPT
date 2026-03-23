import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.warn("ErrorBoundary caught:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="errorBoundaryFallback">
          <div className="errorBoundaryIcon">&#x26A0;</div>
          <div className="errorBoundaryMsg">Something went wrong.</div>
          {process.env.NODE_ENV !== "production" && this.state.error ? (
            <div className="errorBoundaryDetails">
              {(this.state.error?.message || this.state.error?.toString() || "").toString()}
            </div>
          ) : null}
          <button
            className="btn"
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
