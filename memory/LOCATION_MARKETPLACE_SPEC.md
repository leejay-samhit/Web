# Slangcart · Location-based Marketplace — Backend Spec

**Author:** Slangcart web team · 04-Jul-2026
**Status:** DRAFT — awaiting backend implementation
**Priority:** P0 — this unlocks the geo-filtered shop grid + twice-verified checkout eligibility

## Goal

> Show products only to customers within the vendor's declared delivery radius.
> Verify eligibility **twice**: once at the shop grid (GPS-based filter) and again at checkout (address-based re-check). Prevent accidental orders caused by outdated locations, manual address changes, GPS inaccuracies, or wrong pincodes.

Reuse the existing **distributor-areas pincode mapping** as a fallback when GPS is unavailable.

## Frontend already shipped (04-Jul-2026)

- **`src/components/LocationBlock.jsx`** — reusable capture card with `📍 Detect my location` (browser geolocation + Nominatim OSM reverse-geocode), PIN/State/District/City/Address inputs, Lat/Lng inputs, Delivery radius picker (2/5/10/20/50 km · Entire pincode · Entire district), Delivery available toggle.
- **Vendor product form (`VendorDashboard.jsx`)** embeds the block as a new required "Location & Delivery" section. Payload adds:
  ```
  location_pincode, location_state, location_district, location_city, location_address,
  location_latitude, location_longitude,
  delivery_radius_km, delivery_scope ("km"|"pincode"|"district"), delivery_available
  ```
- **Checkout `AddressForm`** — new "Use my current location" button that fills `latitude`, `longitude`, `pincode`, `state`, `city`, `district`. Payload extended with `latitude`, `longitude`, `district`.
- **Shop product cards** — render `🛵 X.X km · Deliverable` or `🚫 Not deliverable` chip when the backend provides `distance_km` / `deliverable` on each row. Gracefully hidden when absent.

## Backend implementation

### 1. Data model changes

**`products` collection** — add fields:
```json
{
  "location": {
    "type": "Point",
    "coordinates": [80.2707, 13.0827]        // [lng, lat] — GeoJSON order!
  },
  "location_pincode": "600001",
  "location_state": "TN",
  "location_district": "Chennai",
  "location_city": "Chennai",
  "location_address": "42, MG Road",
  "delivery_radius_km": 10,                  // null when scope != "km"
  "delivery_scope": "km",                    // "km" | "pincode" | "district"
  "delivery_available": true
}
```
Create the 2dsphere index: `db.products.createIndex({ location: "2dsphere" })`.

**`users` collection** — extend the addresses array:
```json
{
  "addresses": [{
    "name": "...", "phone": "...", "line1": "...",
    "city": "...", "state": "...", "district": "...", "pincode": "...",
    "latitude": 13.0827, "longitude": 80.2707,
    "gps_accuracy_m": 20
  }]
}
```

### 2. First verification — filtered shop grid

`GET /api/products?lat=<cust_lat>&lng=<cust_lng>&pincode=<cust_pin>&district=<cust_district>`

Behaviour (pseudocode):
```python
if lat and lng:
    geo_filter = {
      "$or": [
        # Vendor delivers within radius (km-based)
        { "location": { "$geoWithin": {
          "$centerSphere": [[lng, lat], radius_km / 6371.0]  # km→radians
        }}, "delivery_scope": "km" },
        # Vendor delivers to entire pincode
        { "location_pincode": pincode, "delivery_scope": "pincode" },
        # Vendor delivers to entire district
        { "location_district": district, "delivery_scope": "district" },
      ],
      "delivery_available": True
    }
elif pincode:
    geo_filter = { "location_pincode": pincode }  # fallback

# On each returned row, compute distance_km + deliverable flag:
for row in results:
    row["distance_km"] = haversine(cust_lat, cust_lng, row.lat, row.lng)
    row["deliverable"] = row.get("delivery_available", True)
```
Response row additions:
```json
{ "distance_km": 3.2, "deliverable": true, "vendor_name": "..." }
```

### 3. Second verification — checkout eligibility

On `POST /api/orders/checkout`, before creating the order:

```python
addr = payload.shipping_address
for item in cart.items:
    prod = db.products.find_one(...)
    ok = check_delivery_eligibility(
        product=prod,
        cust_lat=addr.latitude, cust_lng=addr.longitude,
        cust_pincode=addr.pincode, cust_district=addr.district,
    )
    if not ok:
        raise HTTPException(422, detail={
          "code": "not_deliverable",
          "message": "Sorry, this product is not deliverable to your selected address.",
          "product_id": prod.id,
          "product_name": prod.name,
        })
```

`check_delivery_eligibility()` runs the same logic as §2 for a single product.

### 4. Reuse distributor-areas mapping (fallback)

When the customer has no lat/lng (e.g. old address record from before this feature shipped), fall back to:
- If cust `pincode` is in a distributor's mapped areas AND that distributor's PINs include the vendor's `location_pincode`, treat as deliverable.
- Otherwise return `deliverable: false`.

This gives us backwards-compatible behaviour without forcing every legacy user through a GPS re-capture.

### 5. Caching & performance

- Cache the shop-grid response keyed by `(pincode, district, rounded lat/lng)` for 60 s.
- Invalidate on any product write (`PATCH/POST /vendor/me/products`).
- 2dsphere index handles radius queries in O(log n).

### 6. Frontend UI already wired

- **Shop header**: existing `LocationBanner` component shows the customer's current delivery pincode.
- **Product card**: distance chip auto-renders when backend returns `distance_km`.
- **PDP** (`ProductDetail.jsx`): can be extended in a follow-up to show a big "Deliverable · X km away" banner. Not shipped yet — needs single-product endpoint to return `distance_km` too.
- **Checkout**: GPS button captures lat/lng before payment. If checkout is rejected with `code: "not_deliverable"`, web shows the backend's `message` verbatim (already handled by our error toast).

## Rollout order

1. Data model + 2dsphere index (~30 min)
2. Vendor product upsert accepts new fields (~30 min)
3. `GET /products` accepts `lat`/`lng`/`pincode`/`district` and returns `distance_km`/`deliverable` (~1 hr)
4. `POST /orders/checkout` runs eligibility check (~30 min)
5. Distributor-areas fallback (~30 min)
6. Notify web team → we remove the "graceful hide" guards and turn on radius-based Shop filtering by default

Total backend effort: ~3-4 hrs. Frontend is done.
