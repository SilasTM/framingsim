# FrameCraft

A standalone, browser-based framing simulator. Open `index.html` directly in a desktop browser; the simulator needs no server, runtime libraries, or Internet connection.

Downloadable, self-contained HTML versions are kept in `releases/`. **Use v2 for the current placement and movement fixes.** Export an existing build to JSON before changing versions, then import it into the new file if your browser does not share its autosave between filenames.

## Building controls

- Move the mouse to look and use **WASD** to fly immediately. **Space** rises, **Shift** descends, and **Ctrl** moves faster.
- **L** toggles optional mouse capture for continuous turning. Capture requires a browser gesture; ordinary movement and placement do not.
- **E** opens inventory; **C** opens dimensions and editing.
- Click to place the exact preview. Hold the left button and drag to change length; the camera and grip remain fixed during the drag.
- **R** changes the run direction, **F** turns the cross-section, **X** changes the grip, and **B** changes alignment.
- **N** toggles snapping. Choose the increment in the bottom controls, or hold **Alt** for temporary freehand placement.
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

Keep each released HTML file unchanged so earlier versions remain available for comparison. Publish the next tested change as a new numbered file.
