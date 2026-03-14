# iOS Build and Deploy Plan — Sikia Mobile (Sikia)

This document explains how to build and deploy the **sikia_mobile** app for iPhone so it works like Android.

---

## Current state

- **Framework:** React Native 0.82.1 (New Architecture enabled).
- **Android:** Working — `yarn android`, `yarn build:android`, `yarn build:android:release`, Fastlane for Play Store.
- **iOS:** Scripts exist but deployment was blocked by a **bundle ID mismatch** between Xcode and Fastlane/Match (see below). That has been fixed in this plan.

---

## Fix applied: Bundle ID alignment

The app is built with **bundle identifier `com.pocketpalai`** (same as Android package name). Match and Fastlane were still using **`ai.pocketpal`**, so provisioning profiles did not match the app.

**Changes made:**

1. **`ios/fastlane/Matchfile`**  
   - `app_identifier` set to **`com.pocketpalai`** (was `ai.pocketpal`).

2. **`ios/fastlane/Fastfile`**  
   - In `release_ios_testflight` and `build_for_device_farm`, `export_options.provisioningProfiles` key updated from **`ai.pocketpal`** to **`com.pocketpalai`**, and profile names updated to the Match naming for `com.pocketpalai` (e.g. `"match AppStore com.pocketpalai"`, `"match Development com.pocketpalai"`).

After these changes, Xcode’s bundle ID and Fastlane/Match’s app identifier and profile names are consistent.

---

## Prerequisites (macOS / iPhone)

1. **Xcode**  
   - Install from Mac App Store.  
   - Open Xcode once and accept the license; install any requested command-line tools.

2. **Ruby & Bundler**  
   - Project uses Ruby 3.2.3 (see root `Gemfile`). Use `rbenv`, `rvm`, or system Ruby.  
   - In project root: `bundle install` (installs Fastlane, CocoaPods, etc.).

3. **CocoaPods**  
   - After `bundle install`, use: `bundle exec pod install` (run from **`ios/`**).  
   - Or from root: `cd ios && bundle exec pod install`.

4. **Apple Developer account**  
   - For **physical device** and **TestFlight/App Store**: paid Apple Developer account.  
   - In Xcode: **Signing & Capabilities** → set your **Team** for the Sikia target.  
   - For **simulator only**: no paid account needed.

5. **Environment variables**  
   - Copy `.env.example` to `.env` (if present) or ensure `.env` has the keys your app needs (e.g. Supabase, API keys).  
   - For **Fastlane Match** (signing):  
     - `MATCH_GIT_URL` — private repo URL where certificates/profiles are stored.  
     - `MATCH_GITHUB_TOKEN` — GitHub token with access to that repo.  
     - `APP_STORE_CONNECT_USER_ID` (or Apple ID).  
     - For App Store Connect API: `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, and either `APP_STORE_CONNECT_API_KEY_CONTENT` or `APP_STORE_CONNECT_API_KEY_PATH` to a `.p8` file.

6. **Match (certificates & profiles)**  
   - First-time or after changing bundle ID: run Match so it creates/updates profiles for **`com.pocketpalai`**.  
   - From project root:  
     - `cd ios && bundle exec fastlane match development`  
     - `cd ios && bundle exec fastlane match appstore`  
   - Use the same Match storage (e.g. same Git repo) and the same bundle ID everywhere (Xcode + Matchfile + Fastfile).

---

## Build and run (like Android)

### Simulator (no Apple Developer account)

- Start Metro: `yarn start` (or `npx react-native start`).
- Run app on default simulator (e.g. iPhone 16 Pro):  
  `yarn ios`  
  Or specify device:  
  `yarn ios --simulator "iPhone 16 Pro"`.
- Build only (no run):  
  `yarn ios:build`  
  (builds Debug for `iphonesimulator`).

### Physical iPhone (development)

1. Connect the iPhone and unlock it; trust the computer if prompted.
2. In Xcode: open **`ios/Sikia.xcworkspace`** (not `.xcodeproj`).
3. Select your **iPhone** as the run destination (top toolbar).
4. In **Signing & Capabilities** for the **Sikia** target, choose your **Team** and ensure **Automatically manage signing** is on for development (or use the same Team/Match profiles you use for `com.pocketpalai`).
5. From project root:  
   `yarn ios --device`  
   Or run from Xcode with the device selected (▶ Run).

If you use **Match** for development, ensure you have run `fastlane match development` for `com.pocketpalai` and that the Sikia target’s Release (or the configuration you use for device) uses the “match Development com.pocketpalai” profile.

### Release build (IPA / device farm)

- From project root (loads `.env` and runs Fastlane):  
  `yarn ios:build:ipa`  
- This runs **`ios/fastlane build_for_device_farm`**:  
  - Uses Match to get **development** profiles for **`com.pocketpalai`**.  
  - Builds the app and exports an IPA to **`ios/build/Sikia.ipa`**.  
- Requires the env vars above (e.g. `MATCH_GITHUB_TOKEN`, App Store Connect API key or path).

### Release build (Xcode only, no Fastlane)

- Build Release for device (e.g. arm64):  
  `yarn ios:build:release`  
- Output is in Xcode’s build directory; to get an IPA you’d archive in Xcode or use Fastlane (e.g. `build_for_device_farm` or `build_ios_app`).

### TestFlight / App Store

- Use the **`release_ios_testflight`** lane (e.g. from **`ios/`**):  
  `cd ios && bundle exec fastlane release_ios_testflight`  
- Ensure Match has been run for **appstore** with **`com.pocketpalai`** and that **`export_options.provisioningProfiles`** in the Fastfile uses **`com.pocketpalai`** (already updated in this plan).
- This builds with App Store profile and uploads to TestFlight.

---

## Summary: “Like Android”

| Goal              | Android                     | iOS equivalent                                      |
|-------------------|-----------------------------|-----------------------------------------------------|
| Run (simulator)   | `yarn android`               | `yarn ios` (or `yarn ios --simulator "iPhone 16 Pro"`) |
| Run (device)      | `yarn android` + device      | `yarn ios --device` (after Xcode signing + device)  |
| Debug build       | `yarn build:android`        | `yarn ios:build` (simulator)                        |
| Release build     | `yarn build:android:release`| `yarn ios:build:release` or `yarn ios:build:ipa`   |
| Store deploy      | Fastlane `release_android_alpha` | Fastlane `release_ios_testflight`              |

---

## Troubleshooting

- **“No provisioning profile” / “Signing for Sikia requires a development team”**  
  - Set the **Team** in Xcode for the Sikia target and, if using Match, run `fastlane match development` (and optionally `appstore`) for **`com.pocketpalai`**.

- **Pod install / build errors**  
  - From **`ios/`**: `bundle exec pod install` (or `pod install --repo-update`).  
  - If dependencies change: `cd ios && bundle exec pod install` then rebuild.

- **“Multiple commands produce” / duplicate symbols**  
  - The Podfile already forces `llama-rn` to static library; if similar errors appear for another pod, consider an analogous `pre_install` or post_install fix.

- **Metro / JS errors**  
  - Run `yarn start` (or `yarn start:reset`) and ensure the app is pointing at the correct bundler (same machine or correct IP for device).

- **Match / Fastlane errors**  
  - Confirm **bundle ID** is **`com.pocketpalai`** everywhere (Xcode, Matchfile, Fastfile).  
  - Confirm `MATCH_GIT_URL`, `MATCH_GITHUB_TOKEN`, and App Store Connect API keys are set and valid.

---

## Next steps

1. **Align signing:**  
   - Update Matchfile and Fastfile to use **`com.pocketpalai`** (done in this plan).  
   - Re-run Match for development (and appstore if you use TestFlight):  
     `cd ios && bundle exec fastlane match development` and optionally `bundle exec fastlane match appstore`.

2. **Device run:**  
   - Open **`ios/Sikia.xcworkspace`** in Xcode, select your iPhone, set Team, then run **`yarn ios --device`** or run from Xcode.

3. **IPA / Device farm:**  
   - Set env vars (including `MATCH_GITHUB_TOKEN` and App Store Connect API key/path), then run **`yarn ios:build:ipa`**.

4. **TestFlight:**  
   - After Match appstore for `com.pocketpalai`, run **`cd ios && bundle exec fastlane release_ios_testflight`**.

Once the bundle ID fix is in place and Match is run for **`com.pocketpalai`**, building and deploying for iPhone should work in line with the Android workflow above.
