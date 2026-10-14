plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp.library)
    `maven-publish`
}

kotlin {
    android {
        namespace = "com.glsnxt.designtokens"
        compileSdk = 37
        minSdk = 24
    }
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            // api: Color is part of the public surface.
            api(libs.compose.ui.graphics)
        }
    }
}

publishing {
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/gls-nxt/design-tokens")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
