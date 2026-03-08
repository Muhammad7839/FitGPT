/**
 * Screen for creating wardrobe items with gallery/camera upload support.
 */
package com.fitgpt.app.ui.additem

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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

    val context = LocalContext.current
    val imageUploadState by viewModel.imageUploadState.collectAsState()
    val batchUploadState by viewModel.batchImageUploadState.collectAsState()

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap == null) {
            cameraMessage = "Camera capture cancelled"
            return@rememberLauncherForActivityResult
        }
        val bytes = bitmapToJpegBytes(bitmap)
        if (!isImagePayloadAllowed(bytes.size)) {
            cameraMessage = "Image is too large (max ${MAX_LOCAL_IMAGE_BYTES / (1024 * 1024)}MB)"
            return@rememberLauncherForActivityResult
        }
        val fileName = "camera_${System.currentTimeMillis()}.jpg"
        viewModel.uploadImage(bytes = bytes, fileName = fileName, mimeType = "image/jpeg")
        cameraMessage = null
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            cameraLauncher.launch(null)
        } else {
            cameraMessage = "Camera permission denied"
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val bytes = readBytes(context, uri) ?: return@rememberLauncherForActivityResult
        if (!isImagePayloadAllowed(bytes.size)) {
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
        viewModel.uploadImage(bytes = bytes, fileName = fileName, mimeType = mimeType)
    }

    val multiPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNullOrEmpty()) return@rememberLauncherForActivityResult
        val payloads = uris.mapNotNull { uri ->
            val bytes = readBytes(context, uri) ?: return@mapNotNull null
            if (!isImagePayloadAllowed(bytes.size)) {
                return@mapNotNull null
            }
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val extension = when (mimeType) {
                "image/png" -> ".png"
                "image/webp" -> ".webp"
                else -> ".jpg"
            }
            UploadImagePayload(
                bytes = bytes,
                fileName = "batch_${System.currentTimeMillis()}$extension",
                mimeType = mimeType
            )
        }
        viewModel.uploadImagesBatch(payloads)
    }

    LaunchedEffect(imageUploadState) {
        val upload = imageUploadState
        if (upload is UiState.Success && !upload.data.isNullOrBlank()) {
            imageUrl = upload.data
        }
    }

    Scaffold { padding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
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
                        onClick = { picker.launch("image/*") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Pick Image")
                    }

                    Button(
                        onClick = { multiPicker.launch("image/*") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Pick Multiple Images")
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
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
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Take Photo")
                        }
                    }

                    when (val upload = imageUploadState) {
                        UiState.Loading -> {
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

                    cameraMessage?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
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
                                Text(
                                    "Batch upload complete: $success success, $failed failed",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

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
                        return@Button
                    }
                    formError = null
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
                    navController.popBackStack()
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save Item")
            }
            formError?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}

private fun readBytes(context: Context, uri: Uri): ByteArray? {
    return context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
}

private fun bitmapToJpegBytes(bitmap: Bitmap): ByteArray {
    val output = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)
    return output.toByteArray()
}
