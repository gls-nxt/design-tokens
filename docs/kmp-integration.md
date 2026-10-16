# Use the tokens in a KMP app

This guide sets up `com.glsnxt:design-tokens` in a Kotlin Multiplatform + Compose Multiplatform app, such as `gls-app-kmp`. It covers the repository, credentials, CI, theme wiring and testing unreleased tokens.

## What you get

| Kotlin | What it is | Example |
| --- | --- | --- |
| `PrimitiveColors` | Raw palette. Use the semantic colours instead. | `PrimitiveColors.Blue.Blue700` |
| `<Group>Colors` + `light…()` / `dark…()` | Semantic colours per mode | `lightSurfaceColors().selectionDefault` |
| `PrimitiveTokens` | Spacing, radius, sizes, font scale | `PrimitiveTokens.Spacing.Spacing4` |
| `MobileTypography` | One `TextStyle` per text style: size, line height, letter spacing | `MobileTypography.h1` |
| `MobileDimensions` | Mobile sizes that aren't text | `MobileDimensions.touchTargetMin` |
| `FontTokens` | Brand font names | `FontTokens.heading` |

The package only holds constants. It has no `@Composable` code, no `CompositionLocal` and no font files. The app owns the theme.

## 1. Add the repository

In `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://maven.pkg.github.com/gls-nxt/design-tokens") {
            credentials {
                username = providers.gradleProperty("gpr.user").orNull ?: System.getenv("GITHUB_ACTOR")
                password = providers.gradleProperty("gpr.key").orNull ?: System.getenv("GITHUB_TOKEN")
            }
            // Only our packages come from here, so other dependencies never wait on GitHub Packages.
            content { includeGroup("com.glsnxt") }
        }
    }
}
```

Never put a username or token in a build file. Build files are committed, and so is anything you write in them.

## 2. Set up credentials

GitHub Packages asks for a token even to read a package.

- **On your machine:** create a GitHub **classic** personal access token with the `read:packages` scope. Fine-grained tokens don't work with GitHub Packages. Then add it to `~/.gradle/gradle.properties`, which lives outside the repo:
  ```properties
  gpr.user=<your GitHub username>
  gpr.key=<the token>
  ```
  iOS developers need this too, because Xcode builds the shared Kotlin module.
- **In GitHub Actions:**
  1. In the `design-tokens` package settings, under **Manage Actions access**, give the app repository read access.
  2. In each workflow that runs Gradle, add:
     ```yaml
     permissions:
       contents: read
       packages: read
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
     ```
     `GITHUB_ACTOR` is set automatically.

## 3. Add the dependency

In the design system module's `commonMain`:

```kotlin
commonMain.dependencies {
    api("com.glsnxt:design-tokens:<version>")
}
```

Use `api` if other modules read the token types through the design system module. Otherwise use `implementation`.

**Kotlin version rule:** the library must be built with a Kotlin version that is the same as or older than the app's. A newer one can break iOS builds with an "incompatible ABI version" error. Today both use Kotlin 2.4.10. When the app upgrades Kotlin, the library can follow; never the other way round.

## 4. Wire it into the theme

The usual Compose design-system pattern is described in [Custom design systems in Compose](https://developer.android.com/develop/ui/compose/designsystems/custom) and [Anatomy of a theme](https://developer.android.com/develop/ui/compose/designsystems/anatomy):

- `@Immutable` classes for colours, typography and dimensions;
- a `staticCompositionLocalOf` for each, provided once in `AppTheme`;
- `MaterialTheme` wrapped inside, with your colours and typography mapped into its `ColorScheme` and `Typography`, so stock Material 3 components match your brand.

`gls-app-kmp` already works this way: `AppTheme` provides `LocalAppColors`, `LocalAppTypography` and `LocalAppDimensions`, and components read them through `colorsScheme()`, `typography()` and `dimensions()`. **Keep that layer, and only change where its values come from.** Then the screens using it don't change.

### Colours

The app has its own `lightSurfaceColors()`, `darkSurfaceColors()` and so on, with hardcoded hex values. They have the same names as the library's functions, so import the library's under an alias and fill the app's colour scheme from them:

```kotlin
import com.glsnxt.designtokens.color.lightSurfaceColors as tokenLightSurface
import com.glsnxt.designtokens.color.darkSurfaceColors as tokenDarkSurface
```

Move one group at a time (surface, text, border, icon), and check the screens after each.

### Typography

`MobileTypography` gives size, line height and letter spacing. The font files are bundled in the app (`composeResources/font/`), so add the family and weight there:

```kotlin
@Composable
fun glsTypography(): GLSTypography {
    val newson = NewsonGLSDTP()
    fun TextStyle.withFont(weight: FontWeight) = merge(TextStyle(fontFamily = newson, fontWeight = weight))
    return GLSTypography(
        h1 = MobileTypography.h1.withFont(FontWeight.Bold),
        bodyMd = MobileTypography.bodyMd.withFont(FontWeight.Normal),
        labelSm = MobileTypography.labelSm.withFont(FontWeight.Medium),
        // …
    )
}
```

Pass whole `TextStyle`s around (`Text(style = …)`) rather than separate sizes. That way size and line height always stay matched.

### Spacing and sizes

Point the app's dimension set at `PrimitiveTokens.Spacing.*`, `PrimitiveTokens.Radius.*` and `MobileDimensions.*`. Use `MobileDimensions.touchTargetMin` for the minimum size of anything tappable.

### Dark mode

The library has both modes. To turn dark mode on, choose `dark…()` when `isSystemInDarkTheme()` is true. Do it once, in `AppTheme`.

## 5. Tablets later

Figma has no tablet text sizes yet, so Kotlin only gets mobile. Once it does, the build can add a tablet set next to the mobile one. `AppTheme` would then pick between them once, with [`currentWindowAdaptiveInfo().windowSizeClass`](https://kotlinlang.org/docs/multiplatform/compose-adaptive-layouts.html), and provide the result through the same `CompositionLocal`. Screens keep reading `typography().h1`.

## 6. Test unreleased tokens locally

To try a token change before it's released, build the library from a local checkout of this repo instead of downloading it:

1. In this repo, run `pnpm build` to generate the Kotlin sources.
2. In the app's `settings.gradle.kts`:
   ```kotlin
   val localTokens = file("local.properties").takeIf { it.exists() }
       ?.readLines()?.firstOrNull { it.startsWith("designTokens.path=") }?.substringAfter("=")
   if (localTokens != null) {
       includeBuild(localTokens) {
           dependencySubstitution { substitute(module("com.glsnxt:design-tokens")).using(project(":")) }
       }
   }
   ```
3. In the app's `local.properties`, which is not committed, add `designTokens.path=../design-tokens/packages/kotlin`.

Remove the line to go back to the published version. CI never sets it, so CI always uses the published package.

## Links

- [Custom design systems in Compose](https://developer.android.com/develop/ui/compose/designsystems/custom)
- [Anatomy of a theme in Compose](https://developer.android.com/develop/ui/compose/designsystems/anatomy)
- [Adaptive layouts in Compose Multiplatform](https://kotlinlang.org/docs/multiplatform/compose-adaptive-layouts.html)
- [Working with the Gradle registry (GitHub Packages)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-gradle-registry)
- [Kotlin evolution and compatibility](https://kotlinlang.org/docs/kotlin-evolution-principles.html)
