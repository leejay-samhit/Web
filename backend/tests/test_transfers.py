"""Integration tests for the substore transfer service.

These tests hit the running local backend (supervisor-managed) via HTTP and
authenticate against network-pay-1 with the seeded test credentials from
/app/memory/test_credentials.md.  Skipped automatically if upstream login
is unavailable so the suite still passes in offline environments.
"""

from __future__ import annotations

import os
import pytest
import httpx

LOCAL = "http://localhost:8001/api"
UPSTREAM = "https://network-pay-1.emergent.host/api"

CREDS_A = {"email": "support@slangcart.com", "password": "3)Ywxtic"}
CREDS_B = {"email": "brightkittu@gmail.com", "password": "Just@4me"}


def _login(client: httpx.Client, creds):
    r = client.post(f"{UPSTREAM}/auth/login", json=creds, timeout=8.0)
    if r.status_code != 200:
        pytest.skip(f"upstream login failed for {creds['email']} (status {r.status_code}) — cannot run cross-vendor test")
    return r.json().get("token")


@pytest.fixture(scope="module")
def tokens():
    with httpx.Client() as c:
        a = _login(c, CREDS_A)
        b = _login(c, CREDS_B)
    if not a or not b:
        pytest.skip("could not obtain both vendor tokens from upstream")
    return {"a": a, "b": b}


def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    r = httpx.get(f"{LOCAL}/health", timeout=5.0)
    assert r.status_code == 200 and r.json().get("ok") is True


def test_missing_bearer_returns_401():
    r = httpx.get(f"{LOCAL}/vendor/me/transfers", timeout=5.0)
    assert r.status_code == 401


def test_invalid_bearer_returns_401():
    r = httpx.get(f"{LOCAL}/vendor/me/transfers", headers={"Authorization": "Bearer garbage"}, timeout=8.0)
    assert r.status_code == 401


def test_cross_vendor_transfer_full_loop(tokens):
    body = {
        "to_email": CREDS_B["email"],
        "to_name": "Kiran shop",
        "product_name": "Pytest Test Rice",
        "image_url": "https://via.placeholder.com/80",
        "sku": "PY-RICE-1",
        "qty": 5,
        "unit_price": 100,
        "note": "pytest integration",
    }
    r = httpx.post(f"{LOCAL}/vendor/me/transfers", json=body, headers=h(tokens["a"]), timeout=10.0)
    assert r.status_code == 201, r.text
    created = r.json()
    tid = created["id"]
    assert created["from_email"] == CREDS_A["email"]
    assert created["to_email"] == CREDS_B["email"]
    assert created["status"] == "pending"
    assert created["total_value"] == 500
    assert created["transfer_order_id"].startswith("TRF-")

    # A sees it as sender
    r_a = httpx.get(f"{LOCAL}/vendor/me/transfers", headers=h(tokens["a"]), timeout=8.0)
    assert r_a.status_code == 200
    assert any(t["id"] == tid for t in r_a.json()["items"])

    # B sees it as receiver
    r_b = httpx.get(f"{LOCAL}/vendor/me/transfers", headers=h(tokens["b"]), timeout=8.0)
    assert r_b.status_code == 200
    assert any(t["id"] == tid for t in r_b.json()["items"])

    # A cannot accept (not the recipient)
    r_bad = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/accept", headers=h(tokens["a"]), timeout=8.0)
    assert r_bad.status_code == 403

    # B accepts
    r_acc = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/accept", headers=h(tokens["b"]), timeout=8.0)
    assert r_acc.status_code == 200
    assert r_acc.json()["status"] == "accepted"
    assert r_acc.json()["accepted_by"] == CREDS_B["email"]

    # Second accept must fail with 409
    r_dup = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/accept", headers=h(tokens["b"]), timeout=8.0)
    assert r_dup.status_code == 409

    # A can no longer cancel (already accepted)
    r_can = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/cancel", headers=h(tokens["a"]), timeout=8.0)
    assert r_can.status_code == 409

    # Filtering by status works
    r_only_acc = httpx.get(f"{LOCAL}/vendor/me/transfers?status=accepted", headers=h(tokens["a"]), timeout=8.0)
    assert r_only_acc.status_code == 200
    assert all(t["status"] == "accepted" for t in r_only_acc.json()["items"])


def test_cancel_flow(tokens):
    body = {
        "to_email": CREDS_B["email"], "product_name": "Cancelme", "qty": 2, "unit_price": 10,
    }
    tid = httpx.post(f"{LOCAL}/vendor/me/transfers", json=body, headers=h(tokens["a"]), timeout=10.0).json()["id"]
    # B cannot cancel (only sender)
    r_bad = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/cancel", headers=h(tokens["b"]), timeout=8.0)
    assert r_bad.status_code == 403
    # A cancels
    r_ok = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/cancel", headers=h(tokens["a"]), timeout=8.0)
    assert r_ok.status_code == 200 and r_ok.json()["status"] == "cancelled"


def test_self_transfer_blocked(tokens):
    body = {"to_email": CREDS_A["email"], "product_name": "Self", "qty": 1}
    r = httpx.post(f"{LOCAL}/vendor/me/transfers", json=body, headers=h(tokens["a"]), timeout=8.0)
    assert r.status_code == 403


def test_reject_flow(tokens):
    body = {"to_email": CREDS_B["email"], "product_name": "Rejectme", "qty": 3, "unit_price": 25}
    tid = httpx.post(f"{LOCAL}/vendor/me/transfers", json=body, headers=h(tokens["a"]), timeout=10.0).json()["id"]
    # Only B can reject
    r_bad = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/reject", headers=h(tokens["a"]), timeout=8.0)
    assert r_bad.status_code == 403
    r_ok = httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/reject", headers=h(tokens["b"]), timeout=8.0)
    assert r_ok.status_code == 200 and r_ok.json()["status"] == "rejected"


def test_timeline_events_created(tokens):
    body = {"to_email": CREDS_B["email"], "product_name": "Timeline probe", "qty": 1, "unit_price": 10}
    tid = httpx.post(f"{LOCAL}/vendor/me/transfers", json=body, headers=h(tokens["a"]), timeout=10.0).json()["id"]
    # Recipient opens the transfer → adds a "seen" event
    r_seen = httpx.get(f"{LOCAL}/vendor/me/transfers/{tid}", headers=h(tokens["b"]), timeout=8.0).json()
    kinds = [ev["kind"] for ev in r_seen["timeline"]]
    assert "created" in kinds and "seen" in kinds
    # Accept → adds "accepted"
    httpx.post(f"{LOCAL}/vendor/me/transfers/{tid}/accept", headers=h(tokens["b"]), timeout=8.0)
    final = httpx.get(f"{LOCAL}/vendor/me/transfers/{tid}", headers=h(tokens["b"]), timeout=8.0).json()
    assert any(ev["kind"] == "accepted" for ev in final["timeline"])


def test_substore_directory_crud(tokens):
    payload = {"email": "test-sub@example.com", "name": "Test Sub", "phone": "9999"}
    r = httpx.post(f"{LOCAL}/vendor/me/substores", json=payload, headers=h(tokens["a"]), timeout=8.0)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    # Duplicate rejected
    r_dup = httpx.post(f"{LOCAL}/vendor/me/substores", json=payload, headers=h(tokens["a"]), timeout=8.0)
    assert r_dup.status_code == 409
    # Listing scoped to owner
    lst_a = httpx.get(f"{LOCAL}/vendor/me/substores", headers=h(tokens["a"]), timeout=8.0).json()["items"]
    lst_b = httpx.get(f"{LOCAL}/vendor/me/substores", headers=h(tokens["b"]), timeout=8.0).json()["items"]
    assert any(s["id"] == sid for s in lst_a)
    assert not any(s["id"] == sid for s in lst_b)
    # Delete
    r_del = httpx.delete(f"{LOCAL}/vendor/me/substores/{sid}", headers=h(tokens["a"]), timeout=8.0)
    assert r_del.status_code == 200
    # Second delete = 404
    r_del2 = httpx.delete(f"{LOCAL}/vendor/me/substores/{sid}", headers=h(tokens["a"]), timeout=8.0)
    assert r_del2.status_code == 404


def test_owner_security_defaults_and_update(tokens):
    # Default status → password/pin = 1234
    r = httpx.get(f"{LOCAL}/erp/owner-security/status", headers=h(tokens["a"]), timeout=8.0)
    assert r.status_code == 200
    assert r.json()["enrolled"] is True

    # Default PIN 1234 verifies
    assert httpx.post(f"{LOCAL}/erp/owner-security/verify", json={"pin": "1234"}, headers=h(tokens["a"]), timeout=8.0).status_code == 200
    # Wrong PIN → 401
    assert httpx.post(f"{LOCAL}/erp/owner-security/verify", json={"pin": "0000"}, headers=h(tokens["a"]), timeout=8.0).status_code == 401
    # Default password 1234 verifies
    assert httpx.post(f"{LOCAL}/erp/owner-security/verify", json={"password": "1234"}, headers=h(tokens["a"]), timeout=8.0).status_code == 200

    # Update PIN
    r_pin = httpx.post(f"{LOCAL}/erp/owner-security/change-pin",
                      json={"currentPassword": "1234", "newPin": "5678"},
                      headers=h(tokens["a"]), timeout=8.0)
    assert r_pin.status_code == 200
    # New PIN verifies, old one fails
    assert httpx.post(f"{LOCAL}/erp/owner-security/verify", json={"pin": "5678"}, headers=h(tokens["a"]), timeout=8.0).status_code == 200
    assert httpx.post(f"{LOCAL}/erp/owner-security/verify", json={"pin": "1234"}, headers=h(tokens["a"]), timeout=8.0).status_code == 401
    # Reset PIN back to 1234 to keep default state for other tests
    httpx.post(f"{LOCAL}/erp/owner-security/change-pin",
               json={"currentPassword": "1234", "newPin": "1234"},
               headers=h(tokens["a"]), timeout=8.0)


def test_customer_orders_flow(tokens):
    # Vendor A creates an order for themselves as customer (edge, but valid)
    body = {
        "items": [
            {"vendor_email": CREDS_B["email"], "name": "Web Test Product", "qty": 2, "price": 100, "total": 200},
        ],
        "address": {"line1": "1 Test Rd", "city": "Bengaluru"},
        "payment_mode": "COD", "subtotal": 200, "grand_total": 200,
    }
    r = httpx.post(f"{LOCAL}/orders/checkout", json=body, headers=h(tokens["a"]), timeout=8.0)
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "placed" and order["order_number"].startswith("ORD-")

    # Vendor B (assigned) sees it
    r_b = httpx.get(f"{LOCAL}/vendor/me/orders", headers=h(tokens["b"]), timeout=8.0)
    assert r_b.status_code == 200
    assert any(o["id"] == order["id"] for o in r_b.json()["items"])

    # Buyer sees it under /orders/me
    r_me = httpx.get(f"{LOCAL}/orders/me", headers=h(tokens["a"]), timeout=8.0)
    assert any(o["id"] == order["id"] for o in r_me.json()["items"])

    # B advances status to shipped
    r_s = httpx.patch(f"{LOCAL}/vendor/orders/{order['id']}/status",
                     json={"status": "shipped"}, headers=h(tokens["b"]), timeout=8.0)
    assert r_s.status_code == 200 and r_s.json()["status"] == "shipped"

    # A (not the vendor) cannot advance status
    r_bad = httpx.patch(f"{LOCAL}/vendor/orders/{order['id']}/status",
                       json={"status": "delivered"}, headers=h(tokens["a"]), timeout=8.0)
    assert r_bad.status_code == 403

    # Invalid status rejected
    r_inv = httpx.patch(f"{LOCAL}/vendor/orders/{order['id']}/status",
                       json={"status": "flying"}, headers=h(tokens["b"]), timeout=8.0)
    assert r_inv.status_code == 400
