/**
 * Mapping helpers between backend DTOs and Android domain models.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto

fun ClothingItemDto.toDomain(): ClothingItem {
    return ClothingItem(
        id = id,
        category = category,
        color = color,
        season = season,
        comfortLevel = comfortLevel,
        imageUrl = imageUrl,
        brand = brand,
        isAvailable = isAvailable,
        isArchived = isArchived,
        lastWornTimestamp = lastWornTimestamp,
    )
}

fun ClothingItem.toCreateRequest(): ClothingItemCreateRequest {
    return ClothingItemCreateRequest(
        category = category,
        color = color,
        season = season,
        comfortLevel = comfortLevel,
        imageUrl = imageUrl,
        brand = brand,
        isAvailable = isAvailable,
        isArchived = isArchived,
        lastWornTimestamp = lastWornTimestamp,
    )
}
