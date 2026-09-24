import { Component } from "react";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-loading-state" role="alert">
          <div>
            <h1>Không thể tải ứng dụng</h1>
            <p>Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy thử lại sau ít phút.</p>
            <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
