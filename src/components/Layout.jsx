import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Collapse the phone menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">☕</span>
          <div>
            <strong>TRIO Cafe</strong>
            <small>Order booking</small>
          </div>
        </div>

        <button
          className="nav-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <div className={`topbar-collapse ${menuOpen ? 'open' : ''}`}>
          <nav className="nav">
            <NavLink to="/orders/new">New Order</NavLink>
            <NavLink to="/orders">Orders</NavLink>
            {isAdmin && <NavLink to="/admin/menu">Menu</NavLink>}
            {isAdmin && <NavLink to="/admin/logs">Order Logs</NavLink>}
          </nav>

          <div className="user-box">
            <div className="user-meta">
              <span>{user?.name}</span>
              <small className={`role role-${user?.role}`}>{user?.role}</small>
            </div>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
