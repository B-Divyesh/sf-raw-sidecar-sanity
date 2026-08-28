# Visual thesis — the preflight bench

RAW Sidecar Sanity is a mid-century instrument panel, not a generic file uploader. The page behaves like a careful technician's bench: a warm enamel faceplate, dark Bakelite controls, ruled inspection strips, stamped labels, and one amber readiness lamp. The visual metaphor makes comparison—the product's actual job—immediately legible without pretending to be a photo editor.

## Palette

The default treatment is a deliberately single-mode warm workshop palette; the painted background is explicit. Paper `#f2ead8`, enamel surface `#fffaf0`, ink `#252a27`, muted ink `#65675f`, panel green `#174f47`, amber `#c86e24`, safe `#176849`, warning `#8a4a13`, danger `#9b3228`, rule `#b8ad96`. All body/text combinations meet WCAG AA (4.5:1); status uses words, shapes, and icons as well as color. A second dark theme would dilute the physical faceplate metaphor, so the installed PWA retains this intentional light instrument treatment.

## Type and spacing

Headings and controls use the self-hosted system slab stack `Rockwell, Roboto Slab, Georgia, serif`; body and data use `Avenir Next, Segoe UI, system-ui, sans-serif`. No runtime font request is made. The scale is 14 / 16 / 20 / 28 / 42 px. Measurements use tabular figures and uppercase tracking only for short gauge labels. Spacing follows an 8 px rhythm with 4 px optical adjustments; the reading measure tops out near 68 characters.

## Interaction grammar

The main action is a wide dashed inspection tray. Dropping or choosing files moves them onto the bench; a short “sweep” reveals results. Tabs resemble labeled selector plates, but remain semantic buttons. Results are one comparison ledger rather than a wall of cards. The clearest issue is always first; filters never hide the total. Buttons depress by 1 px. Focus is a double amber/ink outline. At 390 px the ornamental gauge is removed, controls stack, and the comparison ledger becomes labeled rows.

## Motion policy

Only state changes move: the ready lamp brightens, newly analysed rows fade/translate 6 px over 180 ms, and the offline/update notices enter from their anchor. Nothing loops. Under `prefers-reduced-motion: reduce`, transitions and translation are removed and updates are instant.

## Asset plan and provenance

The hero illustration is an original, generated still-life of a 1960s photographic inspection console: paired negative holders, two measurement dials, contact-sheet geometry, and an amber indicator. It explains pairwise checking without implying that image pixels leave the device. It contains no people, brands, UI text, or logos. Simple interface symbols and PWA icons are hand-authored SVG geometry.

Prompt sheet: subject—paired RAW/JPEG negative carriers under two comparison gauges; world—1960s photographic lab inspection bench; materials—cream powder-coated steel, dark Bakelite, brushed brass, paper labels without text; light—soft directional studio light; lens—slightly elevated 50 mm still life; palette—warm ivory, forest/teal green, burnt orange, charcoal; negative list—no people, hands, brands, logos, readable text, watermark, gradients, modern computers, cameras, distorted dials.

Hero prompt (used verbatim): “Use case: stylized-concept. Asset type: wide landing-page hero illustration. Primary request: a precise mid-century photographic lab inspection console that visually compares a paired RAW negative holder and JPEG contact print using two matching circular measurement gauges and one amber status lamp. Scene/backdrop: clean 1960s technician workbench. Style/medium: tactile editorial still-life illustration, restrained screenprint texture, realistic geometry. Composition/framing: wide 3:2, elevated 50 mm view, console weighted to centre and right, calm negative space. Lighting/mood: soft directional studio light, meticulous and reassuring. Color palette: warm ivory, forest teal, burnt orange, charcoal. Materials/textures: cream powder-coated steel, dark Bakelite, brushed brass, paper labels with no writing. Constraints: original fictional equipment; no people; no brands; no readable text; no logo; no watermark. Avoid: gradients, neon, modern computers, cameras, malformed gauges, meaningless symbols.”

Generated with the factory Azure image deployment (`factory-image`), 2026-08-28. Original PNG and prompt sidecar live in `assets/src/`; shipped WebP is optimized to ≤300 KB. Generated imagery is original to this product under the project MIT license.
