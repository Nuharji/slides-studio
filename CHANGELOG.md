# Changelog

## 0.3.2
- The window and taskbar icon is now the app icon (the same picture as the installed app).
- Bold, italic, underline and text alignment moved into the tool rail on the left (like Markdown and Data Studio); they show the selected text's state. The option bar keeps font, size and color.

## 0.3.1
- Shared with all Studio apps (shared.rs / shared.js): theme and language follow the other apps and Studio Hub (also when you switch windows), and file dialogs open in the work folder chosen in Studio Hub.

## 0.3.0
- Same look and controls as the other Studio apps: menu bar with the app tile, option bar, tool rail, document tabs,
  panels on the right (Layouts, Designs, Slide, Notes), status bar with zoom, start screen with recent files.
- The four app themes (Dark, Light, GitHub, GitHub Dark), settings dialog (Ctrl+,) and customizable shortcuts (shortcuts.js).
- Several presentations open at once in tabs; the session (open tabs, settings) is restored on start.
- Texts in src-tauri/i18n/*.json, served by Rust like in the other apps.

## 0.2.0
- Tables: insert from a hover grid, edit cells in place (Tab moves on), add/remove rows and columns, header color.
- Export as PowerPoint (.pptx): text, shapes, pictures (fit/fill/stretch), tables, backgrounds incl. gradients,
  rotation and opacity. Written without libraries (own ZIP + OOXML writer).
- Presenter view: second window with current/next slide, notes, timer and controls (Alt+F5, or P while presenting).

## 0.1.0 — first version
- New app: canvas editor with text, shapes and images; layouts, themes, filmstrip, present mode,
  PDF and HTML slideshow export, undo/redo, autosave recovery, DE/EN.
