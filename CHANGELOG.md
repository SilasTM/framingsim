# Changes

## v5

- Position every loose material and selected assembly with the wheel. Move by actual stock thickness, 16-inch or 24-inch spacing, a fine increment, or one custom amount; Shift+wheel uses fine movement.
- Show size, length, support seating, and Move by first. Retain precise coordinates, rotation, and snap configuration under collapsible Advanced sections that stay open while editing.
- Provide direct Outside / Middle / Inside choices. Match foundation boundary winding, promote near-cap aims, and support parallel, vertical, and perpendicular material seating.
- Align literal side-face placements without staggering, for all four grips and all 31 stock materials. Follow the frame of pitched rafters and panels.
- Remove the obstructing 3D blue marker cubes and solid blue selection/inspect fills; retain small screen markers and faint material outlines.
- Keep mouse look working after Escape, preserve material hotbar shortcuts, and recapture on the next movement key or scene click. Menus keep their own usable pointer.
- Preserve cross-section height when turning horizontal material.

## v4

- Keep mouse look and WASD active while drawing to length; the starting grip stays fixed in world space.
- Apply R direction changes and Shift+R reversal to the active drag, including on concrete. Foundation placement no longer overrides the chosen axis or truncates vertical sill dimensions.
- Keep a panel's intended length axis when its width is larger than its drawn length.
- Show direction and seating controls in the context bar. B cycles Outside / Center / Inside and updates an active drag; exact offsets remain in precision settings.
- Seat a piece directly against a neighbor's top edge with the same base elevation and run alignment. Thin studs advance by one actual thickness, without a skipped slot.
- Prefer butt joints over nearby layout marks and stop at the first blocking face instead of skipping to a farther piece.
- Slow mouse look during Alt fine adjustment and remove artificial gaps around chalk references.

## v3

- Use one aiming cursor; the first movement key or building click captures the mouse for continuous turning. Esc releases it and WASD resumes.
- Drag new material to length with a fixed grip and measured endpoint. End-on views use a bounded screen drag instead of unstable ray projection.
- Snap to reference ends, midpoints, and custom layout spacing/offsets, with stable capture and release. Magnets use the raw pointer position before grid rounding.
- Keep precise snap settings behind C. Show only nearby marks and the active target in the scene; Alt temporarily disables both magnets and grid rounding.
- Select existing loose pieces without opening a panel. Drag a body to move along its grabbed face, or an end handle to resize with the opposite end fixed.
- Move recipe assemblies together while preserving editable recipe coordinates and existing internal connections.
- Reject overlapping edits, preserve originals when cancelled, and support undo. Restore the original drawing when menus interrupt a drag.

## v2

- Mouse look and WASD work immediately; the first click builds. Mouse capture is optional with L.
- Side and underside attachments remain flush. Ground placement preserves the exact surface elevation.
- Collision checks include loose pieces placed by the user and all members of a repeated batch.
- Roof and wall panels inherit a rotated support's orientation and retain their grip during resizing.
- Vertical chalk-line boards honor Start, Center, End, and Offset grips; repeated studs follow diagonal on-center marks.
- Chalk-line panels honor cross-section flipping. Diagonal boards snap to actual contact faces instead of penetrating target centerlines.
- Snap candidates are compared with the original endpoint and cannot pull a board through the targeted solid when overlap is disabled.
- Measurement input rejects malformed values. Focusing settings or opening menus stops camera movement.

## v1

- Vertical studs retain the aimed position along a plate.
- Click placement preserves the selected length and grip.
- End-grip snapping keeps its fixed anchor.
- Repeated boards are previewed and checked for collisions as a batch.
- Visible snap controls provide increments down to 1/16 inch, N toggles snapping, and Alt temporarily bypasses snapping.
