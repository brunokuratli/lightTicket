/*
 * Build config for the SBB Light `:tool` module.
 *
 * This mirrors the light-sdk `:tool` scaffold: the module applies the Android
 * + Kotlin/Compose plugins and depends on the SDK client library. Versions and
 * the exact plugin ids come from your light-sdk fork's version catalog — align
 * this file with `examples/authenticator/build.gradle.kts` after cloning.
 *
 * Deliberately dependency-light: networking uses java.net.HttpURLConnection and
 * JSON uses android's bundled org.json, so we avoid third-party libraries that
 * the SDK restricts. Only Compose + Coroutines are used, both recommended.
 */
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.lightticket.sbb"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.lightticket.sbb"
        minSdk = 30
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        compose = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // The Light SDK client library — provides LightOS primitives and the host.
    implementation(project(":sdk:client"))

    // Recommended stack per the SDK docs.
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.compose.ui:ui:1.7.3")
    implementation("androidx.compose.foundation:foundation:1.7.3")
    implementation("androidx.compose.material3:material3:1.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
