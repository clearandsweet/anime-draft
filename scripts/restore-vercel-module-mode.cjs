const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.resolve(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (packageJson.type === "module") {
  delete packageJson.type;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}
