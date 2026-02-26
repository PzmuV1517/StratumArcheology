# STRATUM Development Setup Guide

This guide explains how to set up and run the STRATUM application on your local development machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Git**

### Platform-Specific Requirements

#### For iOS Development (macOS only)

- **Xcode** 15+ (from Mac App Store)
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **iOS Simulator** or physical iPhone/iPad

#### For Android Development

- **Android Studio** with:
  - Android SDK
  - Android SDK Platform-Tools
  - Android Emulator
- **Java Development Kit (JDK)** 17+

#### For Web Development

- Any modern browser (Chrome, Firefox, Safari, Edge)

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/QuantumBitsFLL2025-2026.git
cd QuantumBitsFLL2025-2026/frontend/stratum-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# API Configuration (optional - defaults to localhost:8000)
EXPO_PUBLIC_API_URL=http://localhost:8000/api

# Firebase Configuration (get from Firebase Console)
# These are already configured in app.json, only override if needed
```

### 4. iOS Setup (macOS only)

Install CocoaPods dependencies:

```bash
cd ios
pod install
cd ..
```

---

## Running the Application

### Method 1: Expo Development Server (Recommended for Development)

This is the simplest way to start developing:

```bash
npx expo start
```

This opens Expo Dev Tools. From here you can:

- Press `w` to open in web browser
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on your phone

#### Web Development

```bash
npx expo start --web
```

Opens at `http://localhost:8081` by default.

#### iOS Simulator

```bash
npx expo start --ios
```

Or press `i` after running `npx expo start`.

#### Android Emulator

```bash
npx expo start --android
```

Or press `a` after running `npx expo start`.

---

### Method 2: Development Build on Physical iOS Device

For testing native features (camera, GPS, etc.) on a real iPhone/iPad:

#### Prerequisites

1. **Apple Developer Account** (free or paid)
2. **Physical iPhone/iPad** connected via USB or on same WiFi
3. **Device trusted** on your Mac

#### Step-by-Step Guide

##### 1. Connect Your Device

- Connect iPhone/iPad to Mac via USB cable
- On the device, tap "Trust" when prompted
- Unlock the device

##### 2. Open Xcode and Configure Signing

```bash
# Open the Xcode project
open ios/stratumapp.xcworkspace
```

In Xcode:

1. Select the project in the navigator (left panel)
2. Select the "stratumapp" target
3. Go to "Signing & Capabilities" tab
4. Check "Automatically manage signing"
5. Select your Team (Apple Developer account)
6. Xcode will create a provisioning profile

##### 3. Build and Run

From the terminal:

```bash
npx expo run:ios --device
```

Or specify device by name:

```bash
npx expo run:ios --device "John's iPhone"
```

##### 4. Trust the Developer Certificate (First Time Only)

On your iOS device:

1. Go to **Settings → General → VPN & Device Management**
2. Find your developer certificate
3. Tap **Trust**

##### 5. Subsequent Runs

After initial setup, just run:

```bash
npx expo run:ios --device
```

#### Troubleshooting iOS Physical Device

| Issue                                 | Solution                                     |
| ------------------------------------- | -------------------------------------------- |
| "Could not find device"               | Reconnect USB, unlock device, trust computer |
| "Signing requires a development team" | Configure team in Xcode                      |
| "Untrusted Developer"                 | Trust certificate in Settings                |
| "Failed to prepare device"            | Update iOS to latest version                 |
| "Unable to install app"               | Free accounts expire after 7 days, rebuild   |

---

### Method 3: Development Build on Android Device

#### USB Connection

1. Enable Developer Options on Android device
2. Enable USB Debugging
3. Connect via USB
4. Accept debugging prompt on device

```bash
npx expo run:android --device
```

#### Wireless (same WiFi network)

```bash
# First, connect via USB and run:
adb tcpip 5555
adb connect <device-ip>:5555

# Then disconnect USB and run:
npx expo run:android --device
```

---

## Running with Backend

The app connects to the backend API. Ensure the backend is running:

### Local Backend

```bash
# In another terminal, from the project root:
cd backend
make run
# Or: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The app auto-detects the backend URL based on platform:

- **Web**: `http://localhost:8000/api`
- **iOS Simulator**: `http://127.0.0.1:8000/api`
- **Android Emulator**: `http://10.0.2.2:8000/api`
- **Physical Device**: Uses Expo's detected host IP

### Custom Backend URL

For physical devices on different networks or remote backends:

```bash
EXPO_PUBLIC_API_URL=http://your-backend-ip:8000/api npx expo start
```

Or use tunnel mode for devices not on the same network:

```bash
npx expo start --tunnel
```

---

## Common Commands

| Command                         | Description                               |
| ------------------------------- | ----------------------------------------- |
| `npx expo start`                | Start development server                  |
| `npx expo start --web`          | Start for web only                        |
| `npx expo start --ios`          | Start and open iOS simulator              |
| `npx expo start --android`      | Start and open Android emulator           |
| `npx expo run:ios`              | Build and run on iOS simulator            |
| `npx expo run:ios --device`     | Build and run on physical iOS device      |
| `npx expo run:android`          | Build and run on Android emulator         |
| `npx expo run:android --device` | Build and run on physical Android device  |
| `npx expo prebuild`             | Generate native projects (ios/, android/) |
| `npx expo prebuild --clean`     | Regenerate native projects from scratch   |
| `npm run lint`                  | Run ESLint                                |
| `npm run test`                  | Run Jest tests                            |

---

## Network Configuration for Physical Devices

When testing on physical devices, the device must be able to reach the backend:

### Option 1: Same WiFi Network

1. Find your computer's local IP: `ipconfig getifaddr en0` (macOS)
2. Start backend bound to all interfaces: `--host 0.0.0.0`
3. App auto-detects IP from Expo

### Option 2: Mobile Hotspot

1. Connect your Mac to your phone's hotspot
2. Both devices are now on the same network
3. Backend and app communicate via hotspot IP

### Option 3: Tunnel Mode (Any Network)

```bash
# Backend with ngrok:
ngrok http 8000
# Note the https://xxx.ngrok.io URL

# Frontend:
EXPO_PUBLIC_API_URL=https://xxx.ngrok.io/api npx expo start --tunnel
```

---

## Project Scripts

Available in `package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "lint": "eslint .",
    "test": "jest"
  }
}
```

---

## Debugging

### React Native Debugger

Press `j` in the terminal to open Chrome DevTools debugger.

### Expo Dev Tools

After running `npx expo start`, access dev menu:

- **Shake device** (physical)
- Press `m` in terminal
- Cmd+D (iOS Simulator)
- Cmd+M (Android Emulator)

### Console Logs

View logs in:

- Terminal running Expo
- Browser DevTools (web)
- Xcode Console (iOS)
- Android Studio Logcat (Android)

---

## Building for Production

### EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Build

```bash
# iOS (requires Mac)
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

---

## Troubleshooting

### "Metro bundler failed to start"

```bash
npx expo start --clear
```

### "Unable to resolve module"

```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### iOS Build Fails

```bash
cd ios
pod deintegrate
pod install
cd ..
npx expo run:ios
```

### Android Build Fails

```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

### Expo Go vs Development Build

- **Expo Go**: Quick testing, limited native modules
- **Development Build** (`npx expo run:ios/android`): Full native access, required for production features

If a feature doesn't work in Expo Go, use a development build.

---

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
