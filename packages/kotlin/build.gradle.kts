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
            // api: Color, Dp, TextUnit and FontWeight are part of the public surface.
            api(libs.compose.ui.graphics)
            api(libs.compose.ui.text)
            api(libs.compose.ui.unit)
        }
    }
}

publishing {
    publications.withType<MavenPublication>().configureEach {
        pom {
            name = "Unity Design System tokens"
            description = "Unity Design System tokens as Compose values for Kotlin Multiplatform."
            url = "https://github.com/gls-nxt/design-tokens"
            licenses {
                license {
                    name = "MIT License"
                    url = "https://opensource.org/license/mit"
                }
            }
            scm {
                url = "https://github.com/gls-nxt/design-tokens"
                connection = "scm:git:https://github.com/gls-nxt/design-tokens.git"
            }
        }
    }
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
