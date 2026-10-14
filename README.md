# Slides Studio (Rust / Tauri)

Presentation editor of the Studio family — made for students and teachers: drag-and-drop layouts like Canva,
works offline, no account. The native shell is Rust ([Tauri 2](https://tauri.app)); the UI is plain HTML/JS in `ui/`.

## Features (0.2.0)
- Fixed 16:9 canvas; **text, shapes (8), images, tables**; drag, resize, rotate, snap guides, multi-select
- Tables: hover grid to insert, double-click a cell to type, Tab / Shift+Tab to move, rows/columns +/−, header row
- **Layouts** (title, content, two columns, image + text, quote, section, big statement) and **7 themes**
- Theme colors/fonts are tokens, so one click re-themes the whole deck
- Slide filmstrip with drag-to-reorder, duplicate, delete, per-slide background (color / gradient) and transition
- **Present mode** (F5, full screen, arrows / click, B = black), speaker notes
- **Presenter view** (Alt+F5, or P while presenting): second window with current + next slide, notes, timer and
  remote controls — drag it to your laptop screen while the slides run on the projector
- Export as **PowerPoint (.pptx)**, **PDF** (print dialog → "Save as PDF") and as a **standalone HTML slideshow**
- Undo/redo, copy/paste, autosave recovery, German/English UI, dark/light, auto-hide bars
- Files are plain JSON (`.slides`)

Not yet: animations inside a slide, charts, speaker notes and transitions in the PPTX file, importing .pptx.

## Layout
```
ui/                 index.html, app.js (editor + presenter view), pptx.js (PowerPoint writer),
                    native.js + autohide.js (shared Studio shell)
src-tauri/src/      main.rs — files, dialogs, print, context menu, clipboard
.github/workflows/  CI builds every platform on a version tag
```

## Build
Install Rust and Node, then `npx @tauri-apps/cli@2 icon app-icon.png` once and `npx @tauri-apps/cli@2 dev`.
Release builds for Windows / macOS / Linux come from GitHub Actions when you push a tag like `v0.1.0`.

The UI also runs in a normal browser (`python3 -m http.server` in `ui/`) — saving downloads a file, opening uploads one.
