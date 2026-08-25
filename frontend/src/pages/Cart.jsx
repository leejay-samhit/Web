import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import EmptyState from "@/components/EmptyState";
import { useCart } from "@/context/CartContext";
import { formatINR, resolveImageUrl } from "@/lib/utils";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";

export default function Cart() {
  const { cart, remove } = useCart();
  const nav = useNavigate();

  if (!cart.items || cart.items.length === 0) {
    return (
      <Layout title="Cart">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          hint="Add a few products from the shop to get started."
          action={
            <Link to="/shop" data-testid="cart-go-shop" className="sc-btn-primary">
              Browse shop
            </Link>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout title="Cart">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 sc-card p-4 divide-y divide-[color:var(--sc-border)]" data-testid="cart-items">
          {cart.items.map((it) => (
            <div key={it.product_id} className="py-3 flex items-center gap-3" data-testid={`cart-item-${it.product_id}`}>
              <div className="w-16 h-16 rounded-xl bg-[color:var(--sc-accent-light)] overflow-hidden shrink-0">
                {it.image_url && (
                  <img alt="" src={resolveImageUrl(it.image_url)} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[color:var(--sc-ink)] truncate">{it.name || it.product_name}</div>
                <div className="text-xs text-[color:var(--sc-ink-muted)]">Qty: {it.qty || 1}</div>
                <div className="font-extrabold text-sm mt-0.5">{formatINR(it.price)}</div>
              </div>
              <button
                data-testid={`cart-remove-${it.product_id}`}
                onClick={() => remove(it.product_id)}
                className="w-9 h-9 rounded-lg border border-[color:var(--sc-border)] grid place-items-center text-[color:var(--sc-error)] hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="sc-card p-5 h-fit sticky top-20">
          <div className="font-extrabold text-[color:var(--sc-ink)]">Order summary</div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[color:var(--sc-ink-muted)]">Items ({cart.count})</span>
              <span className="font-semibold">{formatINR(cart.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[color:var(--sc-ink-muted)]">Shipping</span>
              <span className="font-semibold text-[color:var(--sc-success)]">FREE</span>
            </div>
            <div className="border-t border-[color:var(--sc-border)] pt-3 mt-3 flex justify-between text-lg">
              <span className="font-extrabold">Total</span>
              <span data-testid="cart-total" className="font-extrabold text-[color:var(--sc-primary)]">{formatINR(cart.total)}</span>
            </div>
          </div>
          <button data-testid="cart-checkout" onClick={() => nav("/checkout")} className="sc-btn-primary w-full mt-5 flex items-center justify-center gap-2">
            Proceed to checkout <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Layout>
  );
}
