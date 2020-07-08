import pluginTester from "babel-plugin-tester";
import * as path from "path";

import babelPlugin from "../src/plugin";

pluginTester({
  plugin: babelPlugin,
  fixtures: path.join(__dirname, "__fixtures__"),
  tests: {
    /* your test objects */
  },
});
