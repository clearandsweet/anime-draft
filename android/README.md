# Android App (alpha scaffold)

This folder contains a starter native Android app for Anime Draft.

## Current scope

- Native Compose launch screen
- Create lobby via `POST /api/lobbies`
- Join lobby by ID
- Opens lobby in an in-app `WebView` for gameplay

## Next native milestones

1. Replace `WebView` with native lobby screen (`/api/lobby/{id}/state` polling).
2. Native join/start/pick/undo/finish flows.
3. Persist player identity locally.
4. Add vote flow and board export equivalents.

## Run

1. Open `android/` in Android Studio (JDK 17).
2. Let Gradle sync.
3. Run the `app` module on a device/emulator.

Default server URL is set to `https://animedraft.godisaloli.com`.
