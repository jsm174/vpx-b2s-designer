# B2S Designer Testing Plan

## Framework

**Vitest** — native Vite integration, TypeScript support, zero-config.

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

No config file needed — Vitest auto-detects the existing Vite setup.

## Test File Structure

```
src/format/__tests__/
├── round-trip.test.ts     # Parse → write → parse → compare
├── parser.test.ts         # Parser unit tests
├── writer.test.ts         # Writer unit tests
└── helpers.ts             # Shared test utilities
```

---

## 1. Round-Trip Tests (highest value)

The most important test: parse XML → write it back → parse again → compare every field.

```typescript
import { describe, it, expect } from 'vitest';
import { parseDirectB2S } from '../parser';
import { writeDirectB2S } from '../writer';

function roundTrip(xml: string) {
  const first = parseDirectB2S(xml);
  const written = writeDirectB2S(first);
  const second = parseDirectB2S(written);
  return { first, second, written };
}

describe('round-trip: parse → write → parse', () => {
  it('preserves metadata', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value="Test Table"/>
      <TableType Value="2"/>
      <DMDType Value="1"/>
      <DMDDefaultLocation LocX="100" LocY="200"/>
      <GrillHeight Value="500" Small="100"/>
      <ProjectGUID Value="abc-123"/>
      <AssemblyGUID Value="def-456"/>
      <VSName Value="TestVS"/>
      <DualBackglass Value="1"/>
      <Author Value="Test Author"/>
      <Artwork Value="Test Art"/>
      <GameName Value="test_rom"/>
      <AddEMDefaults Value="1"/>
      <CommType Value="2"/>
      <DestType Value="2"/>
      <NumberOfPlayers Value="2"/>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.name).toBe(first.name);
    expect(second.tableType).toBe(first.tableType);
    expect(second.dmdType).toBe(first.dmdType);
    expect(second.dmdDefaultLocationX).toBe(first.dmdDefaultLocationX);
    expect(second.dmdDefaultLocationY).toBe(first.dmdDefaultLocationY);
    expect(second.grillHeight).toBe(first.grillHeight);
    expect(second.smallGrillHeight).toBe(first.smallGrillHeight);
    expect(second.commType).toBe(first.commType);
    expect(second.destType).toBe(first.destType);
    expect(second.numberOfPlayers).toBe(first.numberOfPlayers);
    expect(second.author).toBe(first.author);
    expect(second.dualBackglass).toBe(first.dualBackglass);
  });

  it('preserves animations with steps', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Animations>
        <Animation Name="FlashAll" DualMode="0" Interval="150" Loops="3"
                   IDJoin="" StartAnimationAtRomStart="True"
                   LightAtStart="1" LightAtEnd="2"
                   AnimationStopBehaviour="1" LockAtLastStep="True"
                   HideAtStart="True" BringToFront="True"
                   RandomStart="True" RandomQuality="5">
          <AnimationStep Step="0" On="1,2,3" WaitLoopsAfterOn="2"
                         Off="4,5" WaitLoopsAfterOff="1" PulseSwitch="3"/>
          <AnimationStep Step="1" On="4,5" WaitLoopsAfterOn="1"
                         Off="1,2,3" WaitLoopsAfterOff="0"/>
        </Animation>
      </Animations>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.animations).toHaveLength(1);
    const a = second.animations[0];
    expect(a.name).toBe('FlashAll');
    expect(a.interval).toBe(150);
    expect(a.loops).toBe(3);
    expect(a.startAnimationAtRomStart).toBe(true);
    expect(a.lightAtStart).toBe('On');
    expect(a.lightAtEnd).toBe('NoChange');
    expect(a.animationStopBehaviour).toBe('RunTillEnd');
    expect(a.lockAtLastStep).toBe(true);
    expect(a.hideAtStart).toBe(true);
    expect(a.bringToFront).toBe(true);
    expect(a.randomStart).toBe(true);
    expect(a.randomQuality).toBe(5);
    expect(a.steps).toHaveLength(2);
    expect(a.steps[0].on).toBe('1,2,3');
    expect(a.steps[0].off).toBe('4,5');
    expect(a.steps[0].waitLoopsAfterOn).toBe(2);
    expect(a.steps[0].pulseSwitch).toBe(3);
  });

  it('preserves scores', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="1"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Scores>
        <Score ID="1" Parent="Backglass" ReelType="Dream7LED8"
               ReelLitColor="255.120.0" ReelDarkColor="15.15.15"
               Glow="1500" Thickness="2000" Shear="10"
               Digits="7" Spacing="5" DisplayState="0"
               LocX="100" LocY="200" Width="300" Height="50"
               B2SStartDigit="1" B2SScoreType="2" B2SPlayerNo="1"/>
        <Score ID="2" Parent="DMD" ReelType="Dream7LED14"
               ReelLitColor="0.255.0"
               Digits="16" Spacing="3" DisplayState="0"
               LocX="50" LocY="500" Width="800" Height="100"
               Visible="0"/>
      </Scores>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.scores).toHaveLength(2);
    expect(second.scores[0].reelType).toBe(first.scores[0].reelType);
    expect(second.scores[0].digits).toBe(7);
    expect(second.scores[0].locX).toBe(100);
    expect(second.scores[1].parent).toBe('DMD');
    expect(second.scores[1].visible).toBe(false);
  });

  it('preserves bulbs with all properties', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Illumination>
        <Bulb Parent="Backglass" ID="1" Name="L01" RomID="1" RomIDType="1"
              RomInverted="1" InitialState="1" DualMode="2" Intensity="4"
              LightColor="255.200.100" DodgeColor="128.64.32"
              Visible="1" LocX="100" LocY="200" Width="50" Height="60"
              IsImageSnippit="0" Image=""
              Text="TEST" TextAlignment="1" FontName="Arial" FontSize="14" FontStyle="1"
              B2SID="5" B2SIDType="1"
              SnippetRotatingDirection="1" IlluminationMode="1" ZOrder="3"/>
        <Bulb Parent="DMD" ID="2" Name="S01" RomID="25" RomIDType="2"
              RomInverted="0" InitialState="0" DualMode="0" Intensity="1"
              LightColor="255.254.232" DodgeColor="0.0.0"
              Visible="1" LocX="0" LocY="0" Width="100" Height="100"
              IsImageSnippit="1" Image="iVBORw0KGgo="
              Text="" TextAlignment="0" FontName="" FontSize="12" FontStyle="0"/>
      </Illumination>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.illumination).toHaveLength(2);

    const b1 = second.illumination[0];
    expect(b1.name).toBe('L01');
    expect(b1.romId).toBe(1);
    expect(b1.romIdType).toBe('Lamp');
    expect(b1.romInverted).toBe(true);
    expect(b1.initialState).toBe('On');
    expect(b1.dualMode).toBe('Fantasy');
    expect(b1.intensity).toBe(4);
    expect(b1.lightColor.r).toBe(255);
    expect(b1.lightColor.g).toBe(200);
    expect(b1.lightColor.b).toBe(100);
    expect(b1.text).toBe('TEST');
    expect(b1.b2sId).toBe(5);
    expect(b1.b2sIdType).toBe('Cyclic');
    expect(b1.snippetRotatingDirection).toBe('Clockwise');
    expect(b1.illuminationMode).toBe('Flasher');
    expect(b1.zOrder).toBe(3);

    const b2 = second.illumination[1];
    expect(b2.parent).toBe('DMD');
    expect(b2.romIdType).toBe('Solenoid');
    expect(b2.isImageSnippet).toBe(true);
    expect(b2.imageData).toBe('iVBORw0KGgo=');
  });

  it('preserves images (new format)', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Images>
        <ThumbnailImages>
          <MainImage Image="dGh1bWI="/>
        </ThumbnailImages>
        <BackgroundImages>
          <MainImage FileName="bg.png" Image="YmcxZGF0YQ==" Type="0" RomID="0" RomIDType="0"/>
          <Image FileName="bg2.png" Image="YmcyZGF0YQ==" Type="1" RomID="5" RomIDType="1"/>
        </BackgroundImages>
        <IlluminatedImages>
          <Image FileName="illum.png" Image="aWxsdW0="/>
        </IlluminatedImages>
        <DMDImages>
          <MainImage FileName="dmd.png" Image="ZG1kMQ=="/>
          <Image FileName="dmd2.png" Image="ZG1kMg=="/>
        </DMDImages>
      </Images>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.images.backgroundImages).toHaveLength(2);
    expect(second.images.backgroundImages[0].imageData).toBe('YmcxZGF0YQ==');
    expect(second.images.backgroundImages[1].fileName).toBe('bg2.png');
    expect(second.images.illuminatedImages).toHaveLength(1);
    expect(second.images.illuminatedImages[0].imageData).toBe('aWxsdW0=');
    expect(second.images.dmdImages).toHaveLength(2);
    expect(second.images.thumbnailImage).toBe('dGh1bWI=');
  });

  it('preserves images (old format)', () => {
    const xml = `<DirectB2SData Version="1.2">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Images>
        <BackglassImage Value="YmcxZGF0YQ==" FileName="bg.png"/>
        <DMDImage Value="ZG1kMQ==" FileName="dmd.png"/>
        <ThumbnailImage Value="dGh1bWI="/>
      </Images>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.images.backgroundImages).toHaveLength(1);
    expect(second.images.backgroundImages[0].imageData).toBe('YmcxZGF0YQ==');
    expect(second.images.dmdImages).toHaveLength(1);
    expect(second.images.thumbnailImage).toBe('dGh1bWI=');
  });

  it('preserves reels', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Reels ReelCountOfIntermediates="10" ReelRollingDirection="1" ReelRollingInterval="30">
        <Images>
          <Image Name="digit0" CountOfIntermediates="10" Image="cmVlbDA="/>
          <Image Name="digit1" CountOfIntermediates="10" Image="cmVlbDE="/>
        </Images>
      </Reels>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.reels.countOfIntermediates).toBe(10);
    expect(second.reels.rollingDirection).toBe('Down');
    expect(second.reels.rollingInterval).toBe(30);
    expect(second.reels.images).toHaveLength(2);
    expect(second.reels.images[0].name).toBe('digit0');
  });

  it('handles empty file', () => {
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/>
      <TableType Value="2"/>
      <DMDType Value="0"/>
      <GrillHeight Value="0"/>
      <CommType Value="1"/>
      <DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
    </DirectB2SData>`;

    const { first, second } = roundTrip(xml);
    expect(second.animations).toHaveLength(0);
    expect(second.scores).toHaveLength(0);
    expect(second.illumination).toHaveLength(0);
    expect(second.images.backgroundImages).toHaveLength(0);
  });
});
```

---

## 2. Parser Unit Tests

```typescript
describe('parseColor', () => {
  it('parses period-separated RGB (real B2S format)', () => {
    // parseColor is private, test via bulb LightColor parsing
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/><TableType Value="2"/><DMDType Value="0"/>
      <GrillHeight Value="0"/><CommType Value="1"/><DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Illumination>
        <Bulb Parent="Backglass" ID="1" Name="" RomID="0" RomIDType="1"
              RomInverted="0" InitialState="0" DualMode="0" Intensity="1"
              LightColor="255.120.0" DodgeColor="0.0.0"
              Visible="1" LocX="0" LocY="0" Width="50" Height="50"
              IsImageSnippit="0" Text="" TextAlignment="0"
              FontName="" FontSize="12" FontStyle="0"/>
      </Illumination>
    </DirectB2SData>`;

    const data = parseDirectB2S(xml);
    expect(data.illumination[0].lightColor).toEqual({ r: 255, g: 120, b: 0, a: 255 });
  });

  it('parses comma-separated ARGB (fallback format)', () => {
    // Some files may use commas — support both
    const xml = `<DirectB2SData Version="1.27">
      <Name Value=""/><TableType Value="2"/><DMDType Value="0"/>
      <GrillHeight Value="0"/><CommType Value="1"/><DestType Value="1"/>
      <NumberOfPlayers Value="4"/>
      <Illumination>
        <Bulb Parent="Backglass" ID="1" Name="" RomID="0" RomIDType="1"
              RomInverted="0" InitialState="0" DualMode="0" Intensity="1"
              LightColor="200,255,120,0" DodgeColor="0,0,0,0"
              Visible="1" LocX="0" LocY="0" Width="50" Height="50"
              IsImageSnippit="0" Text="" TextAlignment="0"
              FontName="" FontSize="12" FontStyle="0"/>
      </Illumination>
    </DirectB2SData>`;

    const data = parseDirectB2S(xml);
    expect(data.illumination[0].lightColor).toEqual({ a: 200, r: 255, g: 120, b: 0 });
  });
});

describe('parseDirectB2S', () => {
  it('throws on invalid XML', () => {
    expect(() => parseDirectB2S('not xml')).toThrow();
  });

  it('throws on missing root element', () => {
    expect(() => parseDirectB2S('<?xml version="1.0"?><Foo/>')).toThrow('missing DirectB2SData');
  });

  it('parses all table types', () => {
    for (const [val, expected] of [['1','EM'],['2','SS'],['3','SSDMD'],['4','ORI']]) {
      const xml = `<DirectB2SData Version="1.27">
        <Name Value=""/><TableType Value="${val}"/><DMDType Value="0"/>
        <GrillHeight Value="0"/><CommType Value="1"/><DestType Value="1"/>
        <NumberOfPlayers Value="4"/>
      </DirectB2SData>`;
      expect(parseDirectB2S(xml).tableType).toBe(expected);
    }
  });

  it('parses all ROM ID types', () => {
    // 1=Lamp, 2=Solenoid, 3=GIString
  });

  it('parses boolean fields correctly', () => {
    // Test "1", "True", "0", "False", missing attribute
  });

  it('handles DMDDefaultLocation as element or attributes', () => {
    // Old format: <DMDDefaultLocation LocX="..." LocY="..."/>
    // Fallback: <DMDDefaultLocationX Value="..."/>
  });

  it('cleans whitespace from base64 data', () => {
    // Verify cleanBase64 strips \r\n\s from image data
  });
});
```

---

## 3. Writer Unit Tests

```typescript
describe('writeDirectB2S', () => {
  it('produces valid XML', () => {
    const data = createEmptyDirectB2S();
    const xml = writeDirectB2S(data);
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('<DirectB2SData');
    expect(xml).toContain('</DirectB2SData>');
  });

  it('escapes XML special characters', () => {
    const data = createEmptyDirectB2S();
    data.name = 'Test & "Table" <1>';
    const xml = writeDirectB2S(data);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });

  it('writes colors in R.G.B format', () => {
    const data = createEmptyDirectB2S();
    data.illumination = [createDefaultBulb(1)];
    data.illumination[0].lightColor = { r: 255, g: 120, b: 0, a: 255 };
    const xml = writeDirectB2S(data);
    expect(xml).toContain('LightColor="255.120.0"');
  });

  it('omits empty sections', () => {
    const data = createEmptyDirectB2S();
    const xml = writeDirectB2S(data);
    expect(xml).not.toContain('<Animations>');
    expect(xml).not.toContain('<Scores>');
    expect(xml).not.toContain('<Illumination>');
  });

  it('writes conditional animation attributes only when non-default', () => {
    // Verify StartAnimationAtRomStart only written when true
    // Verify LightAtStart only written when not 'Off'
    // etc.
  });

  it('writes all background images, not just first', () => {
    const data = createEmptyDirectB2S();
    data.images.backgroundImages = [
      { fileName: 'bg1.png', imageData: 'abc', romId: 0, romIdType: 'Lamp', type: '0' },
      { fileName: 'bg2.png', imageData: 'def', romId: 5, romIdType: 'Lamp', type: '1' },
    ];
    const xml = writeDirectB2S(data);
    expect(xml).toContain('<MainImage');
    expect(xml).toContain('bg1.png');
    expect(xml).toContain('bg2.png');
  });

  it('writes illuminated images section', () => {
    const data = createEmptyDirectB2S();
    data.images.illuminatedImages = [
      { fileName: 'illum.png', imageData: 'xyz' },
    ];
    const xml = writeDirectB2S(data);
    expect(xml).toContain('<IlluminatedImages>');
    expect(xml).toContain('illum.png');
  });
});
```

---

## 4. Additional Test Ideas

### Edge Cases
- XML with extra/unknown elements (should be ignored gracefully)
- Very long base64 strings
- Empty string attributes vs missing attributes
- Unicode characters in names and text fields
- Score with no ReelDarkColor (optional field)
- Bulb with no DodgeColor (optional field)
- GrillHeight with and without Small attribute
- DMDCopyArea when all values are 0 (should be omitted in writer)

### Regression Tests
- Color parsing: `"255.120.0"` (3-part period), `"200,255,120,0"` (4-part comma), `""` (empty), `"0.0.0"` (zero)
- Boolean parsing: `"1"`, `"True"`, `"true"`, `"0"`, `"False"`, `null`
- Writer doesn't produce duplicate XML attributes on any element

### Future: Integration Tests
Once Playwright is added, test the full app:
- Open a .directb2s file via the UI
- Verify canvas renders
- Save the file
- Re-open and verify data matches

These require browser/Electron context and are a separate effort.
