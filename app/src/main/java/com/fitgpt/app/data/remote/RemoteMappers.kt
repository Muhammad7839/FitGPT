/**
 * Mapping helpers between backend DTOs and Android domain models.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse
import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.PromptFeedbackMetadata
import com.fitgpt.app.data.model.TagSuggestion
import com.fitgpt.app.data.model.TripPackingItem
import com.fitgpt.app.data.model.TripPackingResult
import com.fitgpt.app.data.model.UnderusedAlert
import com.fitgpt.app.data.model.UnderusedAlertsResult
import com.fitgpt.app.data.model.WardrobeGapAnalysis
import com.fitgpt.app.data.model.WardrobeGapSuggestion
import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.ChatMessageDto
import com.fitgpt.app.data.remote.dto.ChatResponseDto
import com.fitgpt.app.data.remote.dto.AiRecommendationResponseDto
import com.fitgpt.app.data.remote.dto.PromptFeedbackMetadataDto
import com.fitgpt.app.data.remote.dto.TagSuggestionResponseDto
import com.fitgpt.app.data.remote.dto.TripPackingResponseDto
import com.fitgpt.app.data.remote.dto.UnderusedAlertsResponseDto
import com.fitgpt.app.data.remote.dto.UnderusedItemAlertDto
import com.fitgpt.app.data.remote.dto.WardrobeGapResponseDto
import com.fitgpt.app.data.remote.dto.WardrobeGapSuggestionDto

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
        suggestedClothingType = suggestedClothingType,
        suggestedFitTag = suggestedFitTag,
        suggestedColors = suggestedColors,
        suggestedSeasonTags = suggestedSeasonTags,
        suggestedStyleTags = suggestedStyleTags,
        suggestedOccasionTags = suggestedOccasionTags,
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

fun TagSuggestionResponseDto.toDomain(): TagSuggestion {
    return TagSuggestion(
        generated = generated,
        suggestedClothingType = suggestedClothingType,
        suggestedFitTag = suggestedFitTag,
        suggestedColors = suggestedColors,
        suggestedSeasonTags = suggestedSeasonTags,
        suggestedStyleTags = suggestedStyleTags,
        suggestedOccasionTags = suggestedOccasionTags
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
        outfitScore = confidenceScore ?: outfitScore,
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
                outfitScore = option.confidenceScore ?: option.outfitScore
            )
        },
        promptFeedback = promptFeedback?.toDomain()
    )
}

fun PromptFeedbackMetadataDto.toDomain(): PromptFeedbackMetadata {
    return PromptFeedbackMetadata(
        shouldPrompt = shouldPrompt,
        reason = reason,
        cooldownSecondsRemaining = cooldownSecondsRemaining
    )
}

fun WardrobeGapSuggestionDto.toDomain(): WardrobeGapSuggestion {
    return WardrobeGapSuggestion(
        category = category,
        itemName = itemName,
        reason = reason,
        imageUrl = imageUrl,
        shoppingLink = shoppingLink
    )
}

fun WardrobeGapResponseDto.toDomain(): WardrobeGapAnalysis {
    return WardrobeGapAnalysis(
        baselineCategories = baselineCategories,
        categoryCounts = categoryCounts,
        missingCategories = missingCategories,
        suggestions = suggestions.map { it.toDomain() },
        insufficientData = insufficientData
    )
}

fun UnderusedItemAlertDto.toDomain(): UnderusedAlert {
    return UnderusedAlert(
        itemId = itemId,
        itemName = itemName,
        category = category,
        wearCount = wearCount,
        lastWornTimestamp = lastWornTimestamp,
        daysSinceWorn = daysSinceWorn,
        alertLevel = alertLevel
    )
}

fun UnderusedAlertsResponseDto.toDomain(): UnderusedAlertsResult {
    return UnderusedAlertsResult(
        generatedAtTimestamp = generatedAtTimestamp,
        analysisWindowDays = analysisWindowDays,
        alerts = alerts.map { it.toDomain() },
        insufficientData = insufficientData
    )
}

fun TripPackingResponseDto.toDomain(): TripPackingResult {
    return TripPackingResult(
        destinationCity = destinationCity,
        startDate = startDate,
        tripDays = tripDays,
        weatherSummary = weatherSummary,
        items = items.map { item ->
            TripPackingItem(
                category = item.category,
                recommendedQuantity = item.recommendedQuantity,
                selectedItemIds = item.selectedItemIds,
                selectedItemNames = item.selectedItemNames,
                missingQuantity = item.missingQuantity
            )
        },
        generatedAtTimestamp = generatedAtTimestamp,
        insufficientData = insufficientData
    )
}
