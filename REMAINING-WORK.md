# B2S Designer: Port Status

Status of the TypeScript port against the original VB.NET B2S Backglass Designer
(`/Users/jmillard/vpx/b2s-designer`). Everything not listed under "Intentionally not ported" is implemented.

## Design decisions that differ from the original

- The port edits `.directb2s` files directly. The original's `.b2s` project files, `.b2b` backups, the
  `Projects\<Name>` folder layout and the global `B2SBackglassDesigner.Import.xml` do not exist here.
  "Save Backup As" saves a copy under another name; "Open Backup" opens a `.directb2s`.
- Imported reel/LED image sets are stored inside the document (`<Reels><Images>` with `Imported*` names)
  instead of a machine-wide import file.
- Floating tool windows (Resources, Reels & LEDs, Illumination, History) are docked panels / dialogs.
- Multi-document tabs are separate windows on desktop and a single document on web.
- Saving regenerates the per-bulb lit images, reel image sets and bakes always-on bulbs into the background,
  so a saved file is always a valid B2S Server backglass. Always-on bulbs are therefore not editable after a
  reload (same as re-importing a `.directb2s` in the original).

## Intentionally not ported

| Original feature | Reason |
|---|---|
| Create 'MS Visual Studio 2010' backglass code (`Coding.CreateVisualStudioCode`) | Generates a legacy compiled-EXE backglass project; obsolete. `DestType` still round-trips. |
| VPinMAME test form (`formVPM`, `B2SVPinMAMEStarter`) | Windows COM / registry only. Use "Backglass Preview and Test" (static render + animation playback) instead. |
| Help Topics (`B2SBackglassDesigner.chm`) | No CHM viewer; no help file in the repo. |
| Recent list thumbnails / recent list on web | Desktop keeps recent paths in the native menu; the web build has no persistent file paths. |
| Screen-pixel "Get color" eyedropper in the color dialog | Not possible from a browser window. |

## Known approximations

- Dream7 LED glass/glow uses radial gradients per segment instead of GDI+ `PathGradientBrush`.
- Text bulbs use canvas text metrics (GDI `TextRenderer` sizes differ slightly).
- Reel image set export writes one save dialog per image (the original wrote a folder).

## Testing

- `npm run typecheck`, `npm run build:web`.
- A parse → write → parse round trip of a real `.directb2s` (e.g. `vpx-example-glf/VPXExampleGLF.directb2s`)
  must preserve header values, animations, scores, bulbs (except always-on) and produce `<Reels>` image sets
  for any EM/credit/LED reel type in use.
