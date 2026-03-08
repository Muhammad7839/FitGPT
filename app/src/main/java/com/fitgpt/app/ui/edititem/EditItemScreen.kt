package com.fitgpt.app.ui.edititem

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.io.ByteArrayOutputStream

@Composable
fun EditItemScreen(
    navController: NavController,
    itemId: Int,
    viewModel: WardrobeViewModel
) {
    val state by viewModel.wardrobeState.collectAsState()
    val imageUploadState by viewModel.imageUploadState.collectAsState()
    val context = LocalContext.current

    when (state) {

        is UiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = androidx.compose.ui.Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }

        is UiState.Error -> {
            Text(
                text = (state as UiState.Error).message,
                modifier = Modifier.padding(16.dp)
            )
        }

        is UiState.Success -> {
            val items = (state as UiState.Success<List<ClothingItem>>).data
            val item = items.find { it.id == itemId }

            if (item == null) {
                Text("Item not found")
                return
            }

            var category by remember { mutableStateOf(item.category) }
            var color by remember { mutableStateOf(item.color) }
            var season by remember { mutableStateOf(item.season) }
            var comfort by remember { mutableStateOf(item.comfortLevel.toString()) }
            var brand by remember { mutableStateOf(item.brand.orEmpty()) }
            var imageUrl by remember { mutableStateOf(item.imageUrl.orEmpty()) }
            var cameraMessage by remember { mutableStateOf<String?>(null) }

            val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
                if (bitmap == null) {
                    cameraMessage = "Camera capture cancelled"
                    return@rememberLauncherForActivityResult
                }
                val bytes = bitmapToJpegBytes(bitmap)
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
                val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                val extension = when (mimeType) {
                    "image/png" -> ".png"
                    "image/webp" -> ".webp"
                    else -> ".jpg"
                }
                val fileName = "item_${System.currentTimeMillis()}$extension"
                viewModel.uploadImage(bytes = bytes, fileName = fileName, mimeType = mimeType)
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
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {

                    SectionHeader(
                        title = "Edit Item",
                        subtitle = "Update details and replace image if needed"
                    )

                    OutlinedTextField(
                        value = category,
                        onValueChange = { category = it },
                        label = { Text("Category") },
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
                        label = { Text("Comfort Level") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = brand,
                        onValueChange = { brand = it },
                        label = { Text("Brand") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = { picker.launch("image/*") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Pick New Image")
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
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

                    if (imageUrl.isNotBlank()) {
                        Text(
                            text = "Image: $imageUrl",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        RemoteImagePreview(
                            imageUrl = imageUrl,
                            contentDescription = "Current image",
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 6.dp)
                                .height(180.dp)
                        )
                    }

                    if (imageUploadState is UiState.Loading) {
                        CircularProgressIndicator()
                    }
                    if (imageUploadState is UiState.Error) {
                        Text(
                            text = (imageUploadState as UiState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    cameraMessage?.let {
                        Text(
                            text = it,
                            color = MaterialTheme.colorScheme.error
                        )
                    }

                    Button(
                        onClick = {
                            viewModel.updateItem(
                                item.copy(
                                    category = category,
                                    color = color,
                                    season = season,
                                    comfortLevel = comfort.toIntOrNull() ?: 3,
                                    brand = brand.takeIf { it.isNotBlank() },
                                    imageUrl = imageUrl.takeIf { it.isNotBlank() }
                                )
                            )
                            navController.popBackStack()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Changes")
                    }
                }
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
