/**
 * Profile page for account identity, onboarding preferences, and wardrobe summary.
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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.ui.common.FormOptionCatalog
import com.fitgpt.app.ui.common.MAX_LOCAL_IMAGE_BYTES
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SelectableField
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.isImagePayloadAllowed
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.viewmodel.ProfileViewModel
import com.fitgpt.app.viewmodel.UiState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
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
        val uploadState = avatarUploadState
        if (uploadState is UiState.Success && !uploadState.data.isNullOrBlank()) {
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
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator()
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
                var bodyTypeSelection by remember(profile.profileKey()) {
                    mutableStateOf(bodyTypeIdToLabel(profile.bodyType))
                }
                var genderSelection by remember(profile.profileKey()) {
                    mutableStateOf(genderValueToLabel(profile.gender))
                }
                var heightCm by remember(profile.profileKey()) {
                    mutableStateOf(profile.heightCm?.toString().orEmpty())
                }
                var stylePreferences by remember(profile.profileKey()) {
                    mutableStateOf(profile.stylePreferences)
                }
                var comfortPreferences by remember(profile.profileKey()) {
                    mutableStateOf(profile.comfortPreferences)
                }
                var dressFor by remember(profile.profileKey()) {
                    mutableStateOf(profile.dressFor)
                }
                var skinTone by remember(profile.profileKey(), storedSkinTone) {
                    mutableStateOf(storedSkinTone.toUiSelection())
                }
                var skinToneCustom by remember(profile.profileKey(), storedSkinTone) {
                    mutableStateOf(storedSkinTone.customValueFallback())
                }
                var hairColor by remember(profile.profileKey(), storedHairColor) {
                    mutableStateOf(storedHairColor.toUiSelection())
                }
                var hairColorCustom by remember(profile.profileKey(), storedHairColor) {
                    mutableStateOf(storedHairColor.customValueFallback())
                }
                val isSavingProfile = profileSaveState is UiState.Loading

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionHeader(
                        title = "Profile",
                        subtitle = "Manage your account, fit profile, and style preferences."
                    )

                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Account", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = profile.email,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "Profile photo",
                                style = MaterialTheme.typography.titleSmall
                            )
                            RemoteImagePreview(
                                imageUrl = profile.avatarUrl,
                                contentDescription = "Profile avatar",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(170.dp)
                            )
                            Button(
                                onClick = { avatarPickerLauncher.launch("image/*") },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Upload profile photo")
                            }
                            Text(
                                text = "This image identifies your account only. Outfit try-on and styling previews stay separate.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            when (val uploadState = avatarUploadState) {
                                UiState.Loading -> CircularProgressIndicator()
                                is UiState.Error -> Text(
                                    text = uploadState.message,
                                    color = MaterialTheme.colorScheme.error
                                )
                                is UiState.Success -> if (!uploadState.data.isNullOrBlank()) {
                                    Text(
                                        text = "Avatar saved",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            avatarError?.let {
                                Text(text = it, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    WebCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Fit profile", style = MaterialTheme.typography.titleMedium)
                            SelectableField(
                                label = "Body type",
                                selectedValue = bodyTypeSelection,
                                onValueChange = { bodyTypeSelection = it },
                                options = FormOptionCatalog.onboardingBodyTypes.map { it.label }
                            )
                            SelectableField(
                                label = "Gender",
                                selectedValue = genderSelection,
                                onValueChange = { genderSelection = it },
                                options = FormOptionCatalog.onboardingGenderOptions.map { it.label }
                            )
                            OutlinedTextField(
                                value = heightCm,
                                onValueChange = { heightCm = it.filter(Char::isDigit).take(3) },
                                label = { Text("Height in centimeters") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                        }
                    }

                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Style preferences", style = MaterialTheme.typography.titleMedium)
                            PreferenceChipSection(
                                title = "Style",
                                options = FormOptionCatalog.onboardingStyleOptions,
                                selected = stylePreferences,
                                onToggle = { option -> stylePreferences = stylePreferences.toggle(option) }
                            )
                            PreferenceChipSection(
                                title = "Comfort",
                                options = FormOptionCatalog.onboardingComfortOptions,
                                selected = comfortPreferences,
                                onToggle = { option -> comfortPreferences = comfortPreferences.toggle(option) }
                            )
                            PreferenceChipSection(
                                title = "Dressing for",
                                options = FormOptionCatalog.onboardingDressForOptions,
                                selected = dressFor,
                                onToggle = { option -> dressFor = dressFor.toggle(option) }
                            )
                        }
                    }

                    Button(
                        onClick = {
                            val resolvedSkinTone = skinTone.resolveSelectedValue(skinToneCustom)
                            val resolvedHairColor = hairColor.resolveSelectedValue(hairColorCustom)
                            viewModel.updateProfile(
                                bodyType = bodyTypeLabelToId(bodyTypeSelection),
                                stylePreferences = stylePreferences,
                                comfortPreferences = comfortPreferences,
                                dressFor = dressFor,
                                gender = genderLabelToValue(genderSelection),
                                heightCm = heightCm.toIntOrNull(),
                                onboardingComplete = true
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
                            Row(verticalAlignment = Alignment.CenterVertically) {
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

                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Summary", style = MaterialTheme.typography.titleMedium)
                            SummaryMetric("Wardrobe items", profile.wardrobeCount.toString())
                            SummaryMetric("Active items", profile.activeWardrobeCount.toString())
                            SummaryMetric("Favorites", profile.favoriteCount.toString())
                            SummaryMetric("Saved outfits", profile.savedOutfitCount.toString())
                            SummaryMetric("Planned outfits", profile.plannedOutfitCount.toString())
                            SummaryMetric("History entries", profile.historyCount.toString())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PreferenceChipSection(
    title: String,
    options: List<String>,
    selected: List<String>,
    onToggle: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
        options.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { option ->
                    FilterChip(
                        selected = selected.contains(option),
                        onClick = { onToggle(option) },
                        label = { Text(option) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SummaryMetric(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
    }
}

private fun readBytes(context: Context, uri: Uri): ByteArray? {
    return context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
}

private fun com.fitgpt.app.data.model.UserProfile.profileKey(): String {
    return buildString {
        append(id)
        append('_').append(email)
        append('_').append(avatarUrl)
        append('_').append(bodyType)
        append('_').append(comfortPreference)
        append('_').append(stylePreferences.joinToString("|"))
        append('_').append(comfortPreferences.joinToString("|"))
        append('_').append(dressFor.joinToString("|"))
        append('_').append(gender)
        append('_').append(heightCm)
        append('_').append(onboardingComplete)
    }
}

private fun List<String>.toggle(option: String): List<String> {
    return if (contains(option)) filterNot { it == option } else this + option
}

private fun String.resolveSelectedValue(customValue: String): String? {
    val normalized = trim()
    if (normalized.isBlank()) return null
    if (normalized.equals(FormOptionCatalog.OTHER_OPTION, ignoreCase = true)) {
        return customValue.trim().ifBlank { return null }
    }
    return normalized
}

private fun String.toUiSelection(): String {
    val normalized = trim()
    if (normalized.isBlank()) return FormOptionCatalog.OTHER_OPTION
    return normalized.split("_", " ")
        .joinToString(" ") { token -> token.replaceFirstChar { it.uppercase() } }
}

private fun String.customValueFallback(): String {
    val normalized = trim()
    if (normalized.isBlank()) return ""
    val knownValues = setOf(
        "fair", "light", "medium", "tan", "deep",
        "black", "brown", "blonde", "red", "gray"
    )
    return if (knownValues.contains(normalized.lowercase())) "" else normalized
}

private fun bodyTypeIdToLabel(bodyType: String): String {
    return FormOptionCatalog.onboardingBodyTypes
        .firstOrNull { it.id.equals(bodyType.trim(), ignoreCase = true) }
        ?.label
        ?: ""
}

private fun bodyTypeLabelToId(label: String): String {
    return FormOptionCatalog.onboardingBodyTypes
        .firstOrNull { it.label.equals(label.trim(), ignoreCase = true) }
        ?.id
        ?: "unspecified"
}

private fun genderValueToLabel(gender: String?): String {
    return FormOptionCatalog.onboardingGenderOptions
        .firstOrNull { it.value.equals(gender.orEmpty().trim(), ignoreCase = true) }
        ?.label
        ?: "Prefer not to say"
}

private fun genderLabelToValue(label: String): String? {
    return FormOptionCatalog.onboardingGenderOptions
        .firstOrNull { it.label.equals(label.trim(), ignoreCase = true) }
        ?.value
        ?.takeIf { it.isNotBlank() }
}
