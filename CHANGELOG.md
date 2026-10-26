# Changes

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
