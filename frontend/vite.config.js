import react from "@vitejs/plugin-react";
import { defineConfig, transformWithEsbuild } from "vite";

const jsAsJsx = {
  name: "js-as-jsx",
  async transform(code, id) {
    if (!id.match(/src\/.*\.js$/)) return null;
    return transformWithEsbuild(code, id, {
      loader: "jsx",
      jsx: "automatic",
    });
  },
};

export default defineConfig({
  plugins: [jsAsJsx, react()],
  esbuild: {
    include: /src\/.*\.[jt]sx?$/,
    loader: "jsx",
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
});
