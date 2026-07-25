// Smart Retail Learning Center — plain-English content for Indian retailers.
// Every article opens with a one-sentence "in short" explainer, then a real
// ₹ example, and closes with a practical takeaway.
// Super Admin can override any of this via /admin/erp-settings once the
// backend ships /erp/settings.learningCenter.

export const LEARNING_TOPICS = [
  {
    slug: "what-is-gst",
    title: "What is GST?",
    excerpt: "The single tax on almost everything you sell in India.",
    body: `**In short**: GST (Goods and Services Tax) is the single tax that has replaced most older taxes like VAT, service tax and excise. When you sell something, you collect GST from your customer and pay it to the government.

**Example**: You sell a shirt for ₹1,000 with 5% GST. Your customer pays ₹1,050. The extra ₹50 is not your money — you have to pay it to the government at the end of the month.

**Takeaway**: Every ₹ you charge as GST belongs to the government. Keep it separate from your profit in your head.`,
  },
  {
    slug: "input-gst",
    title: "What is Input GST?",
    excerpt: "The GST you already paid while purchasing goods for your shop.",
    body: `**In short**: Input GST is the GST you paid to your supplier when you bought stock for your shop.

**Example**: You buy 100 shirts at ₹500 + 5% GST = ₹525 each from a wholesaler. The ₹25 GST per shirt is Input GST — the government already has it from your supplier's tax return.

**Takeaway**: Always ask for a proper GST bill from suppliers so you can claim this input.`,
  },
  {
    slug: "output-gst",
    title: "What is Output GST?",
    excerpt: "The GST your customers pay you when they buy from your shop.",
    body: `**In short**: Output GST is the GST you charge your customer on top of your selling price.

**Example**: You sell a shirt for ₹1,000 + 5% GST = ₹1,050. The ₹50 is Output GST — you owe it to the government.

**Takeaway**: Every bill you cut with GST adds to your Output GST bucket. Slangcart totals this for you automatically.`,
  },
  {
    slug: "itc",
    title: "What is Input Tax Credit (ITC)?",
    excerpt: "Getting back the GST you already paid so you don't pay it twice.",
    body: `**In short**: You don't pay full Output GST — you only pay the *difference* between Output GST (collected from customers) and Input GST (paid to suppliers). That subtraction is called Input Tax Credit.

**Example**: This month you collected ₹10,000 Output GST from customers, and paid ₹6,000 Input GST to your suppliers. You only pay ₹4,000 to the government.

**Takeaway**: Missing supplier bills = losing ITC = paying more tax. Never lose a purchase invoice.`,
  },
  {
    slug: "profit",
    title: "What is Profit?",
    excerpt: "What's left in your pocket after you pay for everything.",
    body: `**In short**: Profit is what you actually earn — selling price minus every cost including purchase, rent, salary, electricity, packaging and taxes.

**Example**: You bought a shirt for ₹500 and sold it for ₹800. Your gross profit is ₹300. But if you spent ₹50 on packaging and ₹50 on rent-share per shirt, your true (net) profit is ₹200.

**Takeaway**: Selling price minus purchase price is not your real profit. Slangcart's Profit Dashboard adds up all costs so you see the real number.`,
  },
  {
    slug: "gross-profit",
    title: "What is Gross Profit?",
    excerpt: "Selling price minus purchase cost. Nothing else deducted yet.",
    body: `**In short**: Gross profit = Total Sales − Cost of Goods Sold. It ignores rent, salary, electricity etc.

**Example**: Sold ₹5,00,000 of goods this month. Bought them for ₹3,50,000. Gross Profit = ₹1,50,000.

**Takeaway**: Gross profit shows how well you're pricing your products. A low gross profit means you're either buying too expensive or selling too cheap.`,
  },
  {
    slug: "net-profit",
    title: "What is Net Profit?",
    excerpt: "Your final take-home after every expense.",
    body: `**In short**: Net Profit = Gross Profit − all overheads (rent, salary, power, taxes, packaging, delivery).

**Example**: Gross Profit ₹1,50,000. Rent ₹30,000, salary ₹40,000, electricity ₹5,000, delivery ₹10,000. Net Profit = ₹65,000.

**Takeaway**: Net profit is what actually goes into your bank. Everything else is just numbers on a bill.`,
  },
  {
    slug: "turnover",
    title: "What is Turnover?",
    excerpt: "The total sales you did — before any costs.",
    body: `**In short**: Turnover is the total value of everything you sold in a period. It is NOT your profit.

**Example**: Your shop billed ₹15,00,000 last year — that is your annual turnover, even though you only kept ₹2,00,000 as profit.

**Takeaway**: GST registration and tax rules depend on turnover, not profit. Watch this number carefully.`,
  },
  {
    slug: "taxable-value",
    title: "What is Taxable Value?",
    excerpt: "The price BEFORE GST is added.",
    body: `**In short**: Taxable value is your selling price without GST — the base amount GST is calculated on.

**Example**: A shirt sells for ₹1,050 including 5% GST. The taxable value is ₹1,000 (before GST). The ₹50 is the GST amount.

**Takeaway**: When someone asks the "GST amount" or "taxable value" on a bill, this is what they mean.`,
  },
  {
    slug: "hsn-sac",
    title: "What is an HSN / SAC Code?",
    excerpt: "The government's product code that decides your GST rate.",
    body: `**In short**: HSN (Harmonised System of Nomenclature) is a code for goods; SAC (Services Accounting Code) is for services. The code decides the GST rate.

**Example**: HSN 6109 is for T-shirts → 5% GST if under ₹1,000, 12% above. HSN 1006 is for rice → 5% GST.

**Takeaway**: Set the correct HSN on each product once and Slangcart will always apply the right GST rate on your bills.`,
  },
  {
    slug: "gst-return",
    title: "What is a GST Return?",
    excerpt: "The monthly / quarterly form you file to declare your GST.",
    body: `**In short**: A GST return is the statement you file to the government telling them how much GST you collected (Output) and how much you paid (Input), and how much you owe.

**Example**: GSTR-3B is the monthly summary return. GSTR-1 lists every sales invoice. Small dealers under QRMP file quarterly.

**Takeaway**: Missing a return = late fee + interest + blocked ITC. Slangcart's reminders keep you on time.`,
  },
  {
    slug: "purchase-records",
    title: "How to maintain purchase records",
    excerpt: "Why every stock purchase should be entered the same day.",
    body: `**In short**: Enter every supplier bill into the Purchase Book on the day you receive it — with invoice number, supplier GSTIN, product, quantity, price and GST.

**Why it matters**:
- Missing invoices = lost Input Tax Credit = higher GST payable.
- Correct purchase price = correct profit calculation.
- GST officers can ask for any purchase during audit; digital records save days of stress.

**Takeaway**: Same-day entry becomes a 5-minute habit. Backlog becomes a nightmare.`,
  },
  {
    slug: "why-invoices-matter",
    title: "Why purchase invoices are important",
    excerpt: "No invoice = no ITC = you pay more tax and lose money.",
    body: `**In short**: A supplier's GST invoice is proof that GST was paid on that stock. Without it, you cannot claim Input Tax Credit and end up paying that GST yourself.

**Example**: You bought 100 kg of rice worth ₹5,000 + ₹250 GST cash from a supplier without a bill. You just lost ₹250 that could have offset your Output GST. Multiply this by a year and it's tens of thousands.

**Takeaway**: If a supplier refuses to give a proper GST bill, treat it as a hidden price hike and find another supplier.`,
  },
];

export const findTopic = (slug) => LEARNING_TOPICS.find((t) => t.slug === slug) || null;
