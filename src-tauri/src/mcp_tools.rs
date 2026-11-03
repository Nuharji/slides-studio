//! What Slides Studio offers over MCP (mcp.rs): reading a presentation and making a new one from an outline, with the
//! app's own layouts ("title" and "content" in app.js). Only .slides files are written, an existing one only with `overwrite`.

use crate::mcp;
use serde_json::{json, Value};

pub fn run() { mcp::serve("slides-studio", env!("CARGO_PKG_VERSION"), &tools(), &call) }

fn tools() -> Vec<Value> {
    let path = json!({"type": "string", "description": "Full path of the .slides file"});
    vec![
        mcp::tool("deck_read", "Reads a presentation: for each slide its texts and speaker notes.", json!({"path": path}), &["path"]),
        mcp::tool("deck_create", "Makes a new presentation from an outline: a title slide, then one slide per entry. Replaces an existing file only with overwrite.", json!({"path": path,
            "title": {"type": "string"}, "subtitle": {"type": "string"},
            "slides": {"type": "array", "items": {"type": "object", "properties": {"heading": {"type": "string"}, "bullets": {"type": "array", "items": {"type": "string"}}, "notes": {"type": "string"}}, "required": ["heading"]}},
            "overwrite": {"type": "boolean"}}), &["path", "title"]),
    ]
}

fn uid() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static N: AtomicU32 = AtomicU32::new(0);
    format!("m{:x}", N.fetch_add(1, Ordering::Relaxed))
}

fn text_el(x: u32, y: u32, w: u32, size: u32, head: bool, color: &str, text: &str) -> Value {
    json!({"id": uid(), "type": "text", "x": x, "y": y, "w": w, "h": 200, "rot": 0, "op": 1, "text": text, "size": size, "color": color,
        "font": if head { "t:head" } else { "t:body" }, "bold": head, "italic": false, "underline": false, "align": "left", "ph": true})
}

fn rect(x: u32, y: u32, w: u32, h: u32) -> Value {
    json!({"id": uid(), "type": "shape", "shape": "rect", "x": x, "y": y, "w": w, "h": h, "rot": 0, "op": 1, "fill": "t:accent", "stroke": null, "sw": 0, "radius": 24})
}

fn slide(els: Vec<Value>, notes: &str) -> Value { json!({"id": uid(), "bg": "t:bg", "els": els, "trans": "fade", "notes": notes}) }

fn deck(args: &Value) -> Result<Value, String> {
    let mut slides = vec![slide(vec![rect(0, 0, 40, 1080), text_el(140, 340, 1500, 120, true, "t:text", &mcp::text(args, "title")?),
        text_el(144, 620, 1400, 52, false, "t:accent", &mcp::opt_text(args, "subtitle"))], "")];
    for s in args.get("slides").and_then(Value::as_array).into_iter().flatten() {
        let bullets: Vec<String> = s.get("bullets").and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str).map(|b| format!("• {b}")).collect();
        slides.push(slide(vec![text_el(120, 80, 1680, 84, true, "t:text", &mcp::text(s, "heading")?), rect(124, 200, 160, 8),
            text_el(120, 270, 1680, 46, false, "t:text", &bullets.join("\n"))], &mcp::opt_text(s, "notes")));
    }
    Ok(json!({"version": 1, "theme": "studio", "slides": slides}))
}

fn read(p: &std::path::Path) -> Result<Value, String> {
    let doc = crate::load(p)?;
    let deck: Value = serde_json::from_str(&doc.content).map_err(|e| format!("{}: {e}", p.display()))?;
    let slides = deck["slides"].as_array().filter(|l| !l.is_empty()).ok_or_else(|| format!("{}: not a presentation", p.display()))?;
    let out: Vec<Value> = slides.iter().enumerate().map(|(i, s)| {
        let texts: Vec<&str> = s["els"].as_array().into_iter().flatten().filter_map(|e| e["text"].as_str()).filter(|t| !t.trim().is_empty()).collect();
        json!({"slide": i + 1, "texts": texts, "notes": s["notes"]})
    }).collect();
    Ok(json!({"theme": deck["theme"], "slides": out}))
}

fn call(name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "deck_read" => read(&mcp::path(args, "path")?),
        "deck_create" => {
            let p = mcp::path(args, "path")?;
            if !mcp::has_ext(&p, &["slides"]) { return Err(format!("{}: not a .slides file", p.display())); }
            let deck = deck(args)?;
            mcp::put(&p, deck.to_string().as_bytes(), mcp::flag(args, "overwrite"))?;
            Ok(json!({"path": p, "slides": deck["slides"].as_array().map_or(0, Vec::len)}))
        }
        _ => Err(format!("unknown tool: {name}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn outline_to_presentation() {
        let d = std::env::temp_dir().join(format!("slides-mcp-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        let p = d.join("Zelle.slides");
        let outline = json!({"path": p, "title": "Die Zelle", "subtitle": "Bio", "slides": [{"heading": "Aufbau", "bullets": ["Kern", "Membran"], "notes": "Langsam"}]});
        assert_eq!(call("deck_create", &outline).unwrap()["slides"], 2);
        assert!(call("deck_create", &outline).is_err(), "nothing is overwritten unless asked");
        assert!(call("deck_create", &json!({"path": d.join("x.sh"), "title": "T"})).is_err(), "only .slides files");

        let r = call("deck_read", &json!({"path": p})).unwrap();
        assert_eq!(r["slides"][0]["texts"], json!(["Die Zelle", "Bio"]));
        assert_eq!(r["slides"][1]["texts"], json!(["Aufbau", "• Kern\n• Membran"]));
        assert_eq!(r["slides"][1]["notes"], "Langsam");

        // What the app's validDeck asks for, and ids unique within the deck.
        let deck: Value = serde_json::from_str(&fs::read_to_string(&p).unwrap()).unwrap();
        let ids: Vec<&str> = deck["slides"].as_array().unwrap().iter().flat_map(|s| s["els"].as_array().unwrap()).map(|e| e["id"].as_str().unwrap()).collect();
        assert!(ids.iter().enumerate().all(|(i, a)| !ids[..i].contains(a)));
        fs::write(d.join("x.slides"), "{}").unwrap();
        assert!(call("deck_read", &json!({"path": d.join("x.slides")})).is_err());
        let _ = fs::remove_dir_all(d);
    }
}
