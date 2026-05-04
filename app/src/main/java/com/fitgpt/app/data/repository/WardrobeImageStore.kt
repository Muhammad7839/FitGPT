/**
 * Local image persistence for wardrobe photos that should not depend on backend uploads.
 */
package com.fitgpt.app.data.repository

import android.content.Context
import android.net.Uri
import java.io.File

interface WardrobeImageStore {
    fun saveTemporaryImage(bytes: ByteArray, fileName: String): String
    fun saveImageForItem(itemId: Int, bytes: ByteArray, fileName: String): String
    fun attachExistingImageToItem(itemId: Int, imageUrl: String?): String?
    fun localImageUrlForItem(itemId: Int): String?
    fun deleteImageForItem(itemId: Int)
}

class FileWardrobeImageStore(context: Context) : WardrobeImageStore {
    private val imageDir = File(context.applicationContext.filesDir, "wardrobe_images")

    override fun saveTemporaryImage(bytes: ByteArray, fileName: String): String {
        val file = File(imageDir.also { it.mkdirs() }, "temp_${System.currentTimeMillis()}_${safeName(fileName)}")
        file.writeBytes(bytes)
        return file.toUriString()
    }

    override fun saveImageForItem(itemId: Int, bytes: ByteArray, fileName: String): String {
        val target = itemFile(itemId, fileName)
        target.parentFile?.mkdirs()
        target.writeBytes(bytes)
        return target.toUriString()
    }

    override fun attachExistingImageToItem(itemId: Int, imageUrl: String?): String? {
        val source = fileFromUri(imageUrl) ?: return null
        if (!source.exists() || !source.isFile) return null

        val target = itemFile(itemId, source.name)
        target.parentFile?.mkdirs()
        if (source.absolutePath != target.absolutePath) {
            source.copyTo(target, overwrite = true)
            if (source.name.startsWith("temp_")) {
                source.delete()
            }
        }
        return target.toUriString()
    }

    override fun localImageUrlForItem(itemId: Int): String? {
        if (!imageDir.exists()) return null
        return imageDir
            .listFiles { file -> file.isFile && file.name.startsWith("item_${itemId}_") }
            ?.maxByOrNull { it.lastModified() }
            ?.toUriString()
    }

    override fun deleteImageForItem(itemId: Int) {
        if (!imageDir.exists()) return
        imageDir
            .listFiles { file -> file.isFile && file.name.startsWith("item_${itemId}_") }
            ?.forEach { it.delete() }
    }

    private fun itemFile(itemId: Int, fileName: String): File {
        return File(imageDir, "item_${itemId}_${safeName(fileName)}")
    }

    private fun safeName(fileName: String): String {
        val cleaned = fileName.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .trim('_')
        return cleaned.ifBlank { "image.jpg" }
    }

    private fun fileFromUri(imageUrl: String?): File? {
        val text = imageUrl?.trim().orEmpty()
        if (!text.startsWith("file:")) return null
        return runCatching { File(Uri.parse(text).path.orEmpty()) }.getOrNull()
    }

    private fun File.toUriString(): String = Uri.fromFile(this).toString()
}
