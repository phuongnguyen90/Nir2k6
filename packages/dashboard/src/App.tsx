import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { RequireAuth, useAuth } from "./auth";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Overview } from "./pages/Overview";
import { ChildDetail } from "./pages/ChildDetail";
import { DeviceDetail } from "./pages/DeviceDetail";

function TopNav() {
  const { parent, logout } = useAuth();
  const navigate = useNavigate();
  if (!parent) return null;

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to="/" className="brand" aria-label="Hearth home">
          <span className="brand-mark" aria-hidden="true">
            🏠
          </span>
          <span className="brand-name">Hearth</span>
        </Link>
        <div className="topnav-right">
          <span className="topnav-user" title={parent.email}>
            {parent.displayName}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

export function App() {
  return (
    <div className="app">
      <TopNav />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Overview />
              </RequireAuth>
            }
          />
          <Route
            path="/children/:childId"
            element={
              <RequireAuth>
                <ChildDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:deviceId"
            element={
              <RequireAuth>
                <DeviceDetail />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
