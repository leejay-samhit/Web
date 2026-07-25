// All /admin/* route configs — extracted from App.js (code-review feedback).
// Returned as an array so App.js can map them into <Route> children inside
// React Router's <Routes>.
import { Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

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
import AdminShopLayout from "@/pages/admin/AdminShopLayout";
import AdminShopCategories from "@/pages/admin/AdminShopCategories";
import AdminPromoBanners from "@/pages/admin/AdminPromoBanners";
import AdminAdmins from "@/pages/admin/AdminAdmins";
import AdminApprovedRegistrations from "@/pages/admin/AdminApprovedRegistrations";
import AdminRejectedRegistrations from "@/pages/admin/AdminRejectedRegistrations";
import AdminPaymentGateway from "@/pages/admin/AdminPaymentGateway";
import AdminVendorApplications from "@/pages/admin/AdminVendorApplications";
import AdminServiceApplications from "@/pages/admin/AdminServiceApplications";
import AdminServiceCategories from "@/pages/admin/AdminServiceCategories";
import AdminServiceAnalytics from "@/pages/admin/AdminServiceAnalytics";
import AdminDistributors from "@/pages/admin/AdminDistributors";
import AdminSystemWallet from "@/pages/admin/AdminSystemWallet";
import AdminVendors from "@/pages/admin/AdminVendors";
import AdminBackups from "@/pages/admin/AdminBackups";
import AdminChanges from "@/pages/admin/AdminChanges";
import AdminTransactions from "@/pages/admin/AdminTransactions";
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminUPIPayments from "@/pages/admin/AdminUPIPayments";
import AdminLegalPages from "@/pages/admin/AdminLegalPages";
import AdminExports from "@/pages/admin/AdminExports";
import AdminLanding from "@/pages/admin/AdminLanding";
import AdminOnboardingTerms from "@/pages/admin/AdminOnboardingTerms";
import AdminErpSettings from "@/pages/admin/AdminErpSettings";

const g = (el) => <ProtectedRoute adminOnly>{el}</ProtectedRoute>;

export const adminRoutes = [
  { path: "/admin", element: <Navigate to="/admin/analytics" replace /> },
  { path: "/admin/analytics", element: g(<AdminAnalytics />) },
  { path: "/admin/users", element: g(<AdminUsers />) },
  { path: "/admin/approvals", element: g(<AdminApprovals />) },
  { path: "/admin/kyc", element: g(<AdminKYC />) },
  { path: "/admin/withdrawals", element: g(<AdminWithdrawals />) },
  { path: "/admin/tickets", element: g(<AdminTickets />) },
  { path: "/admin/products", element: g(<AdminProducts />) },
  { path: "/admin/orders", element: g(<AdminOrders />) },
  { path: "/admin/broadcast", element: g(<AdminBroadcast />) },
  { path: "/admin/branding", element: g(<AdminBranding />) },

  // Store
  { path: "/admin/shop-layout", element: g(<AdminShopLayout />) },
  { path: "/admin/shop-categories", element: g(<AdminShopCategories />) },
  { path: "/admin/promo-banners", element: g(<AdminPromoBanners />) },

  // Operations
  { path: "/admin/chat", element: g(<Navigate to="/chat" replace />) },
  { path: "/admin/admins", element: g(<AdminAdmins />) },
  { path: "/admin/approved-registrations", element: g(<AdminApprovedRegistrations />) },
  { path: "/admin/rejected-registrations", element: g(<AdminRejectedRegistrations />) },
  { path: "/admin/payment-gateway", element: g(<AdminPaymentGateway />) },
  { path: "/admin/vendor-applications", element: g(<AdminVendorApplications />) },
  { path: "/admin/service-applications", element: g(<AdminServiceApplications />) },
  { path: "/admin/service-categories", element: g(<AdminServiceCategories />) },
  { path: "/admin/service-analytics", element: g(<AdminServiceAnalytics />) },
  { path: "/admin/distributors", element: g(<AdminDistributors />) },
  { path: "/admin/system-wallet", element: g(<AdminSystemWallet />) },
  { path: "/admin/vendors", element: g(<AdminVendors />) },
  { path: "/admin/backups", element: g(<AdminBackups />) },
  { path: "/admin/changes", element: g(<AdminChanges />) },
  { path: "/admin/transactions", element: g(<AdminTransactions />) },
  { path: "/admin/audit-logs", element: g(<AdminAuditLogs />) },
  { path: "/admin/settings", element: g(<AdminSettings />) },
  { path: "/admin/upi-payments", element: g(<AdminUPIPayments />) },
  { path: "/admin/legal-pages", element: g(<AdminLegalPages />) },
  { path: "/admin/landing", element: g(<AdminLanding />) },
  { path: "/admin/onboarding-terms", element: g(<AdminOnboardingTerms />) },
  { path: "/admin/erp-settings", element: g(<AdminErpSettings />) },

  // Export
  { path: "/admin/exports", element: g(<AdminExports />) },
];
