package com.fitgpt.app.ui.builder

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OutfitBuilderCategoryMatchTest {

    @Test
    fun tops_slot_matches_top_and_tops_categories() {
        assertTrue(categoryMatchesBuilderSlot("Top", "Tops"))
        assertTrue(categoryMatchesBuilderSlot("Tops", "Tops"))
    }

    @Test
    fun accessories_slot_matches_accessory_variants() {
        assertTrue(categoryMatchesBuilderSlot("Accessory", "Accessories"))
        assertTrue(categoryMatchesBuilderSlot("Accessories", "Accessories"))
    }
}
