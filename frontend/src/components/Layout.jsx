import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Wrench,
  MessageCircle,
  Wallet,
  Users,
  User,
  LogOut,
  ShoppingCart,
  Bell,
  Heart,
  LifeBuoy,
  Calendar,
  Store,
  IdCard,
  Menu,
  X as CloseIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { initials, isAdmin } from "@/lib/utils";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { log } from "@/lib/log";
import { adminGroups } from "@/constants/adminNav";

const SIDEBAR_STATE_KEY = "sc_sidebar_collapsed_v1";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
  { to: "/shop", icon: ShoppingBag, label: "Shop", testid: "nav-shop" },
  { to: "/wishlist", icon: Heart, label: "Wishlist", testid: "nav-wishlist" },
  { to: "/services", icon: Wrench, label: "Services", testid: "nav-services" },
  { to: "/bookings", icon: Calendar, label: "My bookings", testid: "nav-bookings" },
  { to: "/chat", icon: MessageCircle, label: "Slang-Connect", testid: "nav-chat" },
  { to: "/wallet", icon: Wallet, label: "Wallet", testid: "nav-wallet" },
  { to: "/network", icon: Users, label: "Network", testid: "nav-network" },
  { to: "/vendor", icon: Store, label: "My shop", testid: "nav-vendor" },
  { to: "/support", icon: LifeBuoy, label: "Support", testid: "nav-support" },
  { to: "/kyc", icon: IdCard, label: "KYC", testid: "nav-kyc" },
  { to: "/profile", icon: User, label: "Profile", testid: "nav-profile" },
];

const mobileNav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home", testid: "tab-dashboard" },
  { to: "/shop", icon: ShoppingBag, label: "Shop", testid: "tab-shop" },
  { to: "/chat", icon: MessageCircle, label: "Chat", testid: "tab-chat" },
  { to: "/wallet", icon: Wallet, label: "Wallet", testid: "tab-wallet" },
];

function NotifBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get("/notifications/me");
        const arr = Array.isArray(data) ? data : data?.items || [];
        const unread = arr.filter((n) => !n.read).length;
        if (alive) setCount(unread);
      } catch (error) {
        log.error("NotifBell.load failed", error);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <Link
      to="/notifications"
      data-testid="notifications-bell"
      className="relative w-10 h-10 rounded-full bg-white border border-[color:var(--sc-border)] flex items-center justify-center hover:bg-[color:var(--sc-accent-light)]"
    >
      <Bell size={18} className="text-[color:var(--sc-ink)]" />
      {count > 0 && (
        <span
          data-testid="notifications-badge"
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--sc-primary)] text-white text-[10px] font-bold flex items-center justify-center"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const nav = useNavigate();
  const admin = isAdmin(user);

  // Persistent sidebar collapse (desktop only). Read once, persist on toggle.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_STATE_KEY) === "1"; } catch { return false; }
  });
  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_STATE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[color:var(--sc-bg)] flex">
      {/* Sidebar — collapses to icon rail on desktop when toggled */}
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed ? "1" : "0"}
        className={`hidden lg:flex shrink-0 border-r border-[color:var(--sc-border)] bg-white flex-col transition-[width] duration-300 ease-out ${collapsed ? "w-16" : "w-64"}`}
      >
        <div className={`border-b border-[color:var(--sc-border)] flex items-center ${collapsed ? "px-2 py-4 justify-center" : "px-6 py-5 justify-between gap-2"}`}>
          <Link to="/dashboard" data-testid="brand-link" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold shrink-0">
              S
            </div>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <div className="font-extrabold text-[color:var(--sc-ink)] truncate">Slangcart</div>
                <div className="text-[11px] text-[color:var(--sc-ink-muted)] truncate">Shop · Service · Connect</div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              data-testid="sidebar-toggle"
              title="Collapse sidebar"
              className="w-8 h-8 rounded-lg hover:bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-primary)] shrink-0"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggleSidebar}
            data-testid="sidebar-toggle"
            title="Expand sidebar"
            className="mx-2 my-2 w-12 h-9 rounded-lg hover:bg-[color:var(--sc-accent-light)] grid place-items-center text-[color:var(--sc-ink-muted)] hover:text-[color:var(--sc-primary)]"
          >
            <Menu size={18} />
          </button>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              title={collapsed ? it.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl text-sm font-semibold transition ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"} ${
                  isActive
                    ? "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"
                    : "text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]/60"
                }`
              }
            >
              <it.icon size={18} />
              {!collapsed && it.label}
            </NavLink>
          ))}
          {admin && (
            <>
              {adminGroups.map((group) => (
                <div key={group.title}>
                  {!collapsed && (
                    <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider text-[color:var(--sc-ink-muted)] font-bold">
                      {group.title}
                    </div>
                  )}
                  {collapsed && <div className="my-2 border-t border-[color:var(--sc-border)]" />}
                  {group.items.map((a) => (
                    <NavLink
                      key={a.to}
                      to={a.to}
                      title={collapsed ? a.label : undefined}
                      data-testid={`admin-nav-${a.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl text-sm font-semibold transition ${collapsed ? "px-0 py-2 justify-center" : "px-3 py-2"} ${
                          isActive
                            ? "bg-[color:var(--sc-accent-light)] text-[color:var(--sc-primary-700)]"
                            : "text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)]/60"
                        }`
                      }
                    >
                      <a.icon size={16} />
                      {!collapsed && a.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-[color:var(--sc-border)] p-3">
          <button
            data-testid="logout-btn"
            onClick={async () => {
              await logout();
              nav("/login");
            }}
            title={collapsed ? "Log out" : undefined}
            className={`w-full flex items-center gap-2 rounded-xl text-sm font-semibold text-[color:var(--sc-error)] hover:bg-red-50 ${collapsed ? "justify-center py-2.5" : "px-3 py-2.5"}`}
          >
            <LogOut size={16} /> {!collapsed && "Log out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-[color:var(--sc-border)]">
          <div className="px-4 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Desktop hamburger toggle — expands sidebar to full or hides it */}
              <button
                onClick={toggleSidebar}
                data-testid="topbar-sidebar-toggle"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:grid w-10 h-10 rounded-lg border border-[color:var(--sc-border)] place-items-center text-[color:var(--sc-ink)] hover:bg-[color:var(--sc-accent-light)] hover:text-[color:var(--sc-primary)] transition"
              >
                <Menu size={18} />
              </button>
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--sc-primary)] text-white grid place-items-center font-extrabold">
                  S
                </div>
                <span className="font-extrabold text-[color:var(--sc-ink)]">Slangcart</span>
              </div>
              <h1 data-testid="page-title" className="hidden lg:block text-lg font-extrabold text-[color:var(--sc-ink)] ml-1">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/wishlist"
                data-testid="header-wishlist"
                className="relative w-10 h-10 rounded-full bg-white border border-[color:var(--sc-border)] flex items-center justify-center hover:bg-[color:var(--sc-accent-light)]"
                title="Wishlist"
              >
                <Heart size={18} className="text-[color:var(--sc-ink)]" />
              </Link>
              <Link
                to="/cart"
                data-testid="header-cart"
                className="relative w-10 h-10 rounded-full bg-white border border-[color:var(--sc-border)] flex items-center justify-center hover:bg-[color:var(--sc-accent-light)]"
              >
                <ShoppingCart size={18} className="text-[color:var(--sc-ink)]" />
                {cart.count > 0 && (
                  <span
                    data-testid="cart-badge"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--sc-primary)] text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {cart.count}
                  </span>
                )}
              </Link>
              <NotifBell />
              <Link
                to="/profile"
                data-testid="header-avatar"
                className="w-10 h-10 rounded-full sc-avatar text-white font-bold grid place-items-center overflow-hidden"
              >
                {user?.profile_image ? (
                  <img alt="" src={user.profile_image} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{initials(user?.name)}</span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 overflow-x-hidden">
          <div className="lg:hidden mb-3">
            <h1 className="text-2xl font-extrabold text-[color:var(--sc-ink)]">{title}</h1>
          </div>
          {children}
        </main>

        {/* Mobile bottom tabs (right padding keeps clear of platform 'Made with Emergent' badge) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[9999] bg-white border-t border-[color:var(--sc-border)] pr-44">
          <div className="grid grid-cols-4">
            {mobileNav.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                data-testid={m.testid}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2.5 text-[11px] font-semibold transition ${
                    isActive ? "text-[color:var(--sc-primary)]" : "text-[color:var(--sc-ink-muted)]"
                  }`
                }
              >
                <m.icon size={20} />
                <span className="mt-0.5">{m.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
