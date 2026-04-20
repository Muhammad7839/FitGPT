// Ensures the installed Mediapipe package exposes the sourcemap filename it references.
const fs = require("fs");
const path = require("path");

const packageDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "@mediapipe",
  "tasks-vision"
);
const sourceMapPath = path.join(packageDir, "vision_bundle.mjs.map");
const expectedMapPath = path.join(packageDir, "vision_bundle_mjs.js.map");

try {
  if (!fs.existsSync(sourceMapPath)) {
    process.exit(0);
  }

  if (!fs.existsSync(expectedMapPath)) {
    fs.copyFileSync(sourceMapPath, expectedMapPath);
    console.log("Created Mediapipe sourcemap alias:", path.basename(expectedMapPath));
  }
} catch (error) {
  console.warn("Unable to repair Mediapipe sourcemap reference:", error.message);
}
