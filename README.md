# FrameCraft

A standalone, browser-based framing simulator. Open `index.html` directly in a desktop browser; the simulator needs no server, runtime libraries, or Internet connection.

Downloadable, self-contained HTML versions are kept in `releases/`. **Use v4 for live camera movement and direction changes during drawing, concrete seating, and adjacent-piece snapping.** Export an existing build to JSON before changing versions, then import it into the new file if your browser does not share its autosave between filenames.

## Building controls

- Move the mouse to look and use **WASD** to fly immediately. **Space** rises, **Shift** descends, and **Ctrl** moves faster.
- The first movement key or building click captures the mouse for continuous turning. The scene hides the system pointer and uses one aiming cursor. **Esc** releases capture; WASD resumes without an extra click.
- **E** opens inventory; **C** opens dimensions and editing.
- Click to place the exact preview. Hold the left button and draw to length; mouse look and WASD remain available while the starting grip stays fixed in the world.
- Press **0 / V** for selection. Click a loose piece, drag its body to move it along the grabbed face, or aim at an end handle and drag to resize it. The opposite end remains fixed. Drag an assembly to move its components and recipe together.
- **R** changes the run direction, including during a drag; **Shift+R** reverses it. **F** turns the cross-section, **X** changes the grip, and **B** cycles Outside / Center / Inside seating. The current direction and seating mode are shown beside the precision button. Custom offsets remain available through C.
- Ends, midpoints, and layout marks snap automatically. Aim near a board's top edge to seat the next piece directly beside it, with matching run alignment and no gap. Butt joints take priority over layout marks; drawing stops at the first blocking piece. Default layout spacing is 16 inches; **C** exposes spacing, first-mark offset, grid precision, and target toggles. Hold **Alt** for slower camera movement and freehand fine adjustment; **N** toggles all snapping.
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

The regression suite covers stock dimensions, grips, surface contact, collisions, repeated placement, sloped sheets, diagonal joins, snap controls, measurement input, immediate movement, browser saving/export, and undo/redo. Its material matrix exercises 4,080 click-placement combinations. These checks cover the implemented placement rules; further real-world framing scenarios can be added as reproducible tests.

## Releases

- `releases/FrameCraft-Precision-Build-v1.html`: initial grip, stud placement, repetition, and snap-control fixes.
- `releases/FrameCraft-Precision-Build-v2.html`: immediate movement plus expanded contact, collision, chalk-line, sloped-panel, and measurement fixes.
- `releases/FrameCraft-Precision-Build-v3.html`: automatic mouse capture, a quiet scene with precision controls behind C, direct body/end editing, assembly movement, and labeled end/midpoint/custom-layout inference.
- `releases/FrameCraft-Precision-Build-v4.html`: live mouse look and flight while drawing, working direction/reverse controls, selectable concrete seating, and direct adjacent-piece/butt-joint inference.

Keep each released HTML file unchanged so earlier versions remain available for comparison. Publish the next tested change as a new numbered file.
