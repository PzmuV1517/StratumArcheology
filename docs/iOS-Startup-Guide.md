# iOS Startup Guide for STRATUM App

This guide will walk you through setting up and running the STRATUM app on a physical iOS device from scratch, including all required steps for development, device connection, and code signing.

---

## 1. Prerequisites
- A Mac with Xcode installed (latest version recommended)
- Node.js and npm installed
- Expo CLI installed globally (`npm install -g expo-cli`)
- An Apple ID (for code signing)
- A physical iOS device and its USB cable (if you don't have one, you can use the iOS Simulator, but this guide focuses on physical devices. Simulator setup is easier, usually requiring just `npx expo start` and pressing `i` with xcode tools and xcode installed (with simulator).)

---

## 2. Initial Project Setup

### a. Clone the Repository
```
git clone <your-repo-url>
cd QuantumBitsFLL2025-2026/frontend/stratum-app
```

### b. Install Dependencies
```
npm install --legacy-peer-deps
```

### c. Generate the iOS Folder (if missing)
If the `ios/` folder does not exist:
```
npx expo prebuild --platform ios
```
This will generate the `ios/` directory with Xcode project files.

---

## 3. Prepare Your iOS Device

### a. Enable Developer Mode
- On your iPhone, go to **Settings > Privacy & Security > Developer Mode** and enable it.
- Restart your device if prompted.

### b. Connect Device to Mac
- Use a USB cable to connect your iPhone to your Mac.
- Trust the computer on your iPhone if prompted.

---

## 4. Xcode Setup

### a. Open the Project in Xcode
```
open ios/stratumapp.xcodeproj
```

### b. Add Your Apple ID
- In Xcode, go to **Xcode > Settings > Accounts**.
- Click the `+` button and sign in with your Apple ID.

### c. Set Up a Development Team
- In Xcode, select the `stratumapp` project in the left sidebar.
- Go to the **Signing & Capabilities** tab.
- Under **Team**, select your Apple ID or your team.
- Xcode will automatically create a development certificate and provisioning profile.

---

## 5. Build and Run on Device

### a. Trust Your Developer Certificate
- On your iPhone, go to **Settings > General > VPN & Device Management**.
- Trust the certificate associated with your Apple ID if prompted.

### b. Start the Metro Bundler
In the project root:
```
cd frontend/stratum-app
EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000/api npx expo run:ios --device
```
Replace `<your-mac-ip>` with your Mac's current Wi-Fi IP address (find it with `ipconfig getifaddr en0`).

---

## 6. Troubleshooting
- Make sure your iPhone and Mac are on the same Wi-Fi network.
- Disable any firewalls that may block local network traffic.
- If you see a timeout or cannot connect, double-check the API URL and your Mac's IP address.
- If you get signing errors, ensure your Apple ID is added and selected as the team in Xcode.

---

## 7. Useful Commands
- **Install dependencies:** `npm install`
- **Generate iOS folder:** `npx expo prebuild --platform ios`
- **Run on device:** `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000/api npx expo run:ios --device`
- **Find Mac IP:** `ipconfig getifaddr en0`

---

## 8. References
- [Expo: Running on a device](https://docs.expo.dev/workflow/run-on-device/)
- [Apple: Trusting Developer Certificate](https://developer.apple.com/documentation/xcode/running-your-app-in-the-simulator-or-on-a-device)

---

This guide should get you from zero to running the STRATUM app on your iOS device, including all required Apple and Expo steps.
