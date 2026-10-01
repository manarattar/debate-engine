import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Munazara crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash-card">
          <h1>Something went wrong</h1>
          <p>The page hit an error and stopped. Reload it to carry on. Finished debates are saved and appear in the debates list.</p>
          <p className="crash-detail">{String(this.state.error.message || this.state.error)}</p>
          <button onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      </div>
    );
  }
}
