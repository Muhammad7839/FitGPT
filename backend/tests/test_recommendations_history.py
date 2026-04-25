from conftest import register_and_login
from app.weather import WeatherLookupError
from datetime import datetime


def item(category: str, color: str):
    return {
        "name": f"{category} {color}",
        "category": category,
        "clothing_type": None,
        "fit_tag": None,
        "color": color,
        "season": "All",
        "comfort_level": 3,
        "image_url": None,
        "brand": None,
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def test_recommendations_and_history_flow(client):
    token = register_and_login(client, "reco@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    reco = client.get(
        "/recommendations",
        headers=auth,
        params={
            "manual_temp": 55,
            "time_context": "Evening",
            "plan_date": "2026-03-06",
            "exclude": "neon,formal",
        },
    )
    assert reco.status_code == 200
    reco_body = reco.json()
    assert "items" in reco_body
    assert len(reco_body["items"]) >= 2
    assert isinstance(reco_body["explanation"], str)
    assert "evening" in reco_body["explanation"].lower()
    assert "55f" in reco_body["explanation"].lower()
    assert "neon" in reco_body["explanation"].lower()
    assert "temp=" not in reco_body["explanation"]

    history = client.post(
        "/outfits/history",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"], shoes["id"]],
            "worn_at_timestamp": 1730000000,
        },
    )
    assert history.status_code == 200
    assert history.json()["detail"] == "Outfit history saved"

    listed = client.get("/outfits/history", headers=auth)
    assert listed.status_code == 200
    listed_body = listed.json()
    assert len(listed_body["history"]) == 1
    assert listed_body["history"][0]["item_ids"] == [top["id"], bottom["id"], shoes["id"]]

    cleared = client.delete("/outfits/history", headers=auth)
    assert cleared.status_code == 200
    assert cleared.json()["detail"] == "Outfit history cleared"

    listed_after_clear = client.get("/outfits/history", headers=auth)
    assert listed_after_clear.status_code == 200
    assert listed_after_clear.json()["history"] == []


def test_saved_outfits_returns_updated_data_and_persists(client):
    token = register_and_login(client, "saved@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()

    first_save = client.post(
        "/outfits/saved",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"]],
            "saved_at_timestamp": 1730001000,
        },
    )
    assert first_save.status_code == 200
    first_body = first_save.json()
    assert len(first_body["outfits"]) == 1
    assert first_body["outfits"][0]["item_ids"] == [top["id"], bottom["id"]]

    second_save = client.post(
        "/outfits/saved",
        headers=auth,
        json={
            "item_ids": [bottom["id"]],
            "saved_at_timestamp": 1730002000,
        },
    )
    assert second_save.status_code == 200
    second_body = second_save.json()
    assert len(second_body["outfits"]) == 2
    assert second_body["outfits"][0]["item_ids"] == [bottom["id"]]
    assert second_body["outfits"][0]["saved_at_timestamp"] == 1730002000

    list_saved = client.get("/outfits/saved", headers=auth)
    assert list_saved.status_code == 200
    list_body = list_saved.json()
    assert len(list_body["outfits"]) == 2
    assert list_body["outfits"][1]["saved_at_timestamp"] == 1730001000

    newest_id = list_body["outfits"][0]["id"]
    delete_saved = client.delete(f"/outfits/saved/{newest_id}", headers=auth)
    assert delete_saved.status_code == 200
    delete_saved_body = delete_saved.json()
    assert len(delete_saved_body["outfits"]) == 1


def test_saved_outfits_legacy_alias_supports_create_list_and_delete_by_signature(client):
    token = register_and_login(client, "saved-legacy@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()

    created = client.post(
        "/saved-outfits",
        headers=auth,
        json={
            "items": [str(top["id"]), str(bottom["id"])],
            "source": "recommended",
            "context": {"occasion": "work"},
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["created"] is True
    expected_signature = "|".join(sorted([str(top["id"]), str(bottom["id"])]))
    assert body["saved_outfit"]["outfit_signature"] == expected_signature

    duplicate = client.post(
        "/saved-outfits",
        headers=auth,
        json={"items": [top["id"], bottom["id"]]},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["created"] is False

    listed = client.get("/saved-outfits", headers=auth)
    assert listed.status_code == 200
    saved_outfits = listed.json()["saved_outfits"]
    assert len(saved_outfits) == 1
    assert saved_outfits[0]["items"] == [str(bottom["id"]), str(top["id"])] or saved_outfits[0]["items"] == [
        str(top["id"]),
        str(bottom["id"]),
    ]

    signature = saved_outfits[0]["outfit_signature"]
    deleted = client.delete(f"/saved-outfits/{signature}", headers=auth)
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    listed_after = client.get("/saved-outfits", headers=auth)
    assert listed_after.status_code == 200
    assert listed_after.json()["saved_outfits"] == []


def test_outfit_history_legacy_alias_supports_create_list_and_signature_delete(client):
    token = register_and_login(client, "history-legacy@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    created = client.post(
        "/outfit-history",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"], shoes["id"]],
            "source": "recommendation",
            "context": {"occasion": "daily"},
        },
    )
    assert created.status_code == 200
    assert created.json()["created"] is True

    listed = client.get("/outfit-history", headers=auth)
    assert listed.status_code == 200
    history = listed.json()["history"]
    assert len(history) == 1
    signature = "|".join(sorted(history[0]["item_ids"]))

    deleted = client.delete(f"/outfit-history/{signature}", headers=auth)
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    listed_after = client.get("/outfit-history", headers=auth)
    assert listed_after.status_code == 200
    assert listed_after.json()["history"] == []


def test_recommendations_use_weather_city_when_temp_missing(client, monkeypatch):
    token = register_and_login(client, "weather@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()

    monkeypatch.setattr("app.routes.fetch_current_temperature_f", lambda _: 48)

    reco = client.get(
        "/recommendations",
        headers=auth,
        params={
            "weather_city": "Boston",
        },
    )
    assert reco.status_code == 200
    explanation = reco.json()["explanation"].lower()
    assert "48f" in explanation
    assert "boston" in explanation


def test_weather_current_endpoint_returns_snapshot(client, monkeypatch):
    token = register_and_login(client, "weather-now@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(
        "app.routes.fetch_current_weather",
        lambda **_kwargs: type(
            "Snapshot",
            (),
            {
                "city": "Boston",
                "temperature_f": 52,
                "condition": "Clouds",
                "description": "broken clouds",
            },
        )(),
    )

    weather = client.get("/weather/current", headers=auth, params={"city": "Boston"})
    assert weather.status_code == 200
    body = weather.json()
    assert body["city"] == "Boston"
    assert body["temperature_f"] == 52
    assert body["condition"] == "Clouds"


def test_weather_current_endpoint_maps_provider_errors(client, monkeypatch):
    token = register_and_login(client, "weather-error-map@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    def quota_error(**_kwargs):
        raise WeatherLookupError("Weather service quota exceeded", status_code=503)

    monkeypatch.setattr("app.routes.fetch_current_weather", quota_error)

    response = client.get("/weather/current", headers=auth, params={"city": "Boston"})
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Boston"
    assert body["available"] is False
    assert body["detail"] == "Weather service quota exceeded"


def test_planned_outfits_crud_flow(client):
    token = register_and_login(client, "planned@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()

    create_plan = client.post(
        "/outfits/planned",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"]],
            "planned_date": "2026-04-01",
            "occasion": "Work",
            "created_at_timestamp": 1730003000,
        },
    )
    assert create_plan.status_code == 200
    created_body = create_plan.json()
    assert len(created_body["outfits"]) == 1
    assert created_body["outfits"][0]["planned_date"] == "2026-04-01"

    list_plans = client.get("/outfits/planned", headers=auth)
    assert list_plans.status_code == 200
    plans_body = list_plans.json()
    assert len(plans_body["outfits"]) == 1
    plan_id = plans_body["outfits"][0]["id"]

    delete_plan = client.delete(f"/outfits/planned/{plan_id}", headers=auth)
    assert delete_plan.status_code == 200
    assert delete_plan.json()["outfits"] == []


def test_outfit_history_rejects_invalid_item_ids(client):
    token = register_and_login(client, "history-invalid-ids@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()

    duplicate = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [top["id"], top["id"]], "worn_at_timestamp": 1730000000},
    )
    assert duplicate.status_code == 422

    negative = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [-1], "worn_at_timestamp": 1730000000},
    )
    assert negative.status_code == 422


def test_outfit_history_supports_date_range_update_and_delete(client):
    token = register_and_login(client, "history-range@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    early_timestamp = int(datetime(2026, 2, 10, 12, 0).timestamp() * 1000)
    later_timestamp = int(datetime(2026, 2, 25, 12, 0).timestamp() * 1000)

    create_early = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [top["id"], bottom["id"]], "worn_at_timestamp": early_timestamp},
    )
    assert create_early.status_code == 200

    create_later = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [top["id"], shoes["id"]], "worn_at_timestamp": later_timestamp},
    )
    assert create_later.status_code == 200

    ranged = client.get(
        "/outfits/history/range",
        headers=auth,
        params={"start_date": "2026-02-20", "end_date": "2026-02-28"},
    )
    assert ranged.status_code == 200
    ranged_body = ranged.json()["history"]
    assert len(ranged_body) == 1
    history_id = ranged_body[0]["id"]
    assert ranged_body[0]["item_ids"] == [top["id"], shoes["id"]]

    updated_timestamp = later_timestamp + (60 * 60 * 1000)
    updated = client.put(
        f"/outfits/history/{history_id}",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"], shoes["id"]],
            "worn_at_timestamp": updated_timestamp,
        },
    )
    assert updated.status_code == 200
    updated_body = updated.json()
    assert updated_body["item_ids"] == [top["id"], bottom["id"], shoes["id"]]
    assert updated_body["worn_at_timestamp"] == updated_timestamp

    deleted = client.delete(f"/outfits/history/{history_id}", headers=auth)
    assert deleted.status_code == 200
    assert deleted.json()["detail"] == "Outfit history entry deleted"

    final_ranged = client.get(
        "/outfits/history/range",
        headers=auth,
        params={"start_date": "2026-02-01", "end_date": "2026-02-28"},
    )
    assert final_ranged.status_code == 200
    final_entries = final_ranged.json()["history"]
    assert len(final_entries) == 1
    assert final_entries[0]["item_ids"] == [top["id"], bottom["id"]]


def test_outfit_history_range_rejects_invalid_dates(client):
    token = register_and_login(client, "history-range-invalid@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.get(
        "/outfits/history/range",
        headers=auth,
        params={"start_date": "2026-03-10", "end_date": "2026-03-01"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "end_date must be on or after start_date"


def test_planned_outfit_requires_valid_date_format(client):
    token = register_and_login(client, "planned-date-format@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()

    response = client.post(
        "/outfits/planned",
        headers=auth,
        json={
            "item_ids": [top["id"]],
            "planned_date": "04-01-2026",
            "occasion": "Work",
        },
    )
    assert response.status_code == 422


def test_planner_assign_replaces_existing_entries(client):
    token = register_and_login(client, "planner-replace@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    first = client.put(
        "/outfits/planned/assign",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"]],
            "planned_dates": ["2026-05-01"],
            "occasion": "Work",
            "replace_existing": True,
        },
    )
    assert first.status_code == 200

    second = client.put(
        "/outfits/planned/assign",
        headers=auth,
        json={
            "item_ids": [top["id"], shoes["id"]],
            "planned_dates": ["2026-05-01"],
            "occasion": "Event",
            "replace_existing": True,
        },
    )
    assert second.status_code == 200
    outfits = second.json()["outfits"]
    same_day = [entry for entry in outfits if entry["planned_date"] == "2026-05-01"]
    assert len(same_day) == 1
    assert same_day[0]["item_ids"] == [top["id"], shoes["id"]]


def test_planner_assign_allows_multiple_entries_when_replace_disabled(client):
    token = register_and_login(client, "planner-append@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    first = client.put(
        "/outfits/planned/assign",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"]],
            "planned_dates": ["2026-05-02"],
            "replace_existing": False,
        },
    )
    assert first.status_code == 200

    second = client.put(
        "/outfits/planned/assign",
        headers=auth,
        json={
            "item_ids": [top["id"], shoes["id"]],
            "planned_dates": ["2026-05-02"],
            "replace_existing": False,
        },
    )
    assert second.status_code == 200
    outfits = second.json()["outfits"]
    same_day = [entry for entry in outfits if entry["planned_date"] == "2026-05-02"]
    assert len(same_day) == 2


def test_recommendations_accept_weather_category_when_lookup_fails(client, monkeypatch):
    token = register_and_login(client, "weather-fallback@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    def fail_lookup(*_args, **_kwargs):
        raise WeatherLookupError("lookup failed")

    monkeypatch.setattr("app.routes.fetch_current_weather", fail_lookup)

    response = client.get(
        "/recommendations",
        headers=auth,
        params={"weather_city": "Boston", "weather_category": "cool", "occasion": "Office"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["weather_category"] == "cool"
    assert body["occasion"] == "Office"
    assert "office" in body["explanation"].lower()


def test_recommendations_fall_back_when_weather_lookup_fails_without_weather_category(client, monkeypatch):
    token = register_and_login(client, "weather-auto-fallback@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    def fail_lookup(*_args, **_kwargs):
        raise WeatherLookupError("service unavailable", status_code=503)

    monkeypatch.setattr("app.routes.fetch_current_temperature_f", fail_lookup)
    monkeypatch.setattr("app.routes.fetch_current_weather", fail_lookup)

    response = client.get(
        "/recommendations",
        headers=auth,
        params={"weather_city": "Boston"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["weather_category"] == "mild"
    assert len(body["items"]) >= 2


def test_recommendation_options_fall_back_when_weather_lookup_fails_without_weather_category(client, monkeypatch):
    token = register_and_login(client, "weather-options-fallback@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    def fail_lookup(*_args, **_kwargs):
        raise WeatherLookupError("service unavailable", status_code=503)

    monkeypatch.setattr("app.routes.fetch_current_temperature_f", fail_lookup)
    monkeypatch.setattr("app.routes.fetch_current_weather", fail_lookup)

    response = client.get(
        "/recommendations/options",
        headers=auth,
        params={"weather_city": "Boston", "limit": 2},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["weather_category"] == "mild"
    assert len(body["outfits"]) >= 1


def test_cold_recommendations_prioritize_outerwear_and_avoid_light_items(client):
    token = register_and_login(client, "temp-logic@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Top", "Black") | {"name": "Heavy Sweater", "clothing_type": "sweater"},
    )
    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Bottom", "Navy") | {"name": "Warm Pants", "clothing_type": "pants"},
    )
    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Bottom", "Khaki") | {"name": "Running Shorts", "clothing_type": "shorts"},
    )
    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Shoes", "Brown") | {"name": "Boots", "clothing_type": "boots"},
    )
    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Shoes", "Black") | {"name": "Beach Sandals", "clothing_type": "sandals"},
    )
    client.post(
        "/wardrobe/items",
        headers=auth,
        json=item("Outerwear", "Gray") | {"name": "Winter Coat", "clothing_type": "coat"},
    )

    reco = client.get("/recommendations", headers=auth, params={"weather_category": "cold"})
    assert reco.status_code == 200
    names = [entry["name"].lower() for entry in reco.json()["items"]]
    assert any("coat" in name for name in names)
    assert all("short" not in name for name in names)
    assert all("sandal" not in name for name in names)
