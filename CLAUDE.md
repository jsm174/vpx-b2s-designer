# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

B2S Designer is a cross-platform backglass editor for Visual Pinball. It runs as both an Electron desktop app and a web application, sharing ~95% of the codebase. This is a TypeScript port of the original B2S Backglass Designer (VB.NET Windows Forms application).

### What is B2S?

B2S (Backglass 2nd Screen) creates `.directb2s` files that define:
- **Backglass imagery** - The artwork displayed above the pinball playfield
- **Illumination** - Lights/bulbs that animate and respond to game events
- **Score displays** - Animated reel or LED score displays
- **Animations** - Sequences of lamp state changes timed to ROM events
- **DMD support** - Dot Matrix Display for modern pinball machines

### The .directb2s File Format

DirectB2S files are XML documents with base64-encoded images:

```xml
<DirectB2SData Version="1.27">
  <Name Value="..." />
  <TableType Value="..." />           <!-- EM, SS, SSDMD, ORI -->
  <DMDType Value="..." />             <!-- None, Built-in, External -->
  <CommType Value="..." />            <!-- 1=ROM, 2=B2S -->

  <Animations>
    <Animation Name="..." Interval="..." Loops="...">
      <AnimationStep Step="0" On="1,2,3" Off="4,5" WaitLoopsAfterOn="2" />
    </Animation>
  </Animations>

  <Scores ReelType="..." ReelRollingDirection="..." ReelRollingInterval="...">
    <Score ID="1" Digits="7" LocX="..." LocY="..." Width="..." Height="..." />
  </Scores>

  <Illumination>
    <Bulb ID="1" Name="..." RomID="..." LightColor="255,255,0"
          LocX="100" LocY="200" Width="50" Height="50" Intensity="3" />
  </Illumination>

  <Images>
    <BackgroundImages>
      <MainImage FileName="..." Image="iVBORw0KGgo..." />  <!-- Base64 PNG -->
    </BackgroundImages>
    <IlluminatedImages>...</IlluminatedImages>
    <ThumbnailImages>...</ThumbnailImages>
  </Images>
</DirectB2SData>
```

## Commands

```bash
npm start          # Launch desktop app with hot reload
npm run dev:web    # Launch web version on port 3000
npm run build:web  # Build production web app to dist-web/
npm run make       # Create distributable packages for current platform
npm run typecheck  # TypeScript type checking
npm run format     # Format code with Prettier
```

## Architecture

### Dual Build System

**Important**: Desktop and web must share as much HTML, CSS, and code as possible. Avoid platform-specific duplication. If a feature can be implemented with shared code, it should be.

The project builds for both Electron and web browsers:
- **Electron**: Uses Electron Forge + Vite (`vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`)
- **Web**: Uses Vite (`vite.web.config.ts`), outputs to `dist-web/`

### Platform Abstraction

Platform-specific code lives in `src/platform/`:
- `src/platform/desktop/` - Electron implementations (native fs, dialogs, electron-store)
- `src/platform/web/` - Web implementations (File API, localStorage, OPFS)

The editor communicates with the platform via `window.b2sDesignerAPI` interface, implemented by preload scripts (Electron) or `src/web/index.ts` (web).

### Key Directories

```
src/
├── desktop/        # Electron main process (main.ts, window management, file I/O)
├── web/            # Web entry point
├── preload/        # Electron preload scripts (IPC bridge)
├── platform/       # Platform abstraction layer
├── editor/         # Shared editor code
│   ├── canvas/     # 2D canvas rendering
│   ├── components/ # UI components
│   └── undo/       # Undo/redo system
├── features/       # Feature modules
│   ├── illumination/   # Bulb editing
│   ├── animations/     # Animation editor
│   ├── scores/         # Score/reel editor
│   └── images/         # Image manager
├── format/         # DirectB2S file format
│   ├── parser.ts   # XML parsing
│   ├── writer.ts   # XML generation
│   └── types.ts    # Data types
├── shared/         # Utilities, constants
└── types/          # TypeScript definitions
```

### HTML Conditional Code

The build uses `@electron-only` and `@web-only` HTML comment markers, stripped by a custom Vite plugin (`src/build/vite-plugin-html-transform.ts`).

## Dependencies

- `three` - 3D rendering (for preview)
- `monaco-editor` - Code/text editor (if needed)
- `electron` / `@electron-forge/*` - Desktop framework and packaging

## Code Style

- TypeScript strict mode
- Prettier: 2 spaces, single quotes, 120 char width
- No unused variables/parameters allowed
- No comments unless absolutely necessary

## B2S Domain Knowledge

### Table Types
- **EM** - Electromechanical (older machines with mechanical score reels)
- **SS** - Solid State (electronic, no DMD)
- **SSDMD** - Solid State with DMD
- **ORI** - Original (authentic recreation)

### Communication Types
- **ROM (1)** - Direct communication with PinMAME ROM outputs
- **B2S (2)** - Custom B2S protocol

### ROM ID Types
- **Lamp (1)** - Lamp matrix outputs
- **Solenoid (2)** - Solenoid outputs
- **GI String (3)** - General Illumination

### Reel Types
- **EMR_T1-T6** - Electromechanical reel styles
- **Dream7** - 7-segment LED displays
- **Modern** - Digital/rendered reels

### Bulb Properties
- **RomID** - Maps to ROM output number
- **LightColor** - ARGB color when lit
- **DodgeColor** - 3D lighting effect color
- **Intensity** - Brightness level (1-5)
- **Parent** - "Backglass" or "DMD"

## Porting Guidelines

This is a port of the VB.NET B2S Backglass Designer. Goals:
- Be **faithful to the original** - match behavior where possible
- Use the same file format version (1.27)
- Preserve all data on load/save (no data loss)
- Support the same features (illumination, animations, scores, images)

When in doubt, reference the original VB.NET source code at `/Users/jmillard/vpx/b2s-designer`.

## Implementation Details

### File format

The port edits `.directb2s` files directly (no `.b2s`/`.b2b` project files). `src/format/parser.ts` and
`src/format/writer.ts` follow `Coding.vb` (`CreateDirectB2SFile` / `ImportDirectB2SFile`) in the original,
which is also what B2S Server (`vpinball/plugins/b2slegacy`) reads. Key points:

- `<Images>` is flat: `BackglassImage` (or `BackglassOffImage` + `BackglassOnImage`), `DMDImage`,
  `IlluminationImage`, `ThumbnailImage`, each with a `Value` attribute.
- Every non-snippet `<Bulb>` carries a rendered `Image` (the lit crop of the background) and, when an Off
  background exists, an `OffImage`. The writer regenerates these on every save with
  `src/editor/illumination-render.ts`. Bulbs with `InitialState=2` (always on) are baked into the background
  image and omitted from `<Illumination>`, exactly like the original.
- `<Reels>` image sets (`EMR_T*`, `EMR_CT*`, `LED*`), their `IntermediateImageN` rolling frames and the
  `<IlluminatedImages><Set>` blocks are generated from `public/reels` and `public/images/leds` at save time.
- Rolling settings live on `<Scores>` (`ReelCountOfIntermediates`, `ReelRollingDirection="Up|Down"`,
  `ReelRollingInterval`) and in the header. `Glow`/`Thickness`/`Shear` are backglass-wide (`D7*` ×100).
- Animation attributes are `StartAnimationAtBackglassStartup`, `LightsStateAtAnimationStart/End` (1..4),
  `AnimationStopBehaviour` (1..3), `LockInvolvedLamps`, `HideScoreDisplays`, `BringToFront`, `RandomStart`.
- `B2SIDType` is the 0..11 enum, `RomIDType` 0..3 (4 = mech snippet, RomID = mech ID), `IlluMode`,
  `FontSize` ×100, `SnippitRotatingDirection` 0=Clockwise 1=AntiClockwise.

The writer is async (`writeDirectB2S(data, assets)`); `serializeCurrentData()` in `src/editor/main.ts`
supplies the loaded images and reel resources.

### Illumination Rendering

Matches `B2SPictureBox.vb` / `Lights.vb` / `LightsCreation.vb`:

- **Show Illumination** (fixed): one light layer with every non-snippet bulb's shape, merged with
  `C_OVERLAYS = 2` and the **default light color** (255,254,232) — per-bulb colors are ignored. Snippets are
  drawn on top.
- **Show Illumination with Accurate Intensity**: per-bulb sprites with the bulb's intensity, light color and
  dodge color.
- When an illumination image is selected in the Resources panel, Show Illumination copies each bulb's region
  from that image instead.
- With both Frames and Illumination on, snippets are drawn twice (frame pass + illumination pass), matching the
  original's brighter look.
- Light shape: ellipse path gradient (focus 0.15, center offset −5px), Flasher mode adds a 4-point star, text
  bulbs use a transparent→white→transparent diagonal gradient and 30/255 center alpha.

**ColorOverlay formula** (from VB.NET `LightsCreation.vb`):
```
if (pixel < 128)
  result = (2 * lightColor * pixel) / 255
else
  result = 255 - (2 * (255 - lightColor) * (255 - pixel)) / 255
```
**ColorDodge**: `b == 255 ? 255 : min(255, (a << 8) / (255 - b))`.

### Reels and LEDs

- Reel/LED types are chosen backglass-wide (Reels & LEDs → Choose reel or LED types...), stored in
  `data.reelTypes`; each score picks one of them. `src/editor/reel-render.ts` resolves the single reel image.
- `src/editor/dream7.ts` ports the Dream7 segment display (glass/glow path gradients, shear), and
  `src/editor/rendered-led.ts` the plain polygon LEDs (30×40, all segments lit).
- Single reel width: `(W - spacing/2 * (digits-1)) / digits`, decremented until `width*digits <= W-1`.

### Editor behaviours ported from the original

Click-to-top stacking, 6px edge-band resizing (not for snippets), the selected frame's remove "X", Ctrl+Shift+click
to pick the item underneath, right-click item picker with hover preview, Ctrl+Arrow resize, keys 1–5 set
intensity, O/R/G/B/Y/M/P/W toggle dodge colour, wheel scrolls / Ctrl+wheel scrolls horizontally /
Alt(Cmd)+wheel zooms through the fixed zoom steps, last bulb/score settings are reused for new frames, the lamp
filter pre-fills new bulbs and limits hit testing, dropped PNGs become snippets at the drop point with ROM info
parsed from the file name (`S12`, `iL14`, `Gi2`).

## Related Repositories

- Original B2S source: `/Users/jmillard/vpx/b2s-designer`
- VPX Editor (reference for architecture): `/Users/jmillard/vpx/vpx-editor`
- vpinball source: `/Users/jmillard/vpx/vpinball-macos`
