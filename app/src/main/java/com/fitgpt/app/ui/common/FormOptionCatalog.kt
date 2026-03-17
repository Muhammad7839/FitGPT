/**
 * Shared predefined option lists for profile, recommendation, and wardrobe selection controls.
 */
package com.fitgpt.app.ui.common

object FormOptionCatalog {
    const val OTHER_OPTION = "Other"

    val profileBodyTypes = listOf(
        "Athletic",
        "Slim",
        "Regular",
        "Curvy",
        "Plus-size",
        OTHER_OPTION
    )

    val profileLifestyle = listOf(
        "Casual",
        "Active",
        "Professional",
        "Streetwear",
        "Minimal",
        OTHER_OPTION
    )

    val profileComfortPreference = listOf(
        "Low",
        "Medium",
        "High",
        OTHER_OPTION
    )

    val skinToneOptions = listOf(
        "Fair",
        "Light",
        "Medium",
        "Tan",
        "Deep",
        OTHER_OPTION
    )

    val hairColorOptions = listOf(
        "Black",
        "Brown",
        "Blonde",
        "Red",
        "Gray",
        OTHER_OPTION
    )

    val recommendationOccasions = listOf(
        "Casual",
        "Work",
        "Gym",
        "Date",
        "Event",
        "Travel",
        OTHER_OPTION
    )

    val recommendationStyles = listOf(
        "Casual",
        "Smart casual",
        "Formal",
        "Sporty",
        "Streetwear",
        "Minimal",
        OTHER_OPTION
    )

    val seasonOptions = listOf(
        "All",
        "Spring",
        "Summer",
        "Fall",
        "Winter",
        OTHER_OPTION
    )

    val weatherCategoryOptions = listOf(
        "Cold",
        "Cool",
        "Mild",
        "Warm",
        "Hot",
        OTHER_OPTION
    )

    val wardrobeCategories = listOf(
        "Top",
        "Bottom",
        "Outerwear",
        "Shoes",
        "Accessories",
        OTHER_OPTION
    )

    val clothingTypes = listOf(
        "T-Shirt",
        "Shirt",
        "Sweater",
        "Hoodie",
        "Jacket",
        "Jeans",
        "Trousers",
        "Shorts",
        "Skirt",
        "Sneakers",
        "Boots",
        "Bag",
        OTHER_OPTION
    )

    val colorOptions = listOf(
        "Black",
        "White",
        "Gray",
        "Blue",
        "Navy",
        "Brown",
        "Green",
        "Red",
        "Pink",
        "Purple",
        "Yellow",
        "Orange",
        OTHER_OPTION
    )

    val layerTypeOptions = listOf(
        "base",
        "mid",
        "outer",
        OTHER_OPTION
    )

    val fitTypeOptions = listOf(
        "Slim",
        "Regular",
        "Relaxed",
        "Oversized",
        OTHER_OPTION
    )
}

