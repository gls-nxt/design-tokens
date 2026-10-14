# Contributing

## Reporting a problem

Open an issue with the token name, the platform (web or KMP), the package version and what you expected. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Changing token values

Token values are exported from the Unity Design System Figma library, which is the source of truth. A pull request that edits the JSON in `tokens/` by hand will be closed unless it comes from a maintainer who is syncing the export. If a value looks wrong, open an issue so the design team can fix it at the source.

## Changing the build or the generated output

Pull requests are welcome for the compiler in `build.mjs`, the tests, the package setup and the documentation.

1. Fork the repository and create a branch.
2. Run `pnpm install && pnpm build && pnpm test`.
3. For Kotlin changes, also run `./gradlew compileAndroidMain compileKotlinIosArm64 compileKotlinIosSimulatorArm64` in `packages/kotlin`.
4. Open a pull request that says what changes for consumers of the packages.

CI runs the same checks on every pull request.

## Releases

Only maintainers release. See the **Release** section of the README. A renamed or removed token needs a major version.
