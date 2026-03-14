import java.io.ByteArrayOutputStream
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}


android {
    namespace = "com.fitgpt.app"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "com.fitgpt.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        val googleWebClientId = project.findProperty("GOOGLE_WEB_CLIENT_ID") as String? ?: ""
        val apiBaseUrlRaw = project.findProperty("API_BASE_URL") as String? ?: "http://10.0.2.2:8000/"
        val apiBaseUrl = if (apiBaseUrlRaw.endsWith("/")) apiBaseUrlRaw else "$apiBaseUrlRaw/"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    testImplementation(libs.junit)
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    implementation(libs.androidx.navigation.compose)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}

tasks.register("setupAdbReverseDebug") {
    group = "fitgpt"
    description = "Best-effort adb reverse setup for backend port 8000 on debug runs."
    doLast {
        val osName = System.getProperty("os.name").lowercase()
        val adbExecutable = if (osName.contains("win")) "adb.exe" else "adb"
        val localPropertiesSdkRoot = rootProject.file("local.properties")
            .takeIf { it.exists() }
            ?.readLines()
            ?.firstOrNull { it.startsWith("sdk.dir=") }
            ?.substringAfter("sdk.dir=")
            ?.replace("\\:", ":")
            ?.replace("\\\\", "\\")

        val sdkRootCandidates = listOf(
            localPropertiesSdkRoot,
            System.getenv("ANDROID_HOME"),
            System.getenv("ANDROID_SDK_ROOT"),
            System.getenv("ANDROID_SDK_HOME")
        ).filterNotNull()

        val adbFromSdk = sdkRootCandidates
            .map { File(it, "platform-tools/$adbExecutable") }
            .firstOrNull { it.exists() && it.canExecute() }

        val adbCommand = adbFromSdk?.absolutePath ?: adbExecutable

        fun runCommand(args: List<String>, capture: ByteArrayOutputStream? = null): Boolean {
            return try {
                val process = ProcessBuilder(args)
                    .redirectErrorStream(true)
                    .start()
                val bytes = process.inputStream.readBytes()
                capture?.write(bytes)
                process.waitFor()
                true
            } catch (_: Exception) {
                false
            }
        }

        fun runAdbReverse(adb: String, serial: String): Boolean {
            return try {
                val process = ProcessBuilder(
                    adb,
                    "-s",
                    serial,
                    "reverse",
                    "tcp:8000",
                    "tcp:8000"
                )
                    .redirectErrorStream(true)
                    .start()
                process.waitFor()
                true
            } catch (_: Exception) {
                false
            }
        }

        val devicesOutput = ByteArrayOutputStream()
        val devicesOk = runCommand(listOf(adbCommand, "devices"), capture = devicesOutput)
        if (!devicesOk) {
            logger.lifecycle("setupAdbReverseDebug: adb not available; skipping reverse setup.")
            return@doLast
        }

        val serials = devicesOutput.toString()
            .lineSequence()
            .map { it.trim() }
            .filter { it.endsWith("\tdevice") }
            .map { it.substringBefore('\t') }
            .toList()

        if (serials.isEmpty()) {
            logger.lifecycle("setupAdbReverseDebug: no connected devices found.")
            return@doLast
        }

        serials.forEach { serial ->
            runAdbReverse(adbCommand, serial)
        }
        logger.lifecycle("setupAdbReverseDebug: applied tcp:8000 reverse to ${serials.size} device(s).")
    }
}

tasks.matching { task ->
    task.name.startsWith("install") && task.name.endsWith("Debug")
}.configureEach {
    dependsOn("setupAdbReverseDebug")
}
