/**
 * Profile page for account identity and preference management, separated from app settings.
 */
package com.fitgpt.app.ui.profile

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.ui.common.MAX_LOCAL_IMAGE_BYTES
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.isImagePayloadAllowed
import com.fitgpt.app.viewmodel.ProfileViewModel
import com.fitgpt.app.viewmodel.UiState

private const val UPLOAD_LOG_TAG = "FitGPTUpload"

@Composable
fun ProfileScreen(
    navController: NavController,
    viewModel: ProfileViewModel
) {
    val state by viewModel.profileState.collectAsState()
    val avatarUploadState by viewModel.avatarUploadState.collectAsState()
    val context = LocalContext.current
    var avatarError by remember { mutableStateOf<String?>(null) }

    val avatarPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val bytes = readBytes(context, uri)
        if (bytes == null) {
            avatarError = "Unable to read selected image"
            return@rememberLauncherForActivityResult
        }
        if (!isImagePayloadAllowed(bytes.size)) {
            avatarError = "Image is too large (max ${MAX_LOCAL_IMAGE_BYTES / (1024 * 1024)}MB)"
            Log.w(UPLOAD_LOG_TAG, "avatar image rejected size=${bytes.size}")
            return@rememberLauncherForActivityResult
        }
        avatarError = null
        val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
        val extension = when (mimeType) {
            "image/png" -> ".png"
            "image/webp" -> ".webp"
            else -> ".jpg"
        }
        val fileName = "avatar_${System.currentTimeMillis()}$extension"
        Log.i(UPLOAD_LOG_TAG, "avatar upload start mime=$mimeType size=${bytes.size}")
        viewModel.uploadAvatar(bytes = bytes, fileName = fileName, mimeType = mimeType)
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.PROFILE,
        title = "Profile"
    ) { padding ->
        when (val currentState = state) {
            UiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(horizontal = 24.dp))
                }
            }

            is UiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(currentState.message, color = MaterialTheme.colorScheme.error)
                    Button(onClick = { viewModel.refresh() }) {
                        Text("Retry")
                    }
                }
            }

            is UiState.Success -> {
                val profile = currentState.data
                var bodyType by remember(profile.idHash()) { mutableStateOf(profile.bodyType) }
                var lifestyle by remember(profile.idHash()) { mutableStateOf(profile.lifestyle) }
                var comfort by remember(profile.idHash()) { mutableStateOf(profile.comfortPreference) }
                var onboardingComplete by remember(profile.idHash()) { mutableStateOf(profile.onboardingComplete) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SectionHeader(
                        title = "Profile",
                        subtitle = "Manage your account and saved preferences."
                    )

                    WebCard(
                        modifier = Modifier.fillMaxWidth(),
                        accentTop = false
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Account", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = profile.email,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            RemoteImagePreview(
                                imageUrl = profile.avatarUrl,
                                contentDescription = "Profile avatar",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                            )
                            Button(
                                onClick = { avatarPickerLauncher.launch("image/*") },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Upload Photo")
                            }
                            when (val uploadState = avatarUploadState) {
                                UiState.Loading -> CircularProgressIndicator()
                                is UiState.Error -> Text(
                                    text = uploadState.message,
                                    color = MaterialTheme.colorScheme.error
                                )
                                is UiState.Success -> if (!uploadState.data.isNullOrBlank()) {
                                    Text(
                                        text = "Photo saved",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            avatarError?.let {
                                Text(
                                    text = it,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }

                    WebCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Profile preferences", style = MaterialTheme.typography.titleMedium)

                            OutlinedTextField(
                                value = bodyType,
                                onValueChange = { bodyType = it },
                                label = { Text("Body Type") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = lifestyle,
                                onValueChange = { lifestyle = it },
                                label = { Text("Lifestyle") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = comfort,
                                onValueChange = { comfort = it },
                                label = { Text("Comfort Preference") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Onboarding Complete")
                                Switch(
                                    checked = onboardingComplete,
                                    onCheckedChange = { onboardingComplete = it }
                                )
                            }

                            Button(
                                onClick = {
                                    viewModel.updateProfile(
                                        bodyType = bodyType,
                                        lifestyle = lifestyle,
                                        comfortPreference = comfort,
                                        onboardingComplete = onboardingComplete
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Save Profile")
                            }
                        }
                    }

                    WebCard(
                        modifier = Modifier.fillMaxWidth(),
                        accentTop = false
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("Profile Summary", style = MaterialTheme.typography.titleMedium)
                            Text("Wardrobe items: ${profile.wardrobeCount}")
                            Text("Active items: ${profile.activeWardrobeCount}")
                            Text("Favorites: ${profile.favoriteCount}")
                            Text("Saved outfits: ${profile.savedOutfitCount}")
                            Text("Planned outfits: ${profile.plannedOutfitCount}")
                            Text("History entries: ${profile.historyCount}")
                        }
                    }
                }
            }
        }
    }
}

private fun readBytes(context: Context, uri: Uri): ByteArray? {
    return context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
}

private fun com.fitgpt.app.data.model.UserProfile.idHash(): String {
    return "${id}_${email}_${avatarUrl}_${bodyType}_${lifestyle}_${comfortPreference}_${onboardingComplete}"
}
