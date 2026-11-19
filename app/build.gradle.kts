plugins {
    id("com.android.application")
}

// Version: aus -PappVersion=1.2.0 (CI setzt das aus dem Git-Tag) oder gradle.properties
val appVersion = (findProperty("appVersion") as String?) ?: "1.1.0"
val appVersionCode = appVersion.split(".", "-").map { p -> p.filter(Char::isDigit).toIntOrNull() ?: 0 }
    .plus(listOf(0, 0, 0)).let { it[0] * 10000 + it[1] * 100 + it[2] }

// GitHub-Repo für den Update-Check, z. B. "max/life-counter" (CI setzt es automatisch)
val updateRepo = (findProperty("updateRepo") as String?) ?: "DEIN_USER/life-counter"

// Fester Release-Schlüssel – nötig, damit Updates über die installierte App installiert werden können.
fun secret(name: String): String? = System.getenv(name) ?: (findProperty(name) as String?)
val keystorePath = secret("LC_KEYSTORE")

android {
    namespace = "de.lifecounter.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.lifecounter.app"
        minSdk = 34          // Android 14
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersion
        resValue("string", "update_repo", updateRepo)
    }

    buildFeatures {
        resValues = true
    }

    signingConfigs {
        create("release") {
            if (keystorePath != null && file(keystorePath).exists()) {
                storeFile = file(keystorePath)
                storeType = "pkcs12"   // per openssl erzeugt; liest dank Java-Kompatibilität auch .jks
                storePassword = secret("LC_KEYSTORE_PASSWORD")
                keyAlias = secret("LC_KEY_ALIAS")
                keyPassword = secret("LC_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            val rel = signingConfigs.getByName("release")
            // Ohne eigenen Schlüssel: Debug-Key (installierbar, aber Updates von CI-Builds passen dann nicht drüber)
            signingConfig = if (rel.storeFile != null) rel else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
