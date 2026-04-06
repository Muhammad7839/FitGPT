"""Coverage for 14-card metadata and recommendation behavior upgrades."""

from typing import Optional

from conftest import register_and_login


def _item_payload(
    *,
    name: str,
    category: str,
    clothing_type: str,
    color: str,
    season: str = "All",
    layer_type: Optional[str] = None,
    is_one_piece: bool = False,
    set_identifier: Optional[str] = None,
    style_tags: Optional[list[str]] = None,
    season_tags: Optional[list[str]] = None,
    colors: Optional[list[str]] = None,
    occasion_tags: Optional[list[str]] = None,
    accessory_type: Optional[str] = None,
):
    return {
        "name": name,
        "category": category,
        "clothing_type": clothing_type,
        "layer_type": layer_type,
        "is_one_piece": is_one_piece,
        "set_identifier": set_identifier,
        "fit_tag": "regular",
        "color": color,
        "colors": colors or [color],
        "season": season,
        "season_tags": season_tags or [season],
        "style_tags": style_tags or ["casual"],
        "occasion_tags": occasion_tags or ["daily"],
        "accessory_type": accessory_type,
        "comfort_level": 3,
        "image_url": None,
        "brand": None,
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def _create(client, auth, payload):
    response = client.post("/wardrobe/items", headers=auth, json=payload)
    assert response.status_code == 200
    return response.json()


def test_metadata_fields_persist_and_are_filterable(client):
    token = register_and_login(client, "card-metadata@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    created = _create(
        client,
        auth,
        _item_payload(
            name="Office Blazer",
            category="Outerwear",
            clothing_type="blazer",
            color="Navy",
            season="Fall",
            layer_type="outer",
            set_identifier="office-set-1",
            style_tags=["formal", "work"],
            season_tags=["fall", "winter"],
            colors=["navy", "white"],
            occasion_tags=["work", "formal"],
            accessory_type=None,
        ),
    )
    assert created["layer_type"] == "outer"
    assert created["set_identifier"] == "office-set-1"
    assert created["style_tags"] == ["formal", "work"]
    assert created["season_tags"] == ["fall", "winter"]
    assert created["colors"] == ["navy", "white"]
    assert created["occasion_tags"] == ["work", "formal"]

    filter_style = client.get("/wardrobe/items", headers=auth, params={"style_tag": "formal"})
    assert filter_style.status_code == 200
    assert len(filter_style.json()) == 1

    filter_layer = client.get("/wardrobe/items", headers=auth, params={"layer_type": "outer"})
    assert filter_layer.status_code == 200
    assert len(filter_layer.json()) == 1

    filter_occasion = client.get("/wardrobe/items", headers=auth, params={"occasion_tag": "work"})
    assert filter_occasion.status_code == 200
    assert len(filter_occasion.json()) == 1


def test_one_piece_and_set_metadata_editing(client):
    token = register_and_login(client, "card-onepiece@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    created = _create(
        client,
        auth,
        _item_payload(
            name="Summer Dress",
            category="Top",
            clothing_type="dress",
            color="Red",
            season="Summer",
            is_one_piece=True,
            set_identifier="summer-set",
            style_tags=["social"],
            occasion_tags=["social"],
        ),
    )
    item_id = created["id"]

    update = client.put(
        f"/wardrobe/items/{item_id}",
        headers=auth,
        json={"is_one_piece": False, "set_identifier": "edited-set"},
    )
    assert update.status_code == 200
    body = update.json()
    assert body["is_one_piece"] is False
    assert body["set_identifier"] == "edited-set"


def test_recommendations_options_return_ranked_unique_outfits(client):
    token = register_and_login(client, "card-options@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    # Tops / bottoms / shoes for combination diversity.
    _create(client, auth, _item_payload(name="Black Tee", category="Top", clothing_type="t-shirt", color="Black"))
    _create(client, auth, _item_payload(name="White Shirt", category="Top", clothing_type="shirt", color="White"))
    _create(client, auth, _item_payload(name="Blue Jeans", category="Bottom", clothing_type="jeans", color="Blue"))
    _create(client, auth, _item_payload(name="Khaki Chino", category="Bottom", clothing_type="chino", color="Khaki"))
    _create(client, auth, _item_payload(name="White Sneaker", category="Shoes", clothing_type="sneakers", color="White"))
    _create(client, auth, _item_payload(name="Brown Loafer", category="Shoes", clothing_type="loafer", color="Brown"))
    _create(
        client,
        auth,
        _item_payload(
            name="Navy Blazer",
            category="Outerwear",
            clothing_type="blazer",
            color="Navy",
            layer_type="outer",
            style_tags=["formal"],
            occasion_tags=["work"],
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Baseball Cap",
            category="Accessory",
            clothing_type="cap",
            color="Black",
            accessory_type="hat",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Silver Watch",
            category="Accessory",
            clothing_type="watch",
            color="Silver",
            accessory_type="watch",
        ),
    )

    response = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 3})
    assert response.status_code == 200
    body = response.json()
    outfits = body["outfits"]
    assert len(outfits) >= 3
    fingerprints = []
    for outfit in outfits:
        assert isinstance(outfit["explanation"], str)
        assert outfit["explanation"]
        assert isinstance(outfit["outfit_score"], float)
        item_ids = sorted(item["id"] for item in outfit["items"])
        fingerprints.append(",".join(str(item_id) for item_id in item_ids))
    assert len(fingerprints) == len(set(fingerprints))
    assert outfits[0]["outfit_score"] >= outfits[-1]["outfit_score"]


def test_recommendation_options_prefer_diverse_core_items_when_variety_exists(client):
    token = register_and_login(client, "card-diversity@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create(client, auth, _item_payload(name="Black Tee", category="Top", clothing_type="t-shirt", color="Black"))
    _create(client, auth, _item_payload(name="White Oxford", category="Top", clothing_type="shirt", color="White"))
    _create(client, auth, _item_payload(name="Blue Polo", category="Top", clothing_type="polo", color="Blue"))
    _create(client, auth, _item_payload(name="Blue Jeans", category="Bottom", clothing_type="jeans", color="Blue"))
    _create(client, auth, _item_payload(name="Khaki Chino", category="Bottom", clothing_type="chino", color="Khaki"))
    _create(client, auth, _item_payload(name="Gray Trouser", category="Bottom", clothing_type="pants", color="Gray"))
    _create(client, auth, _item_payload(name="White Sneaker", category="Shoes", clothing_type="sneakers", color="White"))
    _create(client, auth, _item_payload(name="Brown Loafer", category="Shoes", clothing_type="loafer", color="Brown"))
    _create(client, auth, _item_payload(name="Black Boot", category="Shoes", clothing_type="boots", color="Black"))

    response = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 3})
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert len(outfits) == 3

    top_ids = set()
    bottom_ids = set()
    shoe_ids = set()
    for outfit in outfits:
        categorized = {item["category"].lower(): item["id"] for item in outfit["items"]}
        top_ids.add(categorized["top"])
        bottom_ids.add(categorized["bottom"])
        shoe_ids.add(categorized["shoes"])

    assert len(top_ids) >= 2
    assert len(bottom_ids) >= 2
    assert len(shoe_ids) >= 2


def test_cold_recommendation_structure_requires_outerwear_and_caps_accessories(client):
    token = register_and_login(client, "card-cold-structure@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create(
        client,
        auth,
        _item_payload(
            name="Thermal Top",
            category="Top",
            clothing_type="sweater",
            color="Black",
            season="Winter",
            season_tags=["winter"],
            layer_type="base",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Warm Pants",
            category="Bottom",
            clothing_type="pants",
            color="Navy",
            season="Winter",
            season_tags=["winter"],
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Winter Boots",
            category="Shoes",
            clothing_type="boots",
            color="Brown",
            season="Winter",
            season_tags=["winter"],
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Heavy Coat",
            category="Outerwear",
            clothing_type="coat",
            color="Gray",
            season="Winter",
            season_tags=["winter"],
            layer_type="outer",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Wool Hat",
            category="Accessory",
            clothing_type="hat",
            color="Black",
            accessory_type="hat",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Beanie Hat",
            category="Accessory",
            clothing_type="beanie",
            color="Gray",
            accessory_type="hat",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Leather Gloves",
            category="Accessory",
            clothing_type="gloves",
            color="Black",
            accessory_type="gloves",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Wrist Watch",
            category="Accessory",
            clothing_type="watch",
            color="Silver",
            accessory_type="watch",
        ),
    )
    _create(
        client,
        auth,
        _item_payload(
            name="Scarf",
            category="Accessory",
            clothing_type="scarf",
            color="Red",
            accessory_type="scarf",
        ),
    )

    response = client.get("/recommendations/options", headers=auth, params={"weather_category": "cold", "limit": 3})
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert outfits
    first = outfits[0]["items"]
    categories = [item["category"].lower() for item in first]
    assert any("outer" in category or "jacket" in category or "coat" in category for category in categories)

    accessories = [item for item in first if item["category"].lower() == "accessory"]
    assert len(accessories) <= 3
    hat_like = [
        item for item in accessories
        if (item.get("accessory_type") or "").lower() in {"hat", "cap"}
        or "hat" in (item.get("name") or "").lower()
    ]
    assert len(hat_like) <= 1


def test_ai_recommendations_include_ranked_outfit_options(client, monkeypatch):
    token = register_and_login(client, "card-ai-options@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = _create(client, auth, _item_payload(name="Top A", category="Top", clothing_type="t-shirt", color="Black"))
    bottom = _create(client, auth, _item_payload(name="Bottom A", category="Bottom", clothing_type="jeans", color="Blue"))
    shoes = _create(client, auth, _item_payload(name="Shoes A", category="Shoes", clothing_type="sneakers", color="White"))
    _create(client, auth, _item_payload(name="Top B", category="Top", clothing_type="shirt", color="White"))
    _create(client, auth, _item_payload(name="Bottom B", category="Bottom", clothing_type="chino", color="Khaki"))
    _create(client, auth, _item_payload(name="Shoes B", category="Shoes", clothing_type="loafer", color="Brown"))

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(_messages):
            return (
                '{"item_ids":['
                f'{top["id"]},{bottom["id"]},{shoes["id"]}'
                '],"explanation":"AI selected a balanced set.","item_explanations":{"'
                f'{top["id"]}'
                '":"Core top"}}'
            )

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())

    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={"weather_category": "mild", "occasion": "daily"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["outfit_score"], float)
    assert body["outfit_options"]
    assert isinstance(body["outfit_options"][0]["outfit_score"], float)
    assert isinstance(body["outfit_options"][0]["explanation"], str)


def test_recommendation_option_explanations_vary_for_different_outfits(client):
    token = register_and_login(client, "card-explanations@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create(client, auth, _item_payload(name="Top Black", category="Top", clothing_type="t-shirt", color="Black"))
    _create(client, auth, _item_payload(name="Top White", category="Top", clothing_type="shirt", color="White"))
    _create(client, auth, _item_payload(name="Top Blue", category="Top", clothing_type="polo", color="Blue"))
    _create(client, auth, _item_payload(name="Bottom Khaki", category="Bottom", clothing_type="chino", color="Khaki"))
    _create(client, auth, _item_payload(name="Bottom Navy", category="Bottom", clothing_type="jeans", color="Navy"))
    _create(client, auth, _item_payload(name="Bottom Gray", category="Bottom", clothing_type="pants", color="Gray"))
    _create(client, auth, _item_payload(name="Shoes White", category="Shoes", clothing_type="sneakers", color="White"))

    response = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 6})
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert len(outfits) >= 3

    explanations = {outfit["explanation"] for outfit in outfits}
    assert len(explanations) >= 2
    assert all("color" in explanation.lower() for explanation in explanations)


def test_occasion_tags_influence_top_recommendation_choice(client):
    token = register_and_login(client, "card-occasion-signal@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    work_top = _create(
        client,
        auth,
        _item_payload(
            name="Work Shirt",
            category="Top",
            clothing_type="shirt",
            color="White",
            occasion_tags=["work", "formal"],
        ),
    )
    sport_top = _create(
        client,
        auth,
        _item_payload(
            name="Gym Tee",
            category="Top",
            clothing_type="t-shirt",
            color="Black",
            occasion_tags=["athletic", "gym"],
        ),
    )
    _create(client, auth, _item_payload(name="Bottom", category="Bottom", clothing_type="pants", color="Navy"))
    _create(client, auth, _item_payload(name="Shoes", category="Shoes", clothing_type="sneakers", color="White"))

    work_response = client.get(
        "/recommendations/options",
        headers=auth,
        params={"weather_category": "mild", "occasion": "work", "limit": 1},
    )
    assert work_response.status_code == 200
    work_items = work_response.json()["outfits"][0]["items"]
    work_item_ids = {item["id"] for item in work_items}
    assert work_top["id"] in work_item_ids

    gym_response = client.get(
        "/recommendations/options",
        headers=auth,
        params={"weather_category": "mild", "occasion": "gym", "limit": 1},
    )
    assert gym_response.status_code == 200
    gym_items = gym_response.json()["outfits"][0]["items"]
    gym_item_ids = {item["id"] for item in gym_items}
    assert sport_top["id"] in gym_item_ids
