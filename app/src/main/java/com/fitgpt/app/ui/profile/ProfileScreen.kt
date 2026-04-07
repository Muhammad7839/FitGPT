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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.ui.common.MAX_LOCAL_IMAGE_BYTES
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.ui.common.FormOptionCatalog
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SelectableField
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.isImagePayloadAllowed
import com.fitgpt.app.viewmodel.ProfileViewModel
import com.fitgpt.app.viewmodel.UiState
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val UPLOAD_LOG_TAG = "FitGPTUpload"

@Composable
fun ProfileScreen(
    navController: NavController,
    viewModel: ProfileViewModel
) {
    val state by viewModel.profileState.collectAsState()
    val avatarUploadState by viewModel.avatarUploadState.collectAsState()
    val profileSaveState by viewModel.profileSaveState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val preferencesManager = remember(context) { PreferencesManager(context) }
    val storedSkinTone by preferencesManager.profileSkinTone.collectAsState(initial = "")
    val storedHairColor by preferencesManager.profileHairColor.collectAsState(initial = "")
    val snackbarHostState = remember { SnackbarHostState() }
    var avatarError by remember { mutableStateOf<String?>(null) }

    val avatarPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        viewModel.clearAvatarUploadState()
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

    LaunchedEffect(avatarUploadState) {
        val state = avatarUploadState
        if (state is UiState.Success && !state.data.isNullOrBlank()) {
            delay(2200)
            viewModel.clearAvatarUploadState()
        }
    }

    LaunchedEffect(profileSaveState) {
        when (val saveState = profileSaveState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                snackbarHostState.showSnackbar(saveState.message)
                viewModel.clearProfileSaveState()
            }
            is UiState.Success -> {
                if (saveState.data == true) {
                    snackbarHostState.showSnackbar("Profile saved successfully")
                    viewModel.clearProfileSaveState()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        TopLevelReselectBus.events.collectLatest { route ->
            if (route == Routes.PROFILE) {
                viewModel.refresh()
            }
        }
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.PROFILE,
        title = "Profile",
        showMoreAction = false,
        snackbarHost = { SnackbarHost(snackbarHostState) }
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
                var bodyType by remember(profile.idHash()) { mutableStateOf(profile.bodyType.toUiSelection()) }
                var bodyTypeCustom by remember(profile.idHash()) { mutableStateOf(profile.bodyType.customValueFallback()) }
                var lifestyle by remember(profile.idHash()) { mutableStateOf(profile.lifestyle.toUiSelection()) }
                var lifestyleCustom by remember(profile.idHash()) { mutableStateOf(profile.lifestyle.customValueFallback()) }
                var comfort by remember(profile.idHash()) { mutableStateOf(profile.comfortPreference.toUiSelection()) }
                var comfortCustom by remember(profile.idHash()) { mutableStateOf(profile.comfortPreference.customValueFallback()) }
                var skinTone by remember(profile.idHash(), storedSkinTone) { mutableStateOf(storedSkinTone.toUiSelection()) }
                var skinToneCustom by remember(profile.idHash(), storedSkinTone) { mutableStateOf(storedSkinTone.customValueFallback()) }
                var hairColor by remember(profile.idHash(), storedHairColor) { mutableStateOf(storedHairColor.toUiSelection()) }
                var hairColorCustom by remember(profile.idHash(), storedHairColor) { mutableStateOf(storedHairColor.customValueFallback()) }
                val isSavingProfile = profileSaveState is UiState.Loading

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                        .verticalScroll(rememberScrollState()),
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
                            SelectableField(
                                label = "Body Type",
                                selectedValue = bodyType,
                                onValueChange = { bodyType = it },
                                options = FormOptionCatalog.profileBodyTypes,
                                customValue = bodyTypeCustom,
                                onCustomValueChange = { bodyTypeCustom = it }
                            )
                            SelectableField(
                                label = "Lifestyle",
                                selectedValue = lifestyle,
                                onValueChange = { lifestyle = it },
                                options = FormOptionCatalog.profileLifestyle,
                                customValue = lifestyleCustom,
                                onCustomValueChange = { lifestyleCustom = it }
                            )
                            SelectableField(
                                label = "Comfort Preference",
                                selectedValue = comfort,
                                onValueChange = { comfort = it },
                                options = FormOptionCatalog.profileComfortPreference,
                                customValue = comfortCustom,
                                onCustomValueChange = { comfortCustom = it }
                            )
                            SelectableField(
                                label = "Skin Tone",
                                selectedValue = skinTone,
                                onValueChange = { skinTone = it },
                                options = FormOptionCatalog.skinToneOptions,
                                customValue = skinToneCustom,
                                onCustomValueChange = { skinToneCustom = it }
                            )
                            SelectableField(
                                label = "Hair Color",
                                selectedValue = hairColor,
                                onValueChange = { hairColor = it },
                                options = FormOptionCatalog.hairColorOptions,
                                customValue = hairColorCustom,
                                onCustomValueChange = { hairColorCustom = it }
                            )

                            Button(
                                onClick = {
                                    val resolvedBodyType = bodyType.resolveSelectedValue(bodyTypeCustom)
                                    val resolvedLifestyle = lifestyle.resolveSelectedValue(lifestyleCustom)
                                    val resolvedComfort = comfort.resolveSelectedValue(comfortCustom)
                                    val resolvedSkinTone = skinTone.resolveSelectedValue(skinToneCustom)
                                    val resolvedHairColor = hairColor.resolveSelectedValue(hairColorCustom)

                                    viewModel.updateProfile(
                                        bodyType = resolvedBodyType.toBackendProfileValue(),
                                        lifestyle = resolvedLifestyle.toBackendProfileValue(),
                                        comfortPreference = resolvedComfort.toBackendProfileValue(),
                                        onboardingComplete = profile.onboardingComplete
                                    )
                                    scope.launch {
                                        preferencesManager.setLocalProfileDetails(
                                            skinTone = resolvedSkinTone.orEmpty(),
                                            hairColor = resolvedHairColor.orEmpty()
                                        )
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !isSavingProfile
                            ) {
                                if (isSavingProfile) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.width(18.dp).height(18.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Saving...")
                                    }
                                } else {
                                    Text("Save Profile")
                                }
                            }
                            Text(
                                text = "Profile photo upload and profile details are saved separately.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
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

private fun String.resolveSelectedValue(customValue: String): String {
    val normalized = trim()
    if (normalized.equals(FormOptionCatalog.OTHER_OPTION, ignoreCase = true)) {
        return customValue.trim().ifEmpty { "unspecified" }
    }
    return normalized.ifEmpty { "unspecified" }
}

private fun String.toUiSelection(): String {
    val normalized = trim()
    if (normalized.isBlank()) return FormOptionCatalog.OTHER_OPTION
    return normalized.split("_", " ")
        .joinToString(" ") { token ->
            token.replaceFirstChar { it.uppercase() }
        }
}

private fun String.customValueFallback(): String {
    val normalized = trim()
    if (normalized.isBlank()) return ""
    val knownValues = setOf(
        "athletic", "slim", "regular", "curvy", "plus-size",
        "casual", "active", "professional", "streetwear", "minimal",
        "low", "medium", "high", "fair", "light", "tan", "deep",
        "black", "brown", "blonde", "red", "gray"
    )
    return if (knownValues.contains(normalized.lowercase())) "" else normalized
}

private fun String.toBackendProfileValue(): String {
    return trim().lowercase().replace(" ", "_").ifEmpty { "unspecified" }
}
