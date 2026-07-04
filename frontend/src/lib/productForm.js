// Helpers shared by AdminProducts and VendorDashboard for serialising the
// "advanced" product-form fields into the backend's structured shapes.

export const parseLines = (txt) =>
  (txt || "").split("\n").map((s) => s.trim()).filter(Boolean);

export const linesFromArray = (arr) =>
  Array.isArray(arr) ? arr.filter(Boolean).join("\n") : "";

export const parseExtraAttrs = (txt) => {
  const out = {};
  for (const line of parseLines(txt)) {
    const [k, ...rest] = line.split(":");
    if (k && rest.length) out[k.trim()] = rest.join(":").trim();
  }
  return out;
};

export const extraAttrsToText = (obj) => {
  if (!obj || typeof obj !== "object") return "";
  return Object.entries(obj)
    .filter(([k, v]) => k && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
};

/** Wrap plain text as the backend's `StyledText` shape. Also passes existing
 *  ~~strikethrough~~ / *emphasis* markers through unchanged — the product
 *  detail page renders these tokens. */
export const toStyled = (txt) => (txt ? { text: txt } : null);

/** Reverse of toStyled — takes a stored StyledText object and gets the text. */
export const fromStyled = (obj) => {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.text || "";
};

/** parse the "Tab Name | Label:Value; Label2:Value2" textarea format. */
export const parseSpecTabs = (txt) => {
  const out = [];
  for (const line of parseLines(txt)) {
    const [name, rowsRaw = ""] = line.split("|").map((s) => s.trim());
    const rows = rowsRaw
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [label, ...vv] = p.split(":");
        return { label: (label || "").trim(), value: vv.join(":").trim() };
      })
      .filter((r) => r.label || r.value);
    if (name || rows.length) out.push({ name: name || "", rows });
  }
  return out;
};

/** Reverse of parseSpecTabs — used to hydrate the textarea from an existing
 *  spec_tabs array (edit mode + master-search hydration). */
export const specTabsToText = (arr) => {
  if (!Array.isArray(arr)) return "";
  return arr
    .filter(Boolean)
    .map((t) => {
      const rows = Array.isArray(t.rows)
        ? t.rows
            .filter(Boolean)
            .map((r) => `${r.label || ""}:${r.value || ""}`)
            .filter((s) => s !== ":")
            .join("; ")
        : "";
      return rows ? `${t.name || ""} | ${rows}` : t.name || "";
    })
    .filter(Boolean)
    .join("\n");
};

/** Turn the master.specs dict (from Product Master) into the specTabs text
 *  format so the vendor form's Spec Tabs textarea is populated. */
export const specsDictToSpecTabsText = (specs) => {
  if (!specs || typeof specs !== "object") return "";
  const rows = Object.entries(specs)
    .filter(([k, v]) => k && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
  return rows ? `Specifications | ${rows}` : "";
};

/** Extract all image URLs from a Product Master `images: [{ url, kind }]`
 *  array (also tolerates flat string arrays). Preserves original quality —
 *  no client-side compression. */
export const flattenMasterImages = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const im of arr) {
    const url = typeof im === "string" ? im : im?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
};
