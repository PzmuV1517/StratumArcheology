import sys

filepath = sys.argv[1]

with open(filepath, 'r') as f:
    content = f.read()

# Revert any previous bad patches first
content = content.replace('width: "80vw",', 'width: 300,')
content = content.replace('height: "auto", maxHeight: "60vh"', 'height: 600')

# Replace both uses of styles.imageStyle with dynamic sizing.
# screenWidth comes from useWindowDimensions(), screenHeight comes from props.
# Use 85% of screen width, and cap height at 50% of screen height.
# The library already sets resizeMode="contain" (Image) / contentFit="contain" (ExpoImage)
# as props, so the image will scale proportionally within these bounds.
content = content.replace(
    'style: styles.imageStyle',
    'style: { width: screenWidth * 0.85, height: screenHeight * 0.5 }'
)

# Also revert any previous screenHeight * 0.3 patch
content = content.replace(
    'height: screenHeight * 0.3',
    'height: screenHeight * 0.5'
)

# Patch imageTargetY for position === 'top' to vertically center the image
# in the available space above the bottom panel, instead of pinning to topSafe.
# The image wrapper height is (screenHeight - bottomPanelHeight), so we center within that.
content = content.replace(
    "if (position === 'top') {\n      return topSafe;\n    }",
    "if (position === 'top') {\n"
    "      var imgH = image.height || 0;\n"
    "      var availableHeight = screenHeight - bottomPanelHeight;\n"
    "      var centeredY = (availableHeight - imgH) / 2;\n"
    "      return Math.max(centeredY, topSafe);\n"
    "    }"
)

with open(filepath, 'w') as f:
    f.write(content)

print("Patched successfully")
