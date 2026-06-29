/**
 * Print an invoice via a hidden print window. Uses the system print
 * dialog (no external PDF library needed) — user can "Save as PDF" from
 * the dialog on every modern browser.
 */
import { formatINR } from "@/lib/utils";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

export function printInvoice(invoice, settings) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) return;
  const dt = new Date(invoice.created_at);
  const itemRows = (invoice.items || []).map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(it.name)}${it.hsn ? `<div class="muted">HSN ${esc(it.hsn)}</div>` : ""}</td>
      <td class="r">${esc(it.qty)} ${esc(it.unit || "")}</td>
      <td class="r">${formatINR(it.price)}</td>
      <td class="r">${it.discount_amount ? `-${formatINR(it.discount_amount)}` : "-"}</td>
      <td class="r">${formatINR(it.tax_amount)}<div class="muted">${esc(it.gst_pct || 0)}%</div></td>
      <td class="r b">${formatINR(it.line_total)}</td>
    </tr>`).join("");
  const payRows = (invoice.payments || []).map((p) => `
    <tr><td>${esc(p.mode_label || p.mode)}</td><td class="r">${formatINR(p.amount)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><title>${esc(invoice.invoice_no)}</title>
<meta charset="utf-8" />
<style>
  *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
  body{margin:0;padding:18px;color:#111;font-size:12px}
  h1{font-size:18px;margin:0}
  .biz{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F6E4F;padding-bottom:10px;margin-bottom:10px}
  .muted{color:#777;font-size:10px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee;font-size:11px}
  th{background:#E8F4ED;color:#0F6E4F;font-weight:800}
  .r{text-align:right}
  .b{font-weight:800}
  .totals{margin-top:10px;border-top:2px solid #0F6E4F;padding-top:8px}
  .totals .row{display:flex;justify-content:space-between;padding:2px 0}
  .totals .grand{font-size:14px;font-weight:800;color:#0F6E4F;border-top:1px dashed #999;padding-top:4px;margin-top:4px}
  .stamp{position:absolute;right:18px;top:18px;border:2px solid ${invoice.status === "completed" ? "#0F6E4F" : "#B42318"};color:${invoice.status === "completed" ? "#0F6E4F" : "#B42318"};font-weight:800;padding:4px 10px;border-radius:6px;text-transform:uppercase;font-size:11px;letter-spacing:2px}
  @media print{ button{display:none} }
</style></head><body>
${invoice.status !== "completed" ? `<div class="stamp">${esc(invoice.status)}</div>` : ""}
<div class="biz">
  <div>
    <h1>${esc(settings?.business_name || "Vendor Bill")}</h1>
    <div class="muted">${esc(settings?.business_address || "")}</div>
    <div class="muted">${settings?.business_phone ? `📞 ${esc(settings.business_phone)} ` : ""}${settings?.business_email ? `· ${esc(settings.business_email)}` : ""}</div>
    ${settings?.business_gstin ? `<div class="muted"><b>GSTIN:</b> ${esc(settings.business_gstin)}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div><b>${esc(invoice.invoice_no)}</b></div>
    <div class="muted">${dt.toLocaleString()}</div>
  </div>
</div>

<div style="display:flex;justify-content:space-between">
  <div>
    <div class="muted">Customer</div>
    <div><b>${esc(invoice.customer?.name || "Walk-in Customer")}</b></div>
    ${invoice.customer?.phone ? `<div class="muted">📱 ${esc(invoice.customer.phone)}</div>` : ""}
    ${invoice.customer?.gstin ? `<div class="muted">GSTIN: ${esc(invoice.customer.gstin)}</div>` : ""}
    ${invoice.customer?.address ? `<div class="muted">${esc(invoice.customer.address)}</div>` : ""}
  </div>
</div>

<table>
  <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Disc</th><th class="r">GST</th><th class="r">Total</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals">
  <div class="row"><span>Subtotal</span><span>${formatINR(invoice.totals?.subtotal)}</span></div>
  ${invoice.totals?.discount_total ? `<div class="row"><span>Total discount</span><span>-${formatINR(invoice.totals.discount_total)}</span></div>` : ""}
  <div class="row"><span>GST total</span><span>${formatINR(invoice.totals?.gst_total)}</span></div>
  ${invoice.totals?.round_off ? `<div class="row"><span>Round off</span><span>${formatINR(invoice.totals.round_off)}</span></div>` : ""}
  <div class="row grand"><span>Grand total</span><span>${formatINR(invoice.totals?.grand_total)}</span></div>
</div>

${payRows ? `<table style="margin-top:10px"><thead><tr><th>Paid via</th><th class="r">Amount</th></tr></thead><tbody>${payRows}</tbody></table>` : ""}

${invoice.notes ? `<div style="margin-top:10px" class="muted">Notes: ${esc(invoice.notes)}</div>` : ""}
<div style="margin-top:18px;text-align:center" class="muted">Thank you for your business · Powered by Slangcart</div>
<button onclick="window.print()" style="margin-top:14px;width:100%;padding:8px;background:#0F6E4F;color:#fff;border:0;border-radius:6px;font-weight:700">Print</button>
<script>setTimeout(function(){window.print();},300);</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}
