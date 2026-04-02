package com.fitgpt.app.data.model

/**
 * Per-file upload status used for batch image upload feedback.
 */
data class UploadResult(
    val fileName: String,
    val status: String,
    val imageUrl: String?,
    val error: String?
)
