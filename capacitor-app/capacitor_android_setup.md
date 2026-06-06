# PrashnaSārathi Capacitor Android App Walkthrough

This document outlines the step-by-step instructions, commands, packages, and native configurations to compile and build the PrashnaSārathi web application into a fully native Android app with Splash screen, custom Icon, Camera, File upload, and Deep link support.

---

## 1. Directory Structure

The wrapper resides in the new `capacitor-app/` folder, separating it from the core Next.js frontend to prevent configuration conflicts:

```text
d:\clone\capacitor-app\
├── capacitor.config.ts  # Capacitor Configuration File
├── package.json         # Package definitions & dependency checklist
└── out\
    └── index.html       # Placeholder file to satisfy Capacitor CLI
```

---

## 2. Required NPM Packages

Below is the list of required npm packages for building and powering the app. These are defined inside [`package.json`](file:///d:/clone/capacitor-app/package.json):

* **Core Packages**:
  * `@capacitor/core`: Native runtime library.
  * `@capacitor/cli`: Command line tool for Capacitor operations.
* **Android Platform**:
  * `@capacitor/android`: Native Android bridge template.
* **Feature Plugins**:
  * `@capacitor/splash-screen`: Controls the native startup launch screen.
  * `@capacitor/push-notifications`: Handles native device registrations and click payloads.
  * `@capacitor/camera`: Handles camera access for taking profile photos.
  * `@capacitor/app`: Native system events (handles Back Button, App state, and Deep Linking).
* **Asset Generator**:
  * `cordova-res`: Command-line tool to auto-generate responsive splash screens and icons.

---

## 3. Build & Platform Commands

Run the following commands inside `d:\clone\capacitor-app` to set up and run the app:

### Step 1: Install Wrapper Dependencies
```bash
npm install
```

### Step 2: Initialize Android Native Project
Creates the native Android Studio project wrapper.
```bash
npx cap add android
```

### Step 3: Sync Web Assets & Plugins
Copies web assets and links the Capacitor plugins into the Android project. Run this every time you modify the configuration or plugins.
```bash
npx cap sync
```

### Step 4: Open in Android Studio
Opens the project inside Android Studio for compiling, emulation, and release signing.
```bash
npx cap open android
```

---

## 4. Native Android Configuration Steps

To fully enable push notifications, deep links, and device permissions, update the native Android configurations inside Android Studio:

### A. Deep Linking Support
Allows users to open links like `https://prashnasarathi.vercel.app/questions` directly inside the Android App.

1. Open `android/app/src/main/AndroidManifest.xml`.
2. Inside the `<activity>` tag, add the following `<intent-filter>`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="prashnasarathi.vercel.app" />
</intent-filter>
```
3. Establish trust by deploying a Digital Asset Links JSON file on Vercel at:
   `https://prashnasarathi.vercel.app/.well-known/assetlinks.json`

### B. Device Permissions (Camera & File Uploads)
Add permissions to `android/app/src/main/AndroidManifest.xml` to allow users to take profile photos and upload files:

```xml
<!-- Camera Access -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Storage Access (For file uploads & attachment picker) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### C. Push Notifications
To enable push notifications in Android, you must integrate Firebase:
1. Create a project in [Firebase Console](https://console.firebase.google.com).
2. Register an Android App using package name `com.prashnasarathi.app`.
3. Download `google-services.json` and place it inside `android/app/`.
4. Ensure the Push Notification plugin is registered in `MainActivity.java` if needed (Capacitor handles registration automatically for modern versions).

---

## 5. Splash Screen & Icon Customization

To generate the app icon and splash screen resources automatically:
1. Create a folder named `resources/` inside `capacitor-app/`.
2. Place a `icon.png` (min 1024x1024 px, no transparent background) and a `splash.png` (min 2732x2732 px, centered logo) in `resources/`.
3. Run the generator script to compile and install all responsive sizes:
   ```bash
   npm run build:resources
   ```
