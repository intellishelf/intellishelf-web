# Headless Playwright troubleshooting

In one restricted ChatGPT Work Linux environment, the web frontend built and served successfully, but the bundled Chromium headless shell failed during graphics initialization (including `EGL_NOT_INITIALIZED`). A Playwright launch succeeded with GPU and software rasterization disabled:

```js
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "/path/to/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-software-rasterizer"],
});
```

This is a troubleshooting option for that environment, not a required configuration for all development or CI environments. Prefer Playwright's normal browser installation and sandbox where supported; `--no-sandbox` weakens browser isolation and was used only in the restricted, temporary environment.

## What was verified

- Chromium was obtained from the `@sparticuz/chromium` npm package after the normal Playwright browser download failed. Its binary was extracted manually because the package's standard extraction encountered a filesystem ownership error. It was launched by Playwright with the options above.
- With the Vite frontend running on loopback, Playwright opened the app, followed the redirect to `/auth`, and captured the login screen.
- The API and MongoDB were not running, so authentication and bookshelf operations were not verified.
- The execution environment's localhost was not reachable from the separate cloud browser. A screenshot worked, but this did not provide an interactive shared preview.

The exact binary path is environment-specific. If this workaround fails elsewhere, inspect the Chromium launch logs and the container's browser dependencies and permissions; do not assume every EGL error has the same cause.
