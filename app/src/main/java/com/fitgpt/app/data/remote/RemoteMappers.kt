/**
 * Mapping helpers between backend DTOs and Android domain models.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse
import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.ChatMessageDto
import com.fitgpt.app.data.remote.dto.ChatResponseDto
import com.fitgpt.app.data.remote.dto.AiRecommendationResponseDto

fun ClothingItemDto.toDomain(): ClothingItem {
    return ClothingItem(
        id = id,
        name = name,
        category = category,
        clothingType = clothingType,
        layerType = layerType,
        isOnePiece = isOnePiece,
        setIdentifier = setIdentifier,
        fitTag = fitTag,
        color = color,
        colors = colors,
        season = season,
        seasonTags = seasonTags,
        styleTags = styleTags,
        occasionTags = occasionTags,
        accessoryType = accessoryType,
        comfortLevel = comfortLevel,
        imageUrl = imageUrl,
        brand = brand,
        isAvailable = isAvailable,
        isFavorite = isFavorite,
        isArchived = isArchived,
        lastWornTimestamp = lastWornTimestamp,
    )
}

fun ClothingItem.toCreateRequest(): ClothingItemCreateRequest {
    return ClothingItemCreateRequest(
        name = name,
        category = category,
        clothingType = clothingType,
        layerType = layerType,
        isOnePiece = isOnePiece,
        setIdentifier = setIdentifier,
        fitTag = fitTag,
        color = color,
        colors = colors,
        season = season,
        seasonTags = seasonTags,
        styleTags = styleTags,
        occasionTags = occasionTags,
        accessoryType = accessoryType,
        comfortLevel = comfortLevel,
        imageUrl = imageUrl,
        brand = brand,
        isAvailable = isAvailable,
        isFavorite = isFavorite,
        isArchived = isArchived,
        lastWornTimestamp = lastWornTimestamp,
    )
}

fun AiChatMessage.toDto(): ChatMessageDto {
    return ChatMessageDto(
        role = role,
        content = content
    )
}

fun ChatResponseDto.toDomain(): AiChatResponse {
    return AiChatResponse(
        reply = reply,
        source = source,
        fallbackUsed = fallbackUsed,
        warning = warning
    )
}

fun AiRecommendationResponseDto.toDomain(): AiRecommendationResult {
    return AiRecommendationResult(
        items = items.map { it.toDomain() },
        explanation = explanation,
        outfitScore = outfitScore,
        source = source,
        fallbackUsed = fallbackUsed,
        warning = warning,
        weatherCategory = weatherCategory,
        occasion = occasion,
        suggestionId = suggestionId,
        itemExplanations = itemExplanations.associate { it.itemId to it.explanation },
        outfitOptions = outfitOptions.map { option ->
            OutfitOption(
                items = option.items.map { it.toDomain() },
                explanation = option.explanation,
                outfitScore = option.outfitScore
            )
        }
    )
}
