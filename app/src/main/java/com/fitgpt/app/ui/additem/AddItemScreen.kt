/**
 * Screen for creating wardrobe items with gallery/camera upload support.
 */
package com.fitgpt.app.ui.additem

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.repository.UploadImagePayload
import com.fitgpt.app.ui.common.MAX_LOCAL_IMAGE_BYTES
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.isImagePayloadAllowed
import com.fitgpt.app.ui.common.parseComfortLevel
import com.fitgpt.app.ui.common.validateClothingItemForm
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.io.ByteArrayOutputStream

private const val UPLOAD_LOG_TAG = "FitGPTUpload"
private const val AUTO_FILL_UNKNOWN = "Unknown"

private enum class PhotoFlowState {
    IDLE,
    PICKING,
    UPLOADING,
    UPLOADED,
    READY_TO_SAVE,
    SAVING,
    DONE,
    ERROR
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    var name by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var clothingType by remember { mutableStateOf("") }
    var fitTag by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }
    var season by remember { mutableStateOf("") }
    var comfort by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var imageUrl by remember { mutableStateOf("") }
    var cameraMessage by remember { mutableStateOf<String?>(null) }
    var formError by remember { mutableStateOf<String?>(null) }
    var batchAutoCreateMessage by remember { mutableStateOf<String?>(null) }
    var batchAutoFillHints by remember { mutableStateOf<Map<String, ImageAutoFillHint>>(emptyMap()) }
    var showPhotoOptions by remember { mutableStateOf(false) }
    var photoFlowState by remember { mutableStateOf(PhotoFlowState.IDLE) }
    val snackbarHostState = remember { SnackbarHostState() }

    val context = LocalContext.current
    val imageUploadState by viewModel.imageUploadState.collectAsState()
    val batchUploadState by viewModel.batchImageUploadState.collectAsState()
    val itemSaveState by viewModel.itemSaveState.collectAsState()
    val bulkItemSaveState by viewModel.bulkItemSaveState.collectAsState()
    val isSavingItem = itemSaveState is UiState.Loading || bulkItemSaveState is UiState.Loading

    LaunchedEffect(Unit) {
        viewModel.clearItemSaveState()
        viewModel.clearBulkItemSaveState()
    }

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap == null) {
            cameraMessage = "Camera capture cancelled"
            photoFlowState = PhotoFlowState.IDLE
            Log.i(UPLOAD_LOG_TAG, "camera capture cancelled")
            return@rememberLauncherForActivityResult
        }
        val bytes = bitmapToJpegBytes(bitmap)
        if (!isImagePayloadAllowed(bytes.size)) {
            cameraMessage = "Image is too large (max ${MAX_LOCAL_IMAGE_BYTES / (1024 * 1024)}MB)"
            photoFlowState = PhotoFlowState.ERROR
            Log.w(UPLOAD_LOG_TAG, "camera image rejected size=${bytes.size}")
            return@rememberLauncherForActivityResult
        }
        val fileName = "camera_${System.currentTimeMillis()}.jpg"
        photoFlowState = PhotoFlowState.UPLOADING
        Log.i(UPLOAD_LOG_TAG, "camera image accepted size=${bytes.size}")
        viewModel.uploadImage(bytes = bytes, fileName = fileName, mimeType = "image/jpeg")
        cameraMessage = null
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            Log.i(UPLOAD_LOG_TAG, "camera permission granted")
            photoFlowState = PhotoFlowState.PICKING
            cameraLauncher.launch(null)
        } else {
            cameraMessage = "Camera permission denied"
            photoFlowState = PhotoFlowState.ERROR
            Log.w(UPLOAD_LOG_TAG, "camera permission denied")
        }
    }

    val multiPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNullOrEmpty()) {
            photoFlowState = PhotoFlowState.IDLE
            return@rememberLauncherForActivityResult
        }
        photoFlowState = PhotoFlowState.UPLOADING

        if (uris.size == 1) {
            val uri = uris.first()
            val bytes = readBytes(context, uri)
            if (bytes == null) {
                photoFlowState = PhotoFlowState.ERROR
                cameraMessage = "Unable to read selected image"
                return@rememberLauncherForActivityResult
            }
            if (!isImagePayloadAllowed(bytes.size)) {
                Log.w(UPLOAD_LOG_TAG, "batch image rejected size=${bytes.size}")
                photoFlowState = PhotoFlowState.ERROR
                cameraMessage = "Image is too large (max ${MAX_LOCAL_IMAGE_BYTES / (1024 * 1024)}MB)"
                return@rememberLauncherForActivityResult
            }
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val extension = when (mimeType) {
                "image/png" -> ".png"
                "image/webp" -> ".webp"
                else -> ".jpg"
            }
            val fileName = "item_${System.currentTimeMillis()}$extension"
            val sourceName = resolveDisplayName(context, uri) ?: fileName
            val inferredFromName = inferFromFileName(sourceName)
            category = category.ifBlank { inferredFromName.category ?: "" }
            if (clothingType.isBlank()) {
                clothingType = inferredFromName.clothingType ?: ""
            }
            if (fitTag.isBlank()) {
                fitTag = inferredFromName.fitTag ?: ""
            }
            if (season.isBlank()) {
                season = inferredFromName.season ?: ""
            }
            if (color.isBlank()) {
                color = inferDominantColorName(bytes) ?: ""
            }
            if (comfort.isBlank()) {
                comfort = inferredFromName.comfortLevel?.toString().orEmpty()
            }
            Log.i(UPLOAD_LOG_TAG, "gallery image selected mime=$mimeType size=${bytes.size}")
            viewModel.uploadImage(
                bytes = bytes,
                fileName = fileName,
                mimeType = mimeType
            )
            return@rememberLauncherForActivityResult
        }

        val hints = mutableMapOf<String, ImageAutoFillHint>()
        val payloads = uris.mapIndexedNotNull { index, uri ->
            val bytes = readBytes(context, uri) ?: return@mapIndexedNotNull null
            if (!isImagePayloadAllowed(bytes.size)) {
                Log.w(UPLOAD_LOG_TAG, "batch image rejected size=${bytes.size}")
                return@mapIndexedNotNull null
            }
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val extension = when (mimeType) {
                "image/png" -> ".png"
                "image/webp" -> ".webp"
                else -> ".jpg"
            }
            val fileName = "batch_${System.currentTimeMillis()}_${index}$extension"
            val sourceName = resolveDisplayName(context, uri) ?: fileName
            val inferredFromName = inferFromFileName(sourceName)
            hints[fileName] = ImageAutoFillHint(
                category = inferredFromName.category,
                clothingType = inferredFromName.clothingType,
                color = inferDominantColorName(bytes),
                fitTag = inferredFromName.fitTag,
                season = inferredFromName.season,
                comfortLevel = inferredFromName.comfortLevel
            )
            UploadImagePayload(
                bytes = bytes,
                fileName = fileName,
                mimeType = mimeType
            )
        }
        batchAutoFillHints = hints
        Log.i(UPLOAD_LOG_TAG, "batch upload selected count=${payloads.size}")
        if (payloads.isEmpty()) {
            photoFlowState = PhotoFlowState.ERROR
            batchAutoCreateMessage = "No valid images were selected."
            return@rememberLauncherForActivityResult
        }
        viewModel.uploadImagesBatch(payloads)
    }

    LaunchedEffect(imageUploadState) {
        val upload = imageUploadState
        if (upload is UiState.Success && !upload.data.isNullOrBlank()) {
            imageUrl = upload.data
            photoFlowState = PhotoFlowState.READY_TO_SAVE
            Log.i(UPLOAD_LOG_TAG, "single upload success urlSet=true")
        } else if (upload is UiState.Error) {
            photoFlowState = PhotoFlowState.ERROR
        }
    }

    LaunchedEffect(batchUploadState) {
        val batch = batchUploadState
        if (batch !is UiState.Success || batch.data.isEmpty()) return@LaunchedEffect

        val successfulImageUrls = batch.data
            .filter { it.status.equals("success", ignoreCase = true) }
            .mapNotNull { it.imageUrl?.trim()?.takeIf(String::isNotEmpty) }

        if (successfulImageUrls.isEmpty()) {
            batchAutoCreateMessage = "No valid images were uploaded."
            photoFlowState = PhotoFlowState.ERROR
            batchAutoFillHints = emptyMap()
            viewModel.clearBatchUploadState()
            return@LaunchedEffect
        }

        val baseName = name.trim().takeIf { it.isNotBlank() }
        val baseComfort = parseComfortLevel(comfort).coerceIn(1, 5)
        val typedCategory = category.trim()
        val typedColor = color.trim()
        val typedSeason = season.trim()
        val typedClothingType = clothingType.trim().takeIf { it.isNotBlank() }
        val typedFitTag = fitTag.trim().takeIf { it.isNotBlank() }
        val typedBrand = brand.trim().takeIf { it.isNotBlank() }
        val timestamp = System.currentTimeMillis().toInt()
        val successfulEntries = batch.data.filter { it.status.equals("success", ignoreCase = true) }
        val items = successfulEntries.mapIndexedNotNull { index, entry ->
            val url = entry.imageUrl?.trim()?.takeIf(String::isNotEmpty) ?: return@mapIndexedNotNull null
            val hint = batchAutoFillHints[entry.fileName]
            val resolvedCategory = typedCategory.ifBlank { hint?.category ?: "Top" }
            val resolvedClothingType = typedClothingType ?: hint?.clothingType
            val resolvedColor = typedColor.ifBlank { hint?.color ?: AUTO_FILL_UNKNOWN }
            val resolvedSeason = typedSeason.ifBlank { hint?.season ?: "All" }
            val resolvedComfort = parseComfortLevel(comfort).takeIf { comfort.trim().isNotEmpty() }
                ?: hint?.comfortLevel
                ?: baseComfort
            ClothingItem(
                id = timestamp + index,
                name = buildBatchItemName(
                    baseName = baseName,
                    category = resolvedCategory,
                    index = index,
                    total = successfulEntries.size
                ),
                category = resolvedCategory,
                clothingType = resolvedClothingType,
                fitTag = typedFitTag,
                color = resolvedColor,
                season = resolvedSeason,
                comfortLevel = resolvedComfort.coerceIn(1, 5),
                brand = typedBrand,
                imageUrl = url
            )
        }
        if (items.isEmpty()) {
            batchAutoCreateMessage = "Images uploaded but none were ready to save."
            batchAutoFillHints = emptyMap()
            viewModel.clearBatchUploadState()
            return@LaunchedEffect
        }

        Log.i(
            UPLOAD_LOG_TAG,
            "batch auto-create start successCount=${items.size} total=${batch.data.size}"
        )
        formError = null
        photoFlowState = PhotoFlowState.SAVING
        batchAutoCreateMessage = "Saving ${items.size} item(s) from uploaded photos..."
        viewModel.addItemsBulk(items)
        imageUrl = items.firstOrNull()?.imageUrl.orEmpty()
        batchAutoFillHints = emptyMap()
        viewModel.clearBatchUploadState()
    }

    LaunchedEffect(itemSaveState) {
        when (val saveState = itemSaveState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                formError = saveState.message
            }
            is UiState.Success -> {
                val savedCount = saveState.data ?: 0
                if (savedCount > 0) {
                    photoFlowState = PhotoFlowState.DONE
                    snackbarHostState.showSnackbar("Item saved to wardrobe.")
                    viewModel.clearItemSaveState()
                    navController.navigate(Routes.WARDROBE) {
                        popUpTo(Routes.WARDROBE) { inclusive = false }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            }
        }
    }

    LaunchedEffect(bulkItemSaveState) {
        when (val saveState = bulkItemSaveState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                batchAutoCreateMessage = saveState.message
                photoFlowState = PhotoFlowState.ERROR
            }
            is UiState.Success -> {
                val savedCount = saveState.data ?: 0
                if (savedCount > 0) {
                    photoFlowState = PhotoFlowState.DONE
                    batchAutoCreateMessage = "Added $savedCount item(s) from selected photos."
                    snackbarHostState.showSnackbar("Added $savedCount item(s) to wardrobe.")
                    viewModel.clearBulkItemSaveState()
                    navController.navigate(Routes.WARDROBE) {
                        popUpTo(Routes.WARDROBE) { inclusive = false }
                        launchSingleTop = true
                        restoreState = true
                    }
                } else {
                    batchAutoCreateMessage = "No uploaded photos were saved."
                }
            }
        }
    }

    if (showPhotoOptions) {
        ModalBottomSheet(
            onDismissRequest = { showPhotoOptions = false }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Add Photo", style = MaterialTheme.typography.titleMedium)
                Button(
                    onClick = {
                        showPhotoOptions = false
                        photoFlowState = PhotoFlowState.PICKING
                        val granted = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        if (granted) {
                            cameraLauncher.launch(null)
                        } else {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Take Photo")
                }
                Button(
                    onClick = {
                        showPhotoOptions = false
                        photoFlowState = PhotoFlowState.PICKING
                        multiPicker.launch("image/*")
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Choose from Gallery")
                }
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        val scrollState = rememberScrollState()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(scrollState)
        ) {

            Spacer(modifier = Modifier.height(12.dp))

            SectionHeader(
                title = "Add New Item",
                subtitle = "Capture or upload clothing, then save to your wardrobe"
            )

            Spacer(modifier = Modifier.height(24.dp))

            WebCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Name (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = category,
                        onValueChange = { category = it },
                        label = { Text("Category") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = clothingType,
                        onValueChange = { clothingType = it },
                        label = { Text("Clothing Type (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = fitTag,
                        onValueChange = { fitTag = it },
                        label = { Text("Fit Tag (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = color,
                        onValueChange = { color = it },
                        label = { Text("Color") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = season,
                        onValueChange = { season = it },
                        label = { Text("Season") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = comfort,
                        onValueChange = { comfort = it },
                        label = { Text("Comfort Level (1–5)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = brand,
                        onValueChange = { brand = it },
                        label = { Text("Brand (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = { showPhotoOptions = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Add Photo")
                    }

                    when (val upload = imageUploadState) {
                        UiState.Loading -> {
                            photoFlowState = PhotoFlowState.UPLOADING
                            CircularProgressIndicator()
                        }
                        is UiState.Error -> {
                            Text(upload.message, color = MaterialTheme.colorScheme.error)
                        }
                        is UiState.Success -> {
                            if (!imageUrl.isNullOrBlank()) {
                                Text(
                                    text = "Image ready: $imageUrl",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    Text(
                        text = "Photo state: ${photoFlowState.name.lowercase().replace('_', ' ')}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    cameraMessage?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    batchAutoCreateMessage?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    if (imageUrl.isNotBlank()) {
                        RemoteImagePreview(
                            imageUrl = imageUrl,
                            contentDescription = "Selected image",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                        )
                    }

                    when (val batch = batchUploadState) {
                        UiState.Loading -> {
                            Text("Uploading selected images...")
                        }
                        is UiState.Error -> {
                            Text(batch.message, color = MaterialTheme.colorScheme.error)
                        }
                        is UiState.Success -> {
                            if (batch.data.isNotEmpty()) {
                                val success = batch.data.count { it.status == "success" }
                                val failed = batch.data.size - success
                                if (imageUrl.isBlank()) {
                                    imageUrl = batch.data.firstOrNull { !it.imageUrl.isNullOrBlank() }?.imageUrl.orEmpty()
                                }
                                Text(
                                    "Batch upload complete: $success success, $failed failed.",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }

                    Button(
                        onClick = {
                            val validationError = validateClothingItemForm(
                                category = category,
                                color = color,
                                season = season,
                                comfortText = comfort
                            )
                            if (validationError != null) {
                                formError = validationError
                                photoFlowState = PhotoFlowState.ERROR
                                return@Button
                            }
                            formError = null
                            photoFlowState = PhotoFlowState.SAVING
                            viewModel.addItem(
                                ClothingItem(
                                    id = System.currentTimeMillis().toInt(),
                                    name = name.trim().takeIf { it.isNotBlank() },
                                    category = category.trim(),
                                    clothingType = clothingType.trim().takeIf { it.isNotBlank() },
                                    fitTag = fitTag.trim().takeIf { it.isNotBlank() },
                                    color = color.trim(),
                                    season = season.trim(),
                                    comfortLevel = parseComfortLevel(comfort),
                                    brand = brand.trim().takeIf { it.isNotBlank() },
                                    imageUrl = imageUrl.takeIf { it.isNotBlank() }
                                )
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSavingItem,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(if (isSavingItem) "Saving..." else "Save Item")
                    }

                    formError?.let {
                        Text(
                            text = it,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}

private fun readBytes(context: Context, uri: Uri): ByteArray? {
    return context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
}

private fun resolveDisplayName(context: Context, uri: Uri): String? {
    val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
    return context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index < 0 || !cursor.moveToFirst()) return@use null
        cursor.getString(index)?.trim()?.takeIf { it.isNotEmpty() }
    }
}

private fun bitmapToJpegBytes(bitmap: Bitmap): ByteArray {
    val output = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)
    return output.toByteArray()
}

private fun buildBatchItemName(
    baseName: String?,
    category: String,
    index: Int,
    total: Int
): String {
    val cleanedBaseName = baseName?.trim().orEmpty()
    val fallback = "$category Photo"
    return when {
        cleanedBaseName.isNotEmpty() && total == 1 -> cleanedBaseName
        cleanedBaseName.isNotEmpty() -> "$cleanedBaseName #${index + 1}"
        total == 1 -> fallback
        else -> "$fallback #${index + 1}"
    }
}

private data class InferredNameHint(
    val category: String?,
    val clothingType: String?,
    val fitTag: String? = null,
    val season: String? = null,
    val comfortLevel: Int? = null
)

private data class ImageAutoFillHint(
    val category: String?,
    val clothingType: String?,
    val color: String?,
    val fitTag: String?,
    val season: String?,
    val comfortLevel: Int?
)

private fun inferFromFileName(fileName: String): InferredNameHint {
    val normalized = fileName.lowercase()
    val keywordHints = listOf(
        "jacket" to InferredNameHint(category = "Outerwear", clothingType = "Jacket", season = "Winter", comfortLevel = 4),
        "coat" to InferredNameHint(category = "Outerwear", clothingType = "Coat", season = "Winter", comfortLevel = 4),
        "hoodie" to InferredNameHint(category = "Outerwear", clothingType = "Hoodie", season = "Fall", comfortLevel = 4),
        "sweater" to InferredNameHint(category = "Top", clothingType = "Sweater", season = "Fall", comfortLevel = 4),
        "shirt" to InferredNameHint(category = "Top", clothingType = "Shirt", season = "All", comfortLevel = 3),
        "tshirt" to InferredNameHint(category = "Top", clothingType = "T-Shirt", season = "Summer", comfortLevel = 4),
        "tee" to InferredNameHint(category = "Top", clothingType = "T-Shirt", season = "Summer", comfortLevel = 4),
        "blouse" to InferredNameHint(category = "Top", clothingType = "Blouse", season = "Spring", comfortLevel = 3),
        "jeans" to InferredNameHint(category = "Bottom", clothingType = "Jeans", season = "All", comfortLevel = 3),
        "pants" to InferredNameHint(category = "Bottom", clothingType = "Pants", season = "All", comfortLevel = 3),
        "trouser" to InferredNameHint(category = "Bottom", clothingType = "Trousers", season = "All", comfortLevel = 3),
        "shorts" to InferredNameHint(category = "Bottom", clothingType = "Shorts", season = "Summer", comfortLevel = 4),
        "skirt" to InferredNameHint(category = "Bottom", clothingType = "Skirt", season = "Spring", comfortLevel = 3),
        "shoe" to InferredNameHint(category = "Shoes", clothingType = "Shoes", season = "All", comfortLevel = 3),
        "sneaker" to InferredNameHint(category = "Shoes", clothingType = "Sneakers", season = "All", comfortLevel = 4),
        "boot" to InferredNameHint(category = "Shoes", clothingType = "Boots", season = "Winter", comfortLevel = 3),
        "sandal" to InferredNameHint(category = "Shoes", clothingType = "Sandals", season = "Summer", comfortLevel = 4),
        "hat" to InferredNameHint(category = "Accessory", clothingType = "Hat", season = "All", comfortLevel = 3),
        "cap" to InferredNameHint(category = "Accessory", clothingType = "Cap", season = "Summer", comfortLevel = 3),
        "scarf" to InferredNameHint(category = "Accessory", clothingType = "Scarf", season = "Winter", comfortLevel = 3),
        "watch" to InferredNameHint(category = "Accessory", clothingType = "Watch", season = "All", comfortLevel = 3),
        "bag" to InferredNameHint(category = "Accessory", clothingType = "Bag", season = "All", comfortLevel = 3),
    )
    val baseHint = keywordHints.firstOrNull { (keyword, _) ->
        normalized.contains(keyword)
    }?.second ?: InferredNameHint(category = "Top", clothingType = null, season = "All", comfortLevel = 3)

    val inferredFitTag = when {
        normalized.contains("oversized") || normalized.contains("baggy") -> "oversized"
        normalized.contains("slim") || normalized.contains("skinny") -> "slim"
        normalized.contains("regular") || normalized.contains("classic") -> "regular"
        else -> null
    }
    return baseHint.copy(fitTag = baseHint.fitTag ?: inferredFitTag)
}

private fun inferDominantColorName(bytes: ByteArray): String? {
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val width = bitmap.width
    val height = bitmap.height
    if (width <= 0 || height <= 0) return null

    val stepX = (width / 24).coerceAtLeast(1)
    val stepY = (height / 24).coerceAtLeast(1)
    var redTotal = 0L
    var greenTotal = 0L
    var blueTotal = 0L
    var countedPixels = 0L

    var y = 0
    while (y < height) {
        var x = 0
        while (x < width) {
            val pixel = bitmap.getPixel(x, y)
            if (Color.alpha(pixel) >= 24) {
                redTotal += Color.red(pixel)
                greenTotal += Color.green(pixel)
                blueTotal += Color.blue(pixel)
                countedPixels += 1
            }
            x += stepX
        }
        y += stepY
    }

    if (countedPixels == 0L) return null
    val red = (redTotal / countedPixels).toInt()
    val green = (greenTotal / countedPixels).toInt()
    val blue = (blueTotal / countedPixels).toInt()
    return mapRgbToColorName(red, green, blue)
}

private fun mapRgbToColorName(red: Int, green: Int, blue: Int): String {
    val hsv = FloatArray(3)
    Color.RGBToHSV(red, green, blue, hsv)
    val hue = hsv[0]
    val saturation = hsv[1]
    val value = hsv[2]

    if (value < 0.15f) return "Black"
    if (saturation < 0.10f && value > 0.88f) return "White"
    if (saturation < 0.14f) return "Gray"

    if (hue < 15f || hue >= 345f) return "Red"
    if (hue < 35f) return if (value < 0.58f) "Brown" else "Orange"
    if (hue < 55f) return "Yellow"
    if (hue < 90f) return "Green"
    if (hue < 145f) return "Green"
    if (hue < 210f) return "Blue"
    if (hue < 270f) return "Purple"
    if (hue < 330f) return "Pink"

    return AUTO_FILL_UNKNOWN
}
