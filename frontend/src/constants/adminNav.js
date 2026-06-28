// Admin sidebar navigation config — extracted from Layout.jsx to keep that
// component focused on layout/render concerns (code-review feedback).
import {
  ShoppingBag, ShieldCheck, MessageCircle, Wallet, Users, ShoppingCart, Bell,
  LifeBuoy, Store, IdCard, BarChart3, CheckSquare, ArrowDownToLine,
  Layout as LayoutIcon, Tag, Image as ImageIcon, UserCog, UserCheck, UserX,
  CreditCard, Briefcase, Wrench as ServiceIcon, PieChart, MapPin, Landmark,
  Database, ListChecks, Receipt, ScrollText, IndianRupee, QrCode, FileText,
  Download,
} from "lucide-react";

export const adminGroups = [
  {
    title: "Store",
    items: [
      { to: "/admin/products", label: "Products", icon: ShoppingBag },
      { to: "/admin/shop-layout", label: "Shop layout", icon: LayoutIcon },
      { to: "/admin/shop-categories", label: "Shop categories", icon: Tag },
      { to: "/admin/promo-banners", label: "Promo banners", icon: ImageIcon },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/chat", label: "Chat (team + users)", icon: MessageCircle },
      { to: "/admin/broadcast", label: "Broadcast", icon: Bell },
      { to: "/admin/admins", label: "Admin access", icon: UserCog },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/approvals", label: "User approvals", icon: CheckSquare },
      { to: "/admin/approved-registrations", label: "Approved registrations", icon: UserCheck },
      { to: "/admin/rejected-registrations", label: "Rejected registrations", icon: UserX },
      { to: "/admin/tickets", label: "Support tickets", icon: LifeBuoy },
      { to: "/admin/payment-gateway", label: "Payment gateway", icon: CreditCard },
      { to: "/admin/vendor-applications", label: "Vendor applications", icon: Briefcase },
      { to: "/admin/service-applications", label: "Service applications", icon: ServiceIcon },
      { to: "/admin/service-categories", label: "Service categories", icon: ListChecks },
      { to: "/admin/service-analytics", label: "Service analytics", icon: PieChart },
      { to: "/admin/distributors", label: "Distributor areas", icon: MapPin },
      { to: "/admin/system-wallet", label: "System wallet · Treasury", icon: Landmark },
      { to: "/admin/vendors", label: "All vendors", icon: Store },
      { to: "/admin/branding", label: "Branding & theme", icon: ShieldCheck },
      { to: "/admin/backups", label: "Data backups", icon: Database },
      { to: "/admin/changes", label: "Product roadmap", icon: ListChecks },
      { to: "/admin/kyc", label: "KYC review", icon: IdCard },
      { to: "/admin/orders", label: "Orders management", icon: ShoppingCart },
      { to: "/admin/transactions", label: "Transactions", icon: Receipt },
      { to: "/admin/audit-logs", label: "Admin audit log", icon: ScrollText },
      { to: "/admin/settings", label: "Payout structure", icon: IndianRupee },
      { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
      { to: "/admin/upi-payments", label: "UPI payments (pending)", icon: QrCode },
      { to: "/admin/legal-pages", label: "Legal pages", icon: FileText },
    ],
  },
  {
    title: "Export data",
    items: [
      { to: "/admin/exports", label: "All CSV exports", icon: Download },
    ],
  },
];
