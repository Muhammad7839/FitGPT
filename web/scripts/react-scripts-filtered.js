// Filters a small set of known toolchain warnings while preserving all other React output.
const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const reactScriptsPath = require.resolve("react-scripts/bin/react-scripts");
const env = {
  ...process.env,
  ...(args[0] === "build" ? { CI: "false" } : {}),
};

const linePatterns = [
  /\[DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE\]/i,
  /\[DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE\]/i,
  /'onAfterSetupMiddleware' option is deprecated/i,
  /'onBeforeSetupMiddleware' option is deprecated/i,
  /'setupMiddlewares' option/i,
];

const blockStartPatterns = [
  /WARNING in \.\/node_modules\/@mediapipe\/tasks-vision\/vision_bundle\.mjs/i,
  /Module Warning \(from .*source-map-loader/i,
  /Failed to parse source map from .*@mediapipe[\\/]tasks-vision[\\/]vision_bundle_mjs\.js\.map/i,
];

function matchesAny(line, patterns) {
  return patterns.some((pattern) => pattern.test(line));
}

function createFilteredWriter(stream) {
  let pending = "";
  let suppressBlankLines = 0;

  return (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (matchesAny(line, linePatterns)) {
        return;
      }

      if (matchesAny(line, blockStartPatterns)) {
        // CRA emits the Mediapipe source-map warning as a short multi-line block.
        suppressBlankLines = 2;
        return;
      }

      if (!trimmed && suppressBlankLines > 0) {
        suppressBlankLines -= 1;
        return;
      }

      suppressBlankLines = 0;
      stream.write(`${line}\n`);
    });
  };
}

const child = spawn(process.execPath, [reactScriptsPath, ...args], {
  cwd: path.resolve(__dirname, ".."),
  env,
  stdio: ["inherit", "pipe", "pipe"],
});

const stdoutWriter = createFilteredWriter(process.stdout);
const stderrWriter = createFilteredWriter(process.stderr);

child.stdout.on("data", stdoutWriter);
child.stderr.on("data", stderrWriter);

child.on("close", (code) => {
  process.exit(code || 0);
});
