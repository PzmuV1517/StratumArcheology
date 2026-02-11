#!/bin/bash
# Deprecated file notice: This file is deprecated and will be removed in future versions.
# Please refer to the updated documentation for the latest testing procedures.
# Mobile Testing over Hotspot
# This script tunnels both backend and frontend for testing on physical iOS devices
# when both devices are connected via iPhone hotspot (which has client isolation)

echo "=========================================="
echo "  STRATUM Mobile Testing (Hotspot Mode)"
echo "=========================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo "   Install with: brew install ngrok"
    echo "   Then run: ngrok config add-authtoken YOUR_TOKEN"
    echo "   Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

echo "📡 Starting backend tunnel..."
echo "   This will give you a public URL for the backend API"
echo ""
echo "INSTRUCTIONS:"
echo "1. In a NEW terminal, run: cd backend && make run"
echo "2. In ANOTHER terminal, run: ngrok http 8000"
echo "3. Copy the https://xxx.ngrok.io URL from ngrok"
echo "4. In ANOTHER terminal, run the frontend with that URL:"
echo ""
echo "   cd frontend/stratum-app"
echo "   EXPO_PUBLIC_API_URL=https://YOUR-NGROK-URL.ngrok.io/api npx expo start --tunnel"
echo ""
echo "5. Scan the QR code with Expo Go on your iPhone"
echo ""
echo "=========================================="
