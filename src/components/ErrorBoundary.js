import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleEmergencyClear = () => {
    if (window.confirm("This will permanently delete your corrupt local session and reset the app. Continue?")) {
      localStorage.removeItem('pb_session');
      localStorage.removeItem('pb_roster');
      localStorage.removeItem('migration_completed');
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
          <div className="bg-dark-gray border border-red-500 rounded-xl p-6 max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-500 mb-2">UI Render Crash Detected</h1>
            <p className="text-gray text-sm mb-6">
              It looks like your session data became corrupted and caused the application to freeze.
            </p>
            <p className="text-xs text-red-400 font-mono bg-black/50 p-2 rounded mb-6 text-left overflow-auto max-h-32">
              {this.state.error && this.state.error.toString()}
            </p>
            <button
              onClick={this.handleEmergencyClear}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Emergency Clear Session & Recover
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full mt-3 bg-transparent border border-gray text-gray hover:text-white hover:border-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Attempt Re-load
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
