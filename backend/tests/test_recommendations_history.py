from conftest import register_and_login


def item(category: str, color: str):
    return {
        "category": category,
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
    token = register_and_login(client, "reco@example.com", "password123")
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
    token = register_and_login(client, "saved@example.com", "password123")
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


def test_recommendations_use_weather_city_when_temp_missing(client, monkeypatch):
    token = register_and_login(client, "weather@example.com", "password123")
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
    token = register_and_login(client, "weather-now@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(
        "app.routes.fetch_current_weather",
        lambda _city: type(
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


def test_planned_outfits_crud_flow(client):
    token = register_and_login(client, "planned@example.com", "password123")
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
