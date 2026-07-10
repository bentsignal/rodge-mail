import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const appleAppSiteAssociation = JSON.stringify({
  applinks: { apps: [], details: [] },
  webcredentials: {
    apps: ["39K6A9FP99.com.bentsignal.rodgemail"],
  },
});

export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    host: true,
  },
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
  plugins: [
    {
      name: "rodge-local-associated-domains",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/.well-known/apple-app-site-association") {
            next();
            return;
          }
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json");
          response.end(appleAppSiteAssociation);
        });
      },
    },
    devtools({
      consolePiping: { enabled: false },
    }),
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart({
      srcDirectory: "src",
      router: { routesDirectory: "app" },
    }),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    nitro({ preset: process.env.VERCEL ? "vercel" : undefined }),
  ],
});
