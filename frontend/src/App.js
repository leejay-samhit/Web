import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Services from "@/pages/Services";
import ServiceBookings from "@/pages/ServiceBookings";
import BecomeProvider from "@/pages/BecomeProvider";
import BecomeVendor from "@/pages/BecomeVendor";
import VendorDashboard from "@/pages/VendorDashboard";
import VendorOrders from "@/pages/vendor/VendorOrders";
import VendorSales from "@/pages/vendor/VendorSales";
import VendorSubstore from "@/pages/vendor/VendorSubstore";
import VendorPOS from "@/pages/vendor/VendorPOS";
import VendorInvoices from "@/pages/vendor/VendorInvoices";
import VendorCashSummary from "@/pages/vendor/VendorCashSummary";
import VendorAnalytics from "@/pages/vendor/VendorAnalytics";
import VendorSettings from "@/pages/vendor/VendorSettings";
import Chat from "@/pages/Chat";
import Wallet from "@/pages/Wallet";
import Network from "@/pages/Network";
import Profile from "@/pages/Profile";
import Orders from "@/pages/Orders";
import Notifications from "@/pages/Notifications";
import Wishlist from "@/pages/Wishlist";
import KYC from "@/pages/KYC";
import Tickets from "@/pages/Tickets";
import TicketDetail from "@/pages/TicketDetail";
import Legal from "@/pages/Legal";
import { adminRoutes } from "@/AdminRoutes";

const userGuard = (el) => <ProtectedRoute>{el}</ProtectedRoute>;

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Public legal pages */}
              <Route path="/legal/:kind" element={<Legal />} />

              {/* Public marketing landing page — authenticated users are
                  auto-forwarded to /dashboard inside <Landing/>. */}
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={userGuard(<Dashboard />)} />
              <Route path="/shop" element={userGuard(<Shop />)} />
              <Route path="/product/:id" element={userGuard(<ProductDetail />)} />
              <Route path="/cart" element={userGuard(<Cart />)} />
              <Route path="/checkout" element={userGuard(<Checkout />)} />
              <Route path="/orders" element={userGuard(<Orders />)} />
              <Route path="/wishlist" element={userGuard(<Wishlist />)} />
              <Route path="/services" element={userGuard(<Services />)} />
              <Route path="/bookings" element={userGuard(<ServiceBookings />)} />
              <Route path="/become-provider" element={userGuard(<BecomeProvider />)} />
              <Route path="/become-vendor" element={userGuard(<BecomeVendor />)} />
              <Route path="/vendor" element={userGuard(<VendorDashboard />)} />
              <Route path="/vendor/orders" element={userGuard(<VendorOrders />)} />
              <Route path="/vendor/sales" element={userGuard(<VendorSales />)} />
              <Route path="/vendor/pos" element={userGuard(<VendorPOS />)} />
              <Route path="/vendor/invoices" element={userGuard(<VendorInvoices />)} />
              <Route path="/vendor/cash" element={userGuard(<VendorCashSummary />)} />
              <Route path="/vendor/substore" element={userGuard(<VendorSubstore />)} />
              <Route path="/vendor/analytics" element={userGuard(<VendorAnalytics />)} />
              <Route path="/vendor/settings" element={userGuard(<VendorSettings />)} />
              <Route path="/chat" element={userGuard(<Chat />)} />
              <Route path="/wallet" element={userGuard(<Wallet />)} />
              <Route path="/network" element={userGuard(<Network />)} />
              <Route path="/profile" element={userGuard(<Profile />)} />
              <Route path="/kyc" element={userGuard(<KYC />)} />
              <Route path="/notifications" element={userGuard(<Notifications />)} />
              <Route path="/support" element={userGuard(<Tickets />)} />
              <Route path="/support/:id" element={userGuard(<TicketDetail />)} />

              {/* Admin area — config-driven, see AdminRoutes.jsx */}
              {adminRoutes.map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
              ))}

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
