# Design tokens

Unity Design System tokens from one source, published as native packages for the web and Kotlin Multiplatform (KMP).

- **Source:** W3C Design Tokens (DTCG) JSON in `tokens/`.
- **Compiler:** Style Dictionary, run by `build.mjs`.
- **Output:** CSS variables for the web, Compose `Color` code for KMP.

Neither platform parses JSON at runtime, and Kotlin developers never need Node.

The current scope is colour tokens in light and dark mode.

## Packages

| Platform | Package | Contents |
| --- | --- | --- |
| Web | `@gls-nxt/design-tokens` (npm) | `tokens.css` |
| KMP | `com.glsnxt:design-tokens` (Maven) | `PrimitiveColors`, plus `<Group>Colors` data classes with `light…()` and `dark…()` factories |

Both packages are published to GitHub Packages and share one version.

## Use on the web

1. **Authenticate npm with GitHub Packages.** Add this `.npmrc` to your project:
   ```
   @gls-nxt:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```
   The token needs the `read:packages` scope.
2. **Install the package:** `npm install @gls-nxt/design-tokens`.
3. **Load the CSS once:**
   ```css
   @import '@gls-nxt/design-tokens/tokens.css';

   .button { background: var(--unity-surface-selection-default); }
   ```
   Dark mode follows the OS setting. To force a mode, set `data-theme="dark"` or `data-theme="light"` on `<html>`.

Use the CSS variables only. The package has no JavaScript or TypeScript exports, so components can't hard-code a colour value that ignores the active mode.

## Use in KMP

1. **Add the repository** in `settings.gradle.kts`:
   ```kotlin
   dependencyResolutionManagement {
       repositories {
           maven("https://maven.pkg.github.com/gls-nxt/design-tokens") {
               credentials {
                   username = providers.gradleProperty("gpr.user").orNull ?: System.getenv("GITHUB_ACTOR")
                   password = providers.gradleProperty("gpr.key").orNull ?: System.getenv("GITHUB_TOKEN")
               }
           }
       }
   }
   ```
   - **Locally:** put `gpr.user` and `gpr.key` (a token with `read:packages`) in `~/.gradle/gradle.properties`.
   - **In CI:** use `GITHUB_TOKEN`, and give the consuming repo read access in the package settings.
2. **Add the dependency** to commonMain: `implementation("com.glsnxt:design-tokens:<version>")`.
3. **Use the colours.** Choose the mode in your theme:
   ```kotlin
   val surface = if (isSystemInDarkTheme()) darkSurfaceColors() else lightSurfaceColors()
   Box(Modifier.background(surface.selectionDefault))
   ```

The library targets Android, `iosArm64` and `iosSimulatorArm64`. It is built with Kotlin 2.4.10, so consumers need Kotlin 2.4.10 or newer.

## Change tokens

1. **Edit the JSON in `tokens/`:**
   - `primitive/color.tokens.json` holds the raw hex values.
   - `semantic/color.light.tokens.json` and `color.dark.tokens.json` reference the primitives, as in `{blue.700}`.
2. **Run `pnpm install && pnpm build && pnpm test`.** To set up pnpm, see the [prerequisites in CONTRIBUTING.md](CONTRIBUTING.md#prerequisites).
3. **Commit `TOKENS.md` and `docs/swatches/` with your token change.** The build regenerates them, and CI fails if they're out of date.

[`TOKENS.md`](TOKENS.md) previews every token, light and dark, with its CSS and Kotlin names. On a pull request, CI posts a comment that lists each changed colour before and after.

The build fails in two cases:
- the light and dark files define different tokens;
- a generated name is not a valid identifier.

## Naming convention

Token path segments are lowercase kebab-case. Each platform derives its names from the full path:

| Token | CSS | Kotlin |
| --- | --- | --- |
| `blue.700` | `--unity-blue-700` | `PrimitiveColors.Blue.Blue700` |
| `surface.selection-default` | `--unity-surface-selection-default` | `SurfaceColors.selectionDefault` |
| `surface.base-1` | `--unity-surface-base-1` | `SurfaceColors.base1` |

Two rules apply:
- A semantic segment after the group must start with a letter. Use `text.size-2xl`, not `text.2xl`.
- No name may be a Kotlin keyword.

## Release

There are two ways to start a release. Both run the same `Release` workflow.

- **Bump from the UI or CLI.** In GitHub, open **Actions → Release → Run workflow** on `main`, pick `patch`, `minor` or `major`, and run it. From the terminal:
  ```sh
  gh workflow run release.yml -f bump=minor
  ```
  The workflow bumps the latest `vX.Y.Z` tag. With no tags yet, it starts from `v0.0.0`.
- **Push a tag yourself.** The tag is the version, and it must be `vMAJOR.MINOR.PATCH`:
  ```sh
  git tag v1.2.0 && git push origin v1.2.0
  ```

Either way, the workflow then:
1. builds and tests;
2. publishes both packages at that version;
3. creates the GitHub Release with generated notes. For a manual run, it also creates the tag at this step.

A renamed or removed token breaks consumers, so it needs a major version.

## Where the tokens come from

The tokens are exported from the Unity Design System Figma library:
- the **Primitives** collection;
- the **Theme** collection, with its Light and Dark modes.

Theme references to the **Brand** collection are resolved to its `GLS` mode (`light/N` → `blue/N`, `dark/N` → `blue-dark/N`). The other Brand modes are not exported yet.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report problems and propose changes, and [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE). The GLS name, logo and brand colours remain trademarks of their owner; the license covers the code and token files, not the right to present yourself as GLS.
