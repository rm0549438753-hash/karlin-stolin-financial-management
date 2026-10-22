import * as React from "react";

type State = { error: Error | null };

/** Catches a crash inside one section so the rest of the screen keeps working. */
export class SectionBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[SectionBoundary]", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3" dir="rtl">
        <p className="font-semibold">החלק הזה נתקע</p>
        <p className="text-sm text-muted-foreground">שאר המסך ממשיך לעבוד. אפשר לנסות לטעון שוב רק את החלק הזה.</p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => this.setState({ error: null })}
        >
          נסה שוב
        </button>
      </div>
    );
  }
}
