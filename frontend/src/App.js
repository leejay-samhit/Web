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
import ErpHub from "@/pages/vendor/erp/ErpHub";
import ErpProducts from "@/pages/vendor/erp/ErpProducts";
import ErpPurchaseBook from "@/pages/vendor/erp/ErpPurchaseBook";
import ErpInventory from "@/pages/vendor/erp/ErpInventory";
import ErpBilling from "@/pages/vendor/erp/ErpBilling";
import ErpPriceLock from "@/pages/vendor/erp/ErpPriceLock";
import ErpAccounts from "@/pages/vendor/erp/ErpAccounts";
import ErpProfit from "@/pages/vendor/erp/ErpProfit";
import ErpGst from "@/pages/vendor/erp/ErpGst";
import ErpGstAssistant from "@/pages/vendor/erp/ErpGstAssistant";
import ErpBusinessProfile from "@/pages/vendor/erp/ErpBusinessProfile";
import ErpCompliance from "@/pages/vendor/erp/ErpCompliance";
import ErpReminders from "@/pages/vendor/erp/ErpReminders";
import ErpIncomeTax from "@/pages/vendor/erp/ErpIncomeTax";
import ErpFinancialHealth from "@/pages/vendor/erp/ErpFinancialHealth";
import ErpReports from "@/pages/vendor/erp/ErpReports";
import ErpSearch from "@/pages/vendor/erp/ErpSearch";
import ErpRoles from "@/pages/vendor/erp/ErpRoles";
import ErpAudit from "@/pages/vendor/erp/ErpAudit";
import ErpOwnerSettings from "@/pages/vendor/erp/ErpOwnerSettings";
import ErpLearn from "@/pages/vendor/erp/ErpLearn";
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
              <Route path="/vendor/erp" element={userGuard(<ErpHub />)} />
              <Route path="/vendor/erp/products" element={userGuard(<ErpProducts />)} />
              <Route path="/vendor/erp/purchase-book" element={userGuard(<ErpPurchaseBook />)} />
              <Route path="/vendor/erp/inventory" element={userGuard(<ErpInventory />)} />
              <Route path="/vendor/erp/billing" element={userGuard(<ErpBilling />)} />
              <Route path="/vendor/erp/price-lock" element={userGuard(<ErpPriceLock />)} />
              <Route path="/vendor/erp/accounts" element={userGuard(<ErpAccounts />)} />
              <Route path="/vendor/erp/profit" element={userGuard(<ErpProfit />)} />
              <Route path="/vendor/erp/gst" element={userGuard(<ErpGst />)} />
              <Route path="/vendor/erp/gst-assistant" element={userGuard(<ErpGstAssistant />)} />
              <Route path="/vendor/erp/business-profile" element={userGuard(<ErpBusinessProfile />)} />
              <Route path="/vendor/erp/compliance" element={userGuard(<ErpCompliance />)} />
              <Route path="/vendor/erp/reminders" element={userGuard(<ErpReminders />)} />
              <Route path="/vendor/erp/income-tax" element={userGuard(<ErpIncomeTax />)} />
              <Route path="/vendor/erp/financial-health" element={userGuard(<ErpFinancialHealth />)} />
              <Route path="/vendor/erp/reports" element={userGuard(<ErpReports />)} />
              <Route path="/vendor/erp/search" element={userGuard(<ErpSearch />)} />
              <Route path="/vendor/erp/roles" element={userGuard(<ErpRoles />)} />
              <Route path="/vendor/erp/audit" element={userGuard(<ErpAudit />)} />
              <Route path="/vendor/erp/security" element={userGuard(<ErpOwnerSettings />)} />
              <Route path="/vendor/erp/learn" element={userGuard(<ErpLearn />)} />
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
