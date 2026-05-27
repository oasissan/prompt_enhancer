# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Prompt Refinement** is a Chrome Extension (Manifest V3) that injects a ✨ button into AI chatbox UIs (ChatGPT, Claude, Gemini, LMSYS Arena) and uses LLM APIs to rewrite the user's prompt into a higher-quality version shown in a side-by-side glassmorphic preview modal.

## Commands

All commands must be run from inside the `extension/` directory:

```bash
cd extension

# Install dependencies
npm install

# Full production build (runs TypeScript check + 3-phase Vite build)
npm run build

# Type-check only
npx tsc -b --noEmit

# Lint
npm run lint
```

There is no dev server or test suite. The only way to test the extension is to build it and load `extension/dist/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Architecture

### Source Files (`extension/src/`)

| File | Role |
|---|---|
| `background.ts` | Service worker — receives `refinePrompt` messages and routes them to the correct API provider (Gemini API, OpenAI, Anthropic, or Gemini Web) |
| `content.tsx` | Content script — injects the ✨ button into platform UIs and mounts the React comparison modal via Shadow DOM |
| `main.tsx` | Popup window — shows active status, saved prompts library |
| `options.tsx` | Options page — provider/model selection and API key management |
| `storage.ts` | `chrome.storage.sync` helpers; defines `StorageData` and `Template` types; exports `DEFAULT_TEMPLATES` |
| `platformSelectors.ts` | DOM helpers for finding chat input elements and attach/send buttons across each supported platform; handles Shadow DOM traversal |

### Build System

The build is **three sequential Vite phases** driven by `extension/build.js` (not `vite.config.ts`):

1. **Phase 1 — UI**: Builds popup (`index.html`) and options (`options.html`) into `dist/`. Clears `dist/` first (`emptyOutDir: true`).
2. **Phase 2 — Content Script**: Builds `src/content.tsx` as a fully self-contained bundle into `dist/` (no shared chunks with the UI).
3. **Phase 3 — Background**: Builds `src/background.ts` as a self-contained service worker into `dist/`.

Phases 2 and 3 use `emptyOutDir: false` to avoid wiping the prior output. Each script produces a flat named file (`content.js`, `background.js`, `popup.js`, `options.js`) as required by `manifest.json`.

### Content Script Injection Pattern

`content.tsx` is loaded at `document_start` (before the page renders). It registers capture-phase event listeners (`pointerdown`, `mousedown`, `click`) on `window` immediately at module parse time — before platform JS loads — to intercept click events on the injected button without the platform swallowing them.

The React app mounts inside a **Shadow DOM** container (`#ai-prompt-refiner-root`) attached to `document.body`. A 1-second `setInterval` continuously calls `init()` to re-mount the root if a SPA navigation wiped it, and another interval calls `updateDOM()` to re-inject the ✨ button next to the platform's Plus or Send button when the DOM changes.

### Provider Flow

```
content script → chrome.runtime.sendMessage({ action: 'refinePrompt', payload })
                                                    ↓
                                           background.ts handleRefinement()
                                                    ↓
             ┌──────────────┬──────────────┬──────────────┬───────────────┐
             │  gemini-web  │    gemini    │   openai     │  anthropic    │
             │ (session     │  (REST API)  │  (REST API)  │  (REST API)   │
             │  cookies)    │              │              │               │
             └──────────────┴──────────────┴──────────────┴───────────────┘
```

**Gemini Web (free)**: Fetches `gemini.google.com/app` with `credentials: 'include'` to extract short-lived session tokens (`SNlM0e`, `cfb2h`, `FdrFJe`), then POSTs to the internal `StreamGenerate` endpoint. After getting the response, it fires-and-forgets a call to delete the conversation from Gemini history.

### Storage Schema

All settings live in `chrome.storage.sync` under the keys defined in `StorageData` (`storage.ts`). Templates (`Template[]`) are stored per-user with 8 built-in AI refinement rules. Saved prompts are a plain `string[]`. There is no backend — everything is local to the browser profile.

### Platform Selectors

`platformSelectors.ts` contains `getActiveInputElements()` which branches on `window.location.hostname` to find the correct contenteditable/textarea element for ChatGPT, Claude, Gemini, and LMSYS Arena. `querySelectorShadow` / `querySelectorAllShadow` walk nested Shadow DOM trees used by those platforms.

## Key Constraints

- **Manifest V3**: No remote code execution, no `eval()`. All API calls go through the background service worker (not directly from content scripts) because CSP on host pages blocks cross-origin fetches from content scripts.
- **No shared chunks between content script and UI**: The content script must be fully self-contained. Do not import from `main.tsx` or `options.tsx` into `content.tsx`, and do not add shared entry points that Rollup might split into a common chunk with `content.js`.
- **Shadow DOM isolation**: All React rendering in `content.tsx` happens inside a Shadow DOM. Do not use `document.querySelector` for the extension's own elements from inside the React tree — use `inlineContainer.querySelector` or refs.
- **`run_at: document_start`**: Event listeners in `content.tsx` must be registered synchronously at module scope (outside React lifecycle). The `__refinerCallbackRef` pattern bridges the early-registered listener to the React component's callback.
