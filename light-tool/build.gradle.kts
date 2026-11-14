/*
 * Build-Skript des `:tool`-Moduls von SBB Light.
 *
 * Diese Datei ersetzt im light-sdk-Checkout `tool/build.gradle.kts` (siehe
 * light-tool/ci/prepare.sh). Sie folgt dem `tool/`-Gerüst und
 * `examples/weather` des gepinnten light-sdk-Stands:
 *  - Plugins und Versionen kommen aus dem Version-Catalog des light-sdk
 *    (`gradle/libs.versions.toml`); nur Plugins aus der SDK-Allowlist.
 *  - applicationId, namespace, versionCode und versionName stehen NICHT hier,
 *    sondern in `lighttool.toml` (das SDK-Plugin verbietet sie hier).
 *  - Abhängigkeiten nur aus der SDK-Allowlist
 *    (plugin/src/main/resources/com/thelightphone/plugin/allowed-dependencies.txt).
 *
 * Netzwerk über java.net.HttpURLConnection, JSON über das in Android
 * enthaltene org.json; keine Fremdbibliotheken.
 */
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    // KSP + light-sdk-Plugin: erzeugen die LightSdkRegistry (@InitialScreen,
    // @EntryPoint) und das Manifest aus lighttool.toml.
    alias(libs.plugins.ksp)
    alias(libs.plugins.light.sdk)
}

android {
    compileSdk = rootProject.ext["compileSdk"] as Int

    signingConfigs {
        // Öffentlicher Entwicklungs-Schlüssel, der im light-sdk liegt
        // (sdk/keys/lightsdk-dev.jks, Passwort "android"). Kein Geheimnis;
        // Light signiert veröffentlichte Tools selbst.
        create("lightsdkDev") {
            storeFile = file("../sdk/keys/lightsdk-dev.jks")
            storePassword = "android"
            keyAlias = "lightsdk-dev"
            keyPassword = "android"
            enableV3Signing = true
            enableV4Signing = true
        }
    }

    defaultConfig {
        minSdk = rootProject.ext["minSdk"] as Int
        targetSdk = rootProject.ext["targetSdk"] as Int

        manifestPlaceholders["sdkVersion"] = property("sdkVersion") as String
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("lightsdkDev")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("lightsdkDev")
        }
    }

    lint {
        warningsAsErrors = false
        error += "RestrictedApi"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.toVersion(rootProject.ext["jvmTarget"] as String)
        targetCompatibility = JavaVersion.toVersion(rootProject.ext["jvmTarget"] as String)
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.fromTarget(rootProject.ext["jvmTarget"] as String))
    }
}

dependencies {
    // Light-SDK-Client: LightScreen, LightViewModel, lightContext (filesDir,
    // media), Berechtigungen. Bringt per `api` Compose (BOM, foundation,
    // material3), Lifecycle und Coroutines mit, darum keine weiteren Einträge.
    implementation(project(":sdk:client"))
    // QR/Aztec auf der Billett-Seite finden (nur Lage, kein Neuzeichnen);
    // com.google.zxing:core steht in der Allowlist des light-sdk.
    implementation(libs.zxing.core)

    testImplementation(libs.kotlin.test)
}
