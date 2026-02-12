package com.fitgpt.app.ai

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitRecommendation
import com.fitgpt.app.data.model.UserPreferences

class OutfitRecommendationEngine {

    fun recommend(
        items: List<ClothingItem>,
        preferences: UserPreferences
    ): List<OutfitRecommendation> {
        if (items.isEmpty()) return emptyList()

        val tops = items.filter { it.category.equals("Top", ignoreCase = true) }
        val bottoms = items.filter { it.category.equals("Bottom", ignoreCase = true) }
        val outerwear = items.filter { it.category.equals("Outerwear", ignoreCase = true) }
        val shoes = items.filter { it.category.equals("Shoes", ignoreCase = true) }
        val accessories = items.filter { it.category.equals("Accessory", ignoreCase = true) }

        val outfitCombinations = buildOutfitCombinations(tops, bottoms, outerwear, shoes, accessories)
            .distinctBy { combo -> combo.map { it.id }.sorted() }

        // If we couldn't form any multi-item outfits, fall back to scoring individual items
        if (outfitCombinations.isEmpty()) {
            return items.map { item ->
                val score = scoreItem(item, preferences)
                OutfitRecommendation(
                    items = listOf(item),
                    score = score,
                    explanation = generateExplanation(listOf(item), score, preferences)
                )
            }
                .sortedByDescending { it.score }
                .take(MAX_RECOMMENDATIONS)
        }

        return outfitCombinations
            .map { outfit ->
                val score = scoreOutfit(outfit, preferences)
                OutfitRecommendation(
                    items = outfit,
                    score = score,
                    explanation = generateExplanation(outfit, score, preferences)
                )
            }
            .sortedByDescending { it.score }
            .take(MAX_RECOMMENDATIONS)
    }

    fun generateItemExplanation(item: ClothingItem, preferences: UserPreferences): String {
        val reasons = mutableListOf<String>()

        // Season reasoning
        val seasonScore = seasonMatchScore(item, preferences)
        when {
            seasonScore >= 1.0 -> reasons.add(
                "Perfect for your preferred ${item.season.lowercase()} season"
            )
            item.season.equals("All", ignoreCase = true) -> reasons.add(
                "Versatile all-season piece"
            )
            else -> reasons.add(
                "Suited for ${item.season.lowercase()} weather"
            )
        }

        // Comfort reasoning
        val comfortDiff = item.comfortLevel - preferences.comfortPreference
        when {
            comfortDiff >= 1 -> reasons.add("exceeds your comfort preference")
            comfortDiff == 0 -> reasons.add("matches your comfort level exactly")
            comfortDiff == -1 -> reasons.add("slightly below your usual comfort preference")
            else -> reasons.add("prioritizes style over comfort")
        }

        // Style reasoning
        val styleNote = styleNote(item, preferences)
        if (styleNote != null) reasons.add(styleNote)

        // Color note
        reasons.add("${item.color.lowercase()} adds ${colorCharacter(item.color)} to your look")

        return reasons.joinToString(". ") + "."
    }

    // --- Scoring ---

    internal fun scoreItem(item: ClothingItem, preferences: UserPreferences): Double {
        val seasonScore = seasonMatchScore(item, preferences) * WEIGHT_SEASON
        val comfortScore = comfortMatchScore(item, preferences) * WEIGHT_COMFORT
        val styleScore = styleMatchScore(item, preferences) * WEIGHT_STYLE
        return seasonScore + comfortScore + styleScore
    }

    internal fun scoreOutfit(
        outfit: List<ClothingItem>,
        preferences: UserPreferences
    ): Double {
        if (outfit.isEmpty()) return 0.0

        val avgItemScore = outfit.sumOf { scoreItem(it, preferences) } / outfit.size
        val harmonyBonus = colorHarmonyBonus(outfit)
        val coverageBonus = categoryDiversityBonus(outfit)

        return avgItemScore + (harmonyBonus * WEIGHT_HARMONY) + (coverageBonus * WEIGHT_COVERAGE)
    }

    // --- Season ---

    internal fun seasonMatchScore(item: ClothingItem, preferences: UserPreferences): Double {
        if (item.season.equals("All", ignoreCase = true)) return 0.8
        return if (preferences.preferredSeasons.any { it.equals(item.season, ignoreCase = true) }) {
            1.0
        } else {
            0.2
        }
    }

    // --- Comfort ---

    internal fun comfortMatchScore(item: ClothingItem, preferences: UserPreferences): Double {
        val diff = Math.abs(item.comfortLevel - preferences.comfortPreference)
        return when (diff) {
            0 -> 1.0
            1 -> 0.7
            2 -> 0.4
            else -> 0.1
        }
    }

    // --- Style ---

    internal fun styleMatchScore(item: ClothingItem, preferences: UserPreferences): Double {
        val styleCategoryMap = mapOf(
            "Casual" to setOf("Top", "Bottom", "Shoes", "Accessory"),
            "Formal" to setOf("Top", "Bottom", "Outerwear", "Shoes"),
            "Sporty" to setOf("Top", "Bottom", "Shoes"),
            "Streetwear" to setOf("Top", "Bottom", "Outerwear", "Shoes", "Accessory")
        )

        val categories = styleCategoryMap[preferences.stylePreference]
        return if (categories != null && categories.any { it.equals(item.category, ignoreCase = true) }) {
            0.8
        } else {
            0.5
        }
    }

    // --- Color harmony ---

    internal fun colorHarmonyBonus(outfit: List<ClothingItem>): Double {
        if (outfit.size < 2) return 0.0

        val colors = outfit.map { it.color.lowercase() }

        // Neutral colors pair well with everything
        val neutrals = setOf("black", "white", "gray", "grey", "beige", "navy", "tan", "cream")
        val neutralCount = colors.count { it in neutrals }

        // All neutrals: solid but safe
        if (neutralCount == colors.size) return 0.6

        // Mix of neutrals and accent colors is ideal
        val accentCount = colors.size - neutralCount
        if (neutralCount >= 1 && accentCount >= 1) return 1.0

        // Complementary color pairs
        val complementary = mapOf(
            "blue" to "orange", "red" to "green", "yellow" to "purple",
            "orange" to "blue", "green" to "red", "purple" to "yellow"
        )
        for (i in colors.indices) {
            for (j in i + 1 until colors.size) {
                if (complementary[colors[i]] == colors[j]) return 0.9
            }
        }

        // Multiple non-neutral, non-complementary colors: risky
        if (accentCount > 2) return 0.2

        return 0.5
    }

    // --- Category diversity ---

    internal fun categoryDiversityBonus(outfit: List<ClothingItem>): Double {
        val categories = outfit.map { it.category.lowercase() }.toSet()
        val hasTop = "top" in categories
        val hasBottom = "bottom" in categories

        return when {
            hasTop && hasBottom && categories.size >= 3 -> 1.0
            hasTop && hasBottom -> 0.8
            hasTop || hasBottom -> 0.4
            else -> 0.2
        }
    }

    // --- Outfit combination builder ---

    private fun buildOutfitCombinations(
        tops: List<ClothingItem>,
        bottoms: List<ClothingItem>,
        outerwear: List<ClothingItem>,
        shoes: List<ClothingItem>,
        accessories: List<ClothingItem>
    ): List<List<ClothingItem>> {
        if (tops.isEmpty() || bottoms.isEmpty()) return emptyList()

        val combos = mutableListOf<List<ClothingItem>>()

        for (top in tops) {
            for (bottom in bottoms) {
                // Base outfit: top + bottom
                val base = listOf(top, bottom)
                combos.add(base)

                // Top + bottom + outerwear
                for (outer in outerwear) {
                    combos.add(base + outer)
                }

                // Top + bottom + shoes
                for (shoe in shoes) {
                    combos.add(base + shoe)

                    // Top + bottom + shoes + outerwear
                    for (outer in outerwear) {
                        combos.add(base + shoe + outer)
                    }
                }

                // Top + bottom + accessory
                for (acc in accessories) {
                    combos.add(base + acc)
                }
            }
        }

        return combos
    }

    // --- Explanation generation ---

    private fun generateExplanation(
        outfit: List<ClothingItem>,
        score: Double,
        preferences: UserPreferences
    ): String {
        val parts = mutableListOf<String>()

        // Outfit summary
        val itemNames = outfit.joinToString(" + ") { "${it.color} ${it.category}" }
        parts.add("Outfit: $itemNames")

        // Season insight
        val seasons = outfit.map { it.season }.toSet()
        when {
            seasons.all { it.equals("All", ignoreCase = true) } ->
                parts.add("All pieces are season-versatile")
            seasons.any { s -> preferences.preferredSeasons.any { it.equals(s, ignoreCase = true) } } ->
                parts.add("Great match for your preferred season")
            else ->
                parts.add("Consider for ${seasons.joinToString("/").lowercase()} weather")
        }

        // Comfort insight
        val avgComfort = outfit.sumOf { it.comfortLevel }.toDouble() / outfit.size
        when {
            avgComfort >= preferences.comfortPreference + 0.5 ->
                parts.add("Excellent comfort level for your preference")
            avgComfort >= preferences.comfortPreference - 0.5 ->
                parts.add("Comfort meets your preference well")
            else ->
                parts.add("Comfort is a trade-off for this outfit's style")
        }

        // Color harmony insight
        val harmonyScore = colorHarmonyBonus(outfit)
        when {
            harmonyScore >= 0.9 -> parts.add("Colors complement each other beautifully")
            harmonyScore >= 0.6 -> parts.add("Solid neutral palette")
            harmonyScore < 0.3 -> parts.add("Bold color combination")
        }

        // Style match
        when (preferences.stylePreference.lowercase()) {
            "casual" -> parts.add("Fits a relaxed, casual vibe")
            "formal" -> parts.add("Suitable for a polished, formal look")
            "sporty" -> parts.add("Great for an active, sporty style")
            "streetwear" -> parts.add("On-trend for a streetwear aesthetic")
        }

        // Score tier
        val tier = when {
            score >= 2.5 -> "Highly recommended"
            score >= 1.5 -> "Good match"
            else -> "Worth trying"
        }
        parts.add(tier)

        return parts.joinToString(". ") + "."
    }

    private fun styleNote(item: ClothingItem, preferences: UserPreferences): String? {
        return when (preferences.stylePreference.lowercase()) {
            "casual" -> if (item.comfortLevel >= 4) "great casual pick for everyday wear" else null
            "formal" -> if (item.category.equals("Outerwear", ignoreCase = true)) "adds a formal finishing touch" else null
            "sporty" -> if (item.comfortLevel >= 4) "comfort-first choice for an active lifestyle" else null
            "streetwear" -> "works well in a streetwear rotation"
            else -> null
        }
    }

    private fun colorCharacter(color: String): String {
        return when (color.lowercase()) {
            "black" -> "timeless sophistication"
            "white" -> "clean freshness"
            "blue", "navy" -> "calm versatility"
            "red" -> "bold energy"
            "green" -> "natural balance"
            "gray", "grey" -> "understated elegance"
            "beige", "tan", "cream" -> "warm neutrality"
            "yellow" -> "cheerful brightness"
            "orange" -> "vibrant warmth"
            "purple" -> "creative flair"
            "pink" -> "playful softness"
            "brown" -> "earthy grounding"
            else -> "unique character"
        }
    }

    companion object {
        private const val MAX_RECOMMENDATIONS = 5

        // Scoring weights
        internal const val WEIGHT_SEASON = 0.35
        internal const val WEIGHT_COMFORT = 0.25
        internal const val WEIGHT_STYLE = 0.20
        internal const val WEIGHT_HARMONY = 0.10
        internal const val WEIGHT_COVERAGE = 0.10
    }
}
