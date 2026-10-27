# FrameCraft

A standalone, browser-based framing simulator. Open `index.html` directly in a desktop browser; the simulator needs no server, runtime libraries, or Internet connection.

Downloadable, self-contained HTML versions are kept in `releases/`. **Use v5 for wheel positioning across all materials, direct support seating, and an unobstructed preview.** Export an existing build to JSON before changing versions, then import it into the new file if your browser does not share its autosave between filenames.

## Building controls

- Move the mouse to look and use **WASD** to fly immediately. **Space** rises, **Shift** descends, and **Ctrl** moves faster.
- The first movement key or building click captures the mouse for continuous turning. **Esc** cancels the current action without freezing mouse look or erasing its hotbar shortcut. Browsers release capture on Escape; passive mouse look continues, and the next movement key or scene click recaptures it. The system pointer stays hidden over the scene.
- **E** opens inventory; **C** opens a compact adjustment panel. Common controls are visible immediately; exact coordinates, angles, and detailed snap options stay under Advanced.
- Click to place the exact preview. Hold the left button and draw to length; mouse look and WASD remain available while the starting grip stays fixed in the world.
- Press **0 / V** for selection. Click a loose piece, drag its body to move it along the grabbed face, or aim at an end handle and drag to resize it. The opposite end remains fixed. Drag an assembly to move its components and recipe together.
- **R** changes the run direction, including during a drag; **Shift+R** reverses it. Turning horizontal stock preserves its section height. **F** turns the cross-section and **X** changes the grip.
- **Outside / Middle / Inside** are direct support-position choices in C and the context bar; **B** cycles them. For a perpendicular joist, the selected grip lands on the chosen support face. For a parallel or vertical piece, its footprint aligns to that edge. Foundation sides follow the outline, including concave corners.
- **Wheel** shifts the held or selected piece by the chosen **Move by** amount: actual material thickness, 16 inches, 24 inches, Fine, or Custom. Custom reveals one number field and accepts feet, decimals, or fractions. **Shift + wheel** uses the fine increment. The same control works for all 31 loose materials and selected assemblies; it never changes the hotbar material.
- Aim at a neighboring side face, or near its top edge, for snug placement with matching ends and base elevation. This works with every grip and follows rotated stock or sheet surfaces. Large blue cubes have been removed; only faint previews and small screen markers remain.
- Ends, midpoints, and layout marks snap automatically. Butt joints take priority over layout marks; drawing stops at the first blocking piece. Advanced exposes layout spacing, first-mark offset, grid precision, and target toggles. Hold **Alt** for slower camera movement and freehand fine adjustment; **N** toggles all snapping.
- **T** cycles targets, right-click removes a component, and **Ctrl+Z / Ctrl+Y** undo and redo.

The material inventory includes framing lumber, panels, custom timbers, foundation components, wall/floor/roof recipes, chalk lines, and a tape measure. Sloped panels follow the orientation of the supporting surface. Loose lumber retains its selected run direction; component rotations can also be edited in the inspector.

## Development

Use the existing checkout at `/workspace/framingsim`; a separate Git worktree is unnecessary in an isolated cloud task.

```sh
npm ci
npm run dev
```

The development server uses Python 3 and listens on port 8000. The app can also be opened directly as a local HTML file.

```sh
npm test
```

Tests run the actual application in Chromium through Playwright. They use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when provided, `/usr/bin/chromium` when installed, or Playwright's bundled Chromium. On another machine without Chromium, run `npx playwright install chromium` first.

The regression suite covers stock dimensions, grips, surface contact, collisions, repeated placement, sloped sheets, diagonal joins, snap controls, wheel positioning, measurement input, immediate movement, browser saving/export, and undo/redo. Its material matrices exercise 4,080 click-placement combinations and 248 snug face placements, plus wheel movement across all 31 loose materials. Held on-center presets reference the neighboring joist center rather than adding stock thickness to the intended spacing. These checks cover the implemented placement rules; further real-world framing scenarios can be added as reproducible tests.

## Releases

- `releases/FrameCraft-Precision-Build-v1.html`: initial grip, stud placement, repetition, and snap-control fixes.
- `releases/FrameCraft-Precision-Build-v2.html`: immediate movement plus expanded contact, collision, chalk-line, sloped-panel, and measurement fixes.
- `releases/FrameCraft-Precision-Build-v3.html`: automatic mouse capture, a quiet scene with precision controls behind C, direct body/end editing, assembly movement, and labeled end/midpoint/custom-layout inference.
- `releases/FrameCraft-Precision-Build-v4.html`: live mouse look and flight while drawing, working direction/reverse controls, selectable concrete seating, and direct adjacent-piece/butt-joint inference.
- `releases/FrameCraft-Precision-Build-v5.html`: wheel positioning by actual thickness, common spacing, or custom amount; simpler support seating; snug side-face placement for all stock; faint outline previews; and continuous navigation after Escape.

Keep each released HTML file unchanged so earlier versions remain available for comparison. Publish the next tested change as a new numbered file.
