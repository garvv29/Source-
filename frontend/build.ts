import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

if (Bun.env.VERCEL && !Bun.env.VITE_BACKEND_URL) {
  throw new Error("Set VITE_BACKEND_URL in Vercel to your deployed API URL before building.");
}

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "import.meta.env.VITE_SUPABASE_URL":
            JSON.stringify(Bun.env.VITE_SUPABASE_URL),

        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY":
            JSON.stringify(Bun.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_BACKEND_URL":
            JSON.stringify(Bun.env.VITE_BACKEND_URL ?? "http://localhost:3001"),
    "process.env.VITE_BACKEND_URL":
            JSON.stringify(Bun.env.VITE_BACKEND_URL ?? "http://localhost:3001"),
  },
});

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
