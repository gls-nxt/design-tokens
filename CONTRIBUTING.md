# Contributing

## Reporting a problem

Open an issue with the token name, the platform (web or KMP), the package version and what you expected. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Changing token values

The JSON in `tokens/` is the source of truth. It is edited by hand or with tools, not exported from Figma.

1. Edit the JSON as described in **Change tokens** in the [README](README.md#change-tokens).
2. Run `pnpm install && pnpm build && pnpm test`, and commit the regenerated `TOKENS.md` and `docs/swatches/`.
3. Open a pull request that says which tokens change and why. CI comments with each changed token before and after.

Removing a token from a platform, or renaming it, is a breaking change and needs a major version.

## Changing the build or the generated output

Pull requests are welcome for the compiler in `build.mjs`, the tests, the package setup and the documentation.

### Prerequisites

You need Node.js 24 and pnpm 11.21.0, the version pinned in `package.json`. Node.js doesn't include pnpm. Run `corepack enable pnpm` once, and Corepack then runs the pinned version. Corepack ships with Node.js 24; on Node.js 25 or newer, install it first with `npm install -g corepack`.

### Steps

1. Fork the repository and create a branch.
2. Run `pnpm install && pnpm build && pnpm test`.
3. For Kotlin changes, also run `./gradlew compileAndroidMain compileKotlinIosArm64 compileKotlinIosSimulatorArm64` in `packages/kotlin`.
4. Open a pull request that says what changes for consumers of the packages.

CI runs the same checks on every pull request.

## Releases

Only maintainers release. See the **Release** section of the README. A renamed or removed token needs a major version.
