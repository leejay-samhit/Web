import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminBroadcast from "@/pages/admin/AdminBroadcast";
import AdminBranding from "@/pages/admin/AdminBranding";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import AdminKYC from "@/pages/admin/AdminKYC";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminTickets from "@/pages/admin/AdminTickets";

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

              {/* User area */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
              <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute><ServiceBookings /></ProtectedRoute>} />
              <Route path="/become-provider" element={<ProtectedRoute><BecomeProvider /></ProtectedRoute>} />
              <Route path="/become-vendor" element={<ProtectedRoute><BecomeVendor /></ProtectedRoute>} />
              <Route path="/vendor" element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
              <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
              <Route path="/support/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />

              {/* Admin area */}
              <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
              <Route path="/admin/analytics" element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/approvals" element={<ProtectedRoute adminOnly><AdminApprovals /></ProtectedRoute>} />
              <Route path="/admin/kyc" element={<ProtectedRoute adminOnly><AdminKYC /></ProtectedRoute>} />
              <Route path="/admin/withdrawals" element={<ProtectedRoute adminOnly><AdminWithdrawals /></ProtectedRoute>} />
              <Route path="/admin/tickets" element={<ProtectedRoute adminOnly><AdminTickets /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute adminOnly><AdminProducts /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminOrders /></ProtectedRoute>} />
              <Route path="/admin/broadcast" element={<ProtectedRoute adminOnly><AdminBroadcast /></ProtectedRoute>} />
              <Route path="/admin/branding" element={<ProtectedRoute adminOnly><AdminBranding /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
