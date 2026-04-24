// Repairs known bad sourcemap references in installed third-party packages.
const fs = require("fs");
const path = require("path");

function repairMediapipeSourcemap() {
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
      return;
    }

    if (!fs.existsSync(expectedMapPath)) {
      fs.copyFileSync(sourceMapPath, expectedMapPath);
      console.log("Created Mediapipe sourcemap alias:", path.basename(expectedMapPath));
    }
  } catch (error) {
    console.warn("Unable to repair Mediapipe sourcemap reference:", error.message);
  }
}

function removeZxingBrokenSourcemapReferences() {
  const packageDir = path.join(
    __dirname,
    "..",
    "node_modules",
    "@zxing",
    "browser"
  );

  if (!fs.existsSync(packageDir)) {
    return;
  }

  let patched = 0;

  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".js")) {
        continue;
      }

      const source = fs.readFileSync(entryPath, "utf8");
      const next = source.replace(/(?:\r?\n)?\/\/# sourceMappingURL=.*\.js\.map\s*$/u, "");
      if (next !== source) {
        fs.writeFileSync(entryPath, next);
        patched += 1;
      }
    }
  };

  try {
    visit(packageDir);
    if (patched > 0) {
      console.log("Removed broken ZXing sourcemap references:", patched);
    }
  } catch (error) {
    console.warn("Unable to repair ZXing sourcemap references:", error.message);
  }
}

repairMediapipeSourcemap();
removeZxingBrokenSourcemapReferences();
