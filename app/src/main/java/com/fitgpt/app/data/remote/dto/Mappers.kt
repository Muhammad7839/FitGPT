package com.fitgpt.app.data.remote.dto

import com.fitgpt.app.data.model.ClothingItem

fun ClothingItemDto.toClothingItem(): ClothingItem = ClothingItem(
    id = id,
    category = category,
    color = color,
    season = season,
    comfortLevel = comfortLevel,
    imageUrl = imageUrl
)

fun ClothingItem.toCreateRequest(): CreateItemRequest = CreateItemRequest(
    category = category,
    color = color,
    season = season,
    comfortLevel = comfortLevel,
    imageUrl = imageUrl
)

fun ClothingItem.toUpdateRequest(): UpdateItemRequest = UpdateItemRequest(
    category = category,
    color = color,
    season = season,
    comfortLevel = comfortLevel,
    imageUrl = imageUrl
)
