# vmusic

An Electron application with Vue

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Auto-updates with GitHub Releases

This app now supports auto-updates via `update.electronjs.org` using GitHub Releases.

### 1) Create the GitHub repository

- Create a **public** GitHub repo for this app (required by `update.electronjs.org`).
- Move or mirror your source there.
- Set `package.json.repository` to your GitHub repo URL so clients can resolve updates without extra env vars.

### 2) Create a GitHub token for publishing releases

- Create a Personal Access Token and export it as `GH_TOKEN`.
- The token must be allowed to create releases and upload assets.

### 3) Set environment variables

For publishing artifacts:

```bash
export GH_TOKEN=your_github_token
```

For the installed app update checks:

```bash
export VMUSIC_GH_REPO=your-github-user-or-org/your-repo-name
```

`VMUSIC_GH_REPO` is optional if `package.json` has a GitHub `repository` value.
If both are missing, auto-updates are skipped.

### 4) Publish a release

Increase `version` in `package.json`, commit, create a Git tag (`vX.Y.Z` recommended), then run:

```bash
# macOS arm64
npm run release:github:mac

# Windows
npm run release:github:win
```

These commands build and publish artifacts directly to GitHub Releases.

### 5) Validate updates

- Install an older version on a target machine.
- Publish a newer version in GitHub Releases.
- Open the app and wait for update check (startup + periodic checks).
- The app should download update and prompt user to restart.
