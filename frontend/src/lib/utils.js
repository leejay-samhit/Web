import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatINR = (n) => {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "U";

export const isAdmin = (user) =>
  !!user && (user.role === "admin" || user.role === "superadmin" || !!user.admin_role);


// Defensive coercion: backend sometimes returns {id, name} or {id, email} objects
// where a string is expected (admin actor, target id, role, etc.). Use this when
// rendering arbitrary fields as React children.
export const safeStr = (v) => {
  if (v == null) return "";
  if (typeof v === "object") return v.name || v.email || v.id || JSON.stringify(v);
  return String(v);
};
