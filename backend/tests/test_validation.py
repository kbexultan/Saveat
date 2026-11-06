import pytest
from app.models.offer import Offer


@pytest.mark.parametrize("resource,field", [
    ("offers", "title"), ("offers", "original_price"), ("offers", "sale_price"),
    ("offers", "quantity_total"), ("offers", "pickup_start"), ("offers", "pickup_end"), ("offers", "status"),
    ("products", "name"), ("products", "base_price"), ("products", "is_active"),
    ("branches", "name"), ("branches", "address"),
])
def test_explicit_null_is_422_without_corrupting_row(scenario, db, client, auth_headers, resource, field):
    offer = db.get(Offer, scenario.offer_id)
    ids = {"offers": offer.id, "products": offer.product_id, "branches": scenario.branch_id}
    response = client.patch(f"/{resource}/{ids[resource]}", json={field: None}, headers=auth_headers(scenario.owner_id))
    assert response.status_code == 422, response.text
    assert client.get(f"/{resource}/{ids[resource]}", headers=auth_headers(scenario.owner_id)).status_code == 200


def test_nullable_description_can_still_be_cleared(scenario, client, auth_headers):
    response = client.patch(f"/offers/{scenario.offer_id}", json={"description": None}, headers=auth_headers(scenario.owner_id))
    assert response.status_code == 200
    assert response.json()["description"] is None


def test_product_price_and_column_lengths_are_validated(scenario, client, auth_headers):
    headers = auth_headers(scenario.owner_id)
    for changes in [{"name": "x" * 151, "base_price": "500"}, {"name": "Bread", "base_price": "-1"},
                    {"name": "Bread", "base_price": "999999999999999999999"}]:
        response = client.post("/products", json={"business_id": str(scenario.business_id), **changes}, headers=headers)
        assert response.status_code == 422, response.text
