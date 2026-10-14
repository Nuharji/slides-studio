# Slides Studio (Rust / Tauri)

Presentation editor of the Studio family — made for students and teachers: drag-and-drop layouts like Canva,
works offline, no account. The native shell is Rust ([Tauri 2](https://tauri.app)); the UI is plain HTML/JS in `ui/`.

## Features (0.1.0)
- Fixed 16:9 canvas; **text, shapes (8), images**; drag, resize, rotate, snap guides, multi-select
- **Layouts** (title, content, two columns, image + text, quote, section, big statement) and **7 themes**
- Theme colors/fonts are tokens, so one click re-themes the whole deck
- Slide filmstrip with drag-to-reorder, duplicate, delete, per-slide background (color / gradient) and transition
- **Present mode** (F5, full screen, arrows / click, B = black), speaker notes
- Export as **PDF** (print dialog → "Save as PDF") and as a **standalone HTML slideshow**
- Undo/redo, copy/paste, autosave recovery, German/English UI, dark/light, auto-hide bars
- Files are plain JSON (`.slides`)

Not yet: PPTX export, animations inside a slide, tables/charts, presenter view with notes.

## Layout
```
ui/                 index.html, app.js (editor), native.js + autohide.js (shared Studio shell)
src-tauri/src/      main.rs — files, dialogs, print, context menu, clipboard
.github/workflows/  CI builds every platform on a version tag
```

## Build
Install Rust and Node, then `npx @tauri-apps/cli@2 icon app-icon.png` once and `npx @tauri-apps/cli@2 dev`.
Release builds for Windows / macOS / Linux come from GitHub Actions when you push a tag like `v0.1.0`.

The UI also runs in a normal browser (`python3 -m http.server` in `ui/`) — saving downloads a file, opening uploads one.
