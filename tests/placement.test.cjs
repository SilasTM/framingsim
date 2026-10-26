const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test, before, after, beforeEach, afterEach } = require('node:test');
const { chromium } = require('playwright');

let server;
let browser;
let page;
let baseURL;
let pageErrors;

function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, received ${actual}`);
}

before(async () => {
  server = http.createServer(async (request, response) => {
    if (request.url === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    if (request.url !== '/' && request.url !== '/index.html') {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(path.join(__dirname, '..', 'index.html'));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(content);
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(baseURL);
  await page.waitForFunction(() => typeof finalizePrimitive === 'function' && viewport.w > 1);
});

afterEach(async () => {
  await page?.close();
  assert.deepEqual(pageErrors, [], 'The simulator must not raise browser errors');
});

test('a vertical stud follows the aimed position on a long plate', async () => {
  const board = await page.evaluate(() => {
    Object.assign(settings, defaults, { axis: 1, size: '2x6', len: 96 });
    const plate = { id: 1, c: [96, .75, 0], s: [192, 1.5, 5.5], n: 'Bottom plate', layer: 'Walls' };
    return placePrimitive(MATERIALS.find(item => item.name === 'Standard stud'), {
      box: plate, point: [24, 1.5, 0], normal: [0, 1, 0],
    });
  });
  closeTo(board.c[0], 24, 'Stud center follows the aim along the plate');
  closeTo(board.c[2], 0, 'Stud depth is centered on the plate');
  closeTo(board.c[1] - board.s[1] / 2, 1.5, 'Stud bottom touches the plate top');
});

test('snapping an End grip keeps its original anchor fixed', async () => {
  const result = await page.evaluate(() => {
    Object.assign(settings, defaults, { axis: 0, len: 96, grip: 'End', repeat: 1 });
    world.pieces = [{ id: 1, c: [2, 10, 0], s: [4, 1.5, 5.5], n: 'Snap target', layer: 'General' }];
    const result = lengthPreview({
      base: { c: [52, 10, 0], s: [96, 1.5, 5.5], n: 'Test board', layer: 'General' },
      axis: 0, anchor: 100, point: [100, 10, 0], grip: 'End',
      amount: -95, startSign: 1, repeatAxis: 2,
    });
    return { board: result.boxes[0], snapped: result.snapTarget, valid: result.valid };
  });
  assert.equal(result.snapped, 'Snap target');
  closeTo(result.board.s[0], 96, 'Length reaches the target face at X=4');
  closeTo(result.board.c[0] + result.board.s[0] / 2, 100, 'End anchor stays at X=100');
  closeTo(result.board.c[0] - result.board.s[0] / 2, 4, 'Free end reaches X=4');
  assert.equal(result.valid, true, 'Face-to-face contact must be allowed');
});

for (const [grip, expectedMin, expectedMax] of [
  ['Start', 0, 96], ['Center', -48, 48], ['End', -96, 0], ['Offset', -12, 84],
]) {
  test(`click placement preserves the selected length and ${grip} grip`, async () => {
    const pieces = await page.evaluate(grip => {
      equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
      Object.assign(settings, defaults, { axis: 0, size: '2x6', len: 96, grip, gripOffset: 12 });
      world = { name: 'Click test', pieces: [], groups: {}, guides: [], next: 1 };
      const hit = { box: null, point: [0, 0, 0], normal: [0, 1, 0] };
      gesture = screenLengthStart({ clientX: viewport.w / 2, clientY: viewport.h / 2 }, hit);
      gesture.moved = 0;
      endCanvas({ button: 0 });
      return world.pieces;
    }, grip);
    assert.equal(pieces.length, 1, 'A click places exactly one board');
    closeTo(pieces[0].s[0], 96, 'The chosen 8-foot length is unchanged');
    closeTo(pieces[0].c[0] - pieces[0].s[0] / 2, expectedMin, 'Start coordinate');
    closeTo(pieces[0].c[0] + pieces[0].s[0] / 2, expectedMax, 'End coordinate');
  });
}

test('repeat placement previews and rejects a collision in a later board', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, size: '2x6', len: 96, repeat: 2, oc: 16, allowOverlap: false });
    world = {
      name: 'Repeat test', groups: {}, guides: [], next: 2,
      pieces: [{ id: 1, c: [48, .75, 16], s: [96, 1.5, 5.5], n: 'Existing joist', layer: 'Floor' }],
    };
    history = [];
    preview = buildGhost({ box: null, point: [0, 0, 0], normal: [0, 1, 0] });
    const wasValid = preview.valid;
    const previewCount = preview.boxes.length;
    finalizePrimitive();
    return { wasValid, previewCount, pieceCount: world.pieces.length, undoCount: history.length };
  });
  assert.equal(result.previewCount, 2, 'Preview includes every repeated board');
  assert.equal(result.wasValid, false, 'The blocked repeated board invalidates the whole placement');
  assert.equal(result.pieceCount, 1, 'An invalid placement adds no boards');
  assert.equal(result.undoCount, 0, 'A rejected placement does not add an undo checkpoint');
});

test('repeat placement prevents newly placed boards from overlapping each other', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, size: '2x6', len: 96, repeat: 2, oc: 1.5, allowOverlap: false });
    preview = buildGhost({ box: null, point: [0, 0, 0], normal: [0, 1, 0] });
    const valid = preview.valid;
    finalizePrimitive();
    return { valid, count: world.pieces.length };
  });
  assert.equal(result.valid, false, 'Boards wider than their repeat offset must be rejected');
  assert.equal(result.count, 0, 'The intersecting batch is not placed');
});

test('turning off snapping preserves the aimed coordinate', async () => {
  const result = await page.evaluate(() => {
    Object.assign(settings, defaults, { snap: 1.5, snapping: true });
    const hit = { box: null, point: [23.4, 0, 0], normal: [0, 1, 0] };
    const snapped = axisAnchor(hit, 0);
    settings.snapping = false;
    const free = axisAnchor(hit, 0);
    return { snapped, free };
  });
  closeTo(result.snapped, 24, 'Enabled snapping uses the selected grid increment');
  closeTo(result.free, 23.4, 'Disabled snapping preserves the exact aim');
});

test('holding Alt temporarily bypasses snapping and releasing it restores snapping', async () => {
  await page.evaluate(() => Object.assign(settings, defaults, { snap: 1.5, snapping: true }));
  await page.keyboard.down('Alt');
  const free = await page.evaluate(() => axisAnchor({ box: null, point: [23.4, 0, 0] }, 0));
  await page.keyboard.up('Alt');
  const snapped = await page.evaluate(() => axisAnchor({ box: null, point: [23.4, 0, 0] }, 0));
  closeTo(free, 23.4, 'Alt disables grid snapping');
  closeTo(snapped, 24, 'Releasing Alt restores grid snapping');
});

test('the demo renders, survives reload, and exports its actual project', async () => {
  const initial = await page.evaluate(() => {
    runDemo();
    draw();
    return {
      count: world.pieces.length,
      groups: Object.keys(world.groups).length,
      invalidPieces: world.pieces.filter(piece => !piece.c.every(Number.isFinite) || !piece.s.every(value => value > 0)).length,
      takeoffCount: takeoffRows().reduce((total, row) => total + row.count, 0),
    };
  });
  assert.ok(initial.count > 100, 'The demo must contain real framing geometry');
  assert.equal(initial.groups, 8);
  assert.equal(initial.invalidPieces, 0);
  assert.equal(initial.takeoffCount, initial.count);

  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => document.querySelector('#saveBtn').click());
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.format, 'FrameCraft');
  assert.equal(exported.world.pieces.length, initial.count);

  await page.reload();
  assert.equal(await page.evaluate(() => world.pieces.length), initial.count, 'Autosaved pieces are restored');
  assert.equal(await page.evaluate(() => world.name), 'Sample One-Storey Frame');
});

test('placement supports undo and redo without losing the board dimensions', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, size: '2x6', len: 96 });
    preview = buildGhost({ box: null, point: [0, 0, 0], normal: [0, 1, 0] });
    finalizePrimitive();
    const placed = copy(world.pieces);
    undo();
    const undoneCount = world.pieces.length;
    redo();
    return { placed, undoneCount, restored: world.pieces };
  });
  assert.equal(result.placed.length, 1);
  assert.equal(result.undoneCount, 0);
  assert.deepEqual(result.restored, result.placed);
});

test('every loose material preserves its stock dimensions and grip when clicked on each face', async context => {
  const result = await page.evaluate(() => {
    const failures = [];
    let checked = 0;
    const almost = (a, b) => Math.abs(a - b) < 1e-7;
    const stock = MATERIALS.map((item, index) => ({ ...item, index }))
      .filter(item => ['lumber', 'primitive', 'panel'].includes(item.kind));
    for (const item of stock) {
      equip(item.index);
      for (const axis of item.kind === 'panel' ? [0] : [0, 1, 2]) {
        for (const flip of [0, 1]) {
          for (const grip of ['Start', 'Center', 'End', 'Offset']) {
            for (const face of [0, 1, 2]) {
              for (const side of [-1, 1]) {
                checked++;
                world = { name: 'Stock test', pieces: [], groups: {}, guides: [], next: 1 };
                history = [];
                Object.assign(settings, defaults, {
                  axis, flip, grip, gripOffset: 12, snapping: false, allowOverlap: true,
                  len: item.L, width: item.w, depth: item.kind === 'panel' ? item.thick : item.d,
                  size: item.size || defaults.size,
                });
                const normal = [0, 0, 0];
                normal[face] = side;
                const point = [24, 36, 48];
                point[face] = side * 240;
                const hit = {
                  box: { c: [0, 0, 0], s: [480, 480, 480], n: 'Test support', layer: 'General' },
                  point, normal,
                };
                gesture = screenLengthStart({}, hit);
                endCanvas({ button: 0 });
                const board = world.pieces[0];
                const context = `${item.name}, axis ${axis}, flip ${flip}, ${grip}, face ${'XYZ'[face]}${side}`;
                if (!board || world.pieces.length !== 1) {
                  failures.push(`${context}: click did not place exactly one piece`);
                  continue;
                }
                let expected;
                let run = axis;
                if (item.kind === 'panel') {
                  const cross = [0, 1, 2].filter(i => i !== face);
                  expected = [0, 0, 0];
                  expected[face] = item.thick;
                  expected[cross[0]] = flip ? item.L : item.w;
                  expected[cross[1]] = flip ? item.w : item.L;
                  run = cross.find(i => expected[i] === item.L);
                } else {
                  const section = item.kind === 'lumber' ? sizes[item.size] : [item.w, item.d];
                  const cross = [0, 1, 2].filter(i => i !== axis);
                  expected = [0, 0, 0];
                  expected[axis] = item.L;
                  expected[cross[0]] = section[flip ? 1 : 0];
                  expected[cross[1]] = section[flip ? 0 : 1];
                }
                if (!board.s.every((value, i) => almost(value, expected[i]))) {
                  failures.push(`${context}: dimensions ${board.s} differ from stock ${expected}`);
                }
                const anchor = point[run];
                const direction = item.kind !== 'panel' && face === run ? side : 1;
                const fromStart = grip === 'Start' ? 0 : grip === 'Center' ? item.L / 2 : grip === 'End' ? item.L : 12;
                const actualAnchor = board.c[run] + direction * (fromStart - item.L / 2);
                if (!almost(actualAnchor, anchor)) failures.push(`${context}: grip anchor ${actualAnchor} moved from ${anchor}`);
                if (!board.c.every(Number.isFinite)) failures.push(`${context}: invalid position`);
              }
            }
          }
        }
      }
    }
    return { checked, materialCount: stock.length, failures: failures.slice(0, 20), failureCount: failures.length };
  });
  assert.ok(result.materialCount >= 25, 'The catalog must exercise all of the uploaded loose materials');
  assert.ok(result.checked >= 3000, 'The matrix covers all grips, axes, cross-sections, and face normals');
  assert.equal(result.failureCount, 0, `${result.failureCount}/${result.checked} stock placement failures:\n${result.failures.join('\n')}`);
  context.diagnostic(`${result.checked} click placements across ${result.materialCount} materials`);
});

test('angled chalk placement keeps horizontal boards and panels on their grip point', async () => {
  const result = await page.evaluate(() => {
    const failures = [];
    let checked = 0;
    const guide = { id: 1, a: [10, 0, 20], b: [130, 0, 180] };
    const T = [.6, 0, .8];
    const attach = [70, 0, 100];
    for (const name of ['Pressure-treated sill', 'Custom dimension timber', 'Subfloor 4×8']) {
      for (const grip of ['Start', 'Center', 'End', 'Offset']) {
        checked++;
        world = { name: 'Chalk test', pieces: [], groups: {}, guides: [guide], next: 2 };
        history = [];
        equip(MATERIALS.findIndex(item => item.name === name));
        Object.assign(settings, { axis: 0, grip, gripOffset: 12, len: 96, repeat: 1, snapping: false, alignment: 'Center' });
        const hit = { box: lineGuideBox(guide), guide, point: attach, normal: [0, 1, 0] };
        gesture = screenLengthStart({}, hit);
        endCanvas({ button: 0 });
        const board = world.pieces[0];
        if (!board) { failures.push(`${name}/${grip}: no board`); continue; }
        const fromStart = grip === 'Start' ? 0 : grip === 'Center' ? 48 : grip === 'End' ? 96 : 12;
        const anchor = [board.c[0] + T[0] * (fromStart - 48), board.c[2] + T[2] * (fromStart - 48)];
        if (Math.abs(anchor[0] - attach[0]) > 1e-7 || Math.abs(anchor[1] - attach[2]) > 1e-7) failures.push(`${name}/${grip}: anchor moved to ${anchor}`);
        if (Math.abs(board.s[0] - 96) > 1e-7) failures.push(`${name}/${grip}: length changed`);
        const endA = transformPoint(board, [-48, 0, 0]);
        const endB = transformPoint(board, [48, 0, 0]);
        const direction = endB.map((value, i) => (value - endA[i]) / 96);
        if (direction.some((value, i) => Math.abs(value - T[i]) > 1e-7)) failures.push(`${name}/${grip}: board no longer follows the angled line`);
      }
    }
    return { checked, failures };
  });
  assert.equal(result.checked, 12);
  assert.deepEqual(result.failures, []);
});

test('a vertical board on a chalk line respects all four grip points', async () => {
  const result = await page.evaluate(() => {
    const guide = { id: 1, a: [10, 20, 20], b: [130, 20, 180] };
    const failures = [];
    for (const grip of ['Start', 'Center', 'End', 'Offset']) {
      world = { name: 'Chalk stud test', pieces: [], groups: {}, guides: [guide], next: 2 };
      history = [];
      equip(MATERIALS.findIndex(item => item.name === 'Standard stud'));
      Object.assign(settings, { axis: 1, grip, gripOffset: 12, len: 96, repeat: 1, snapping: false, alignment: 'Center' });
      gesture = screenLengthStart({}, { box: lineGuideBox(guide), guide, point: [70, 20, 100], normal: [0, 1, 0] });
      endCanvas({ button: 0 });
      const board = world.pieces[0];
      const fromStart = grip === 'Start' ? 0 : grip === 'Center' ? 48 : grip === 'End' ? 96 : 12;
      const actualAnchor = board.c[1] - 48 + fromStart;
      if (Math.abs(actualAnchor - 20) > 1e-7) failures.push(`${grip}: vertical grip moved from Y=20 to Y=${actualAnchor}`);
    }
    return failures;
  });
  assert.deepEqual(result, []);
});

test('dragging along an angled chalk line locks the grip and preserves cross-section', async () => {
  const result = await page.evaluate(() => {
    const guide = { id: 1, a: [10, 0, 20], b: [130, 0, 180] };
    const T = [.6, 0, .8];
    const failures = [];
    for (const grip of ['Start', 'Center', 'End', 'Offset']) {
      world = { name: 'Chalk drag test', pieces: [], groups: {}, guides: [guide], next: 2 };
      equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
      Object.assign(settings, { axis: 0, grip, gripOffset: 12, len: 96, repeat: 1, snapping: false, alignment: 'Center' });
      const g = screenLengthStart({}, { box: lineGuideBox(guide), guide, point: [70, 0, 100], normal: [0, 1, 0] });
      g.amount = 120;
      const preview = lengthPreview(g);
      const board = preview.boxes[0];
      const expectedLength = grip === 'Center' ? 240 : grip === 'Offset' ? 132 : 120;
      if (Math.abs(board.s[0] - expectedLength) > 1e-7) failures.push(`${grip}: wrong stretched length`);
      const ends = [-1, 1].map(sign => {
        const p = transformPoint(board, [sign * board.s[0] / 2, 0, 0]);
        return (p[0] - g.point[0]) * T[0] + (p[2] - g.point[2]) * T[2];
      }).sort((a, b) => a - b);
      const expectedStart = grip === 'Center' ? -120 : grip === 'Offset' ? -12 : 0;
      if (Math.abs(ends[0] - expectedStart) > 1e-7 || Math.abs(ends[1] - 120) > 1e-7) failures.push(`${grip}: endpoints ${ends} do not keep the fixed grip`);
      if (Math.abs(board.c[1] - g.point[1]) > 1e-7 || Math.abs(board.s[1] - 1.5) > 1e-7 || Math.abs(board.s[2] - 5.5) > 1e-7) failures.push(`${grip}: cross-section or height changed`);
    }
    return failures;
  });
  assert.deepEqual(result, []);
});

test('repeating angled boards uses exact on-center spacing perpendicular to their run', async () => {
  const result = await page.evaluate(() => {
    const guide = { id: 1, a: [10, 0, 20], b: [130, 0, 180] };
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, { axis: 0, grip: 'Start', len: 96, repeat: 3, oc: 16, snapping: false, alignment: 'Center' });
    preview = buildGhost({ box: lineGuideBox(guide), guide, point: [70, 0, 100], normal: [0, 1, 0] });
    const valid = preview.valid;
    finalizePrimitive();
    return { valid, pieces: world.pieces };
  });
  assert.equal(result.valid, true);
  assert.equal(result.pieces.length, 3);
  for (let i = 1; i < result.pieces.length; i++) {
    const previous = result.pieces[i - 1];
    const current = result.pieces[i];
    closeTo(current.c[0] - previous.c[0], -.8 * 16, 'Perpendicular spacing X');
    closeTo(current.c[2] - previous.c[2], .6 * 16, 'Perpendicular spacing Z');
    assert.deepEqual(current.s, previous.s);
    assert.deepEqual(current.r, previous.r);
  }
});

test('snap controls and the N shortcut persist their state after reload', async () => {
  await page.keyboard.press('c');
  await page.locator('#fields [data-field="snap"]').selectOption('0.25');
  await page.keyboard.press('Escape');
  await page.locator('#snapToggle').click();
  assert.equal(await page.locator('#snapToggle').getAttribute('aria-pressed'), 'false');
  await page.reload();
  assert.equal(await page.locator('#snapStep').inputValue(), '0.25');
  assert.equal(await page.locator('#snapToggle').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('n');
  assert.equal(await page.locator('#snapToggle').getAttribute('aria-pressed'), 'true');
  await page.reload();
  assert.equal(await page.locator('#snapToggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#snapStep').inputValue(), '0.25');
});

test('focusing a settings control stops held flight movement', async () => {
  await page.keyboard.down('w');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('#precisionSettings').focus();
  const beforeFocusTicks = await page.evaluate(() => [...eye]);
  const afterFocusTicks = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve([...eye])))));
  await page.keyboard.up('w');
  assert.deepEqual(afterFocusTicks, beforeFocusTicks, 'Camera movement pauses while a precision control has focus');
});

test('user-placed loose boards block a later overlapping placement', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, len: 96, allowOverlap: false });
    const hit = { box: null, point: [0, 0, 0], normal: [0, 1, 0] };
    preview = buildGhost(hit);
    finalizePrimitive();
    const firstGroup = world.pieces[0].g;
    preview = buildGhost(hit);
    const secondValid = preview.valid;
    finalizePrimitive();
    return { firstGroup, secondValid, count: world.pieces.length };
  });
  assert.equal(result.firstGroup, null, 'The fixture uses a real loose board, not an assembly');
  assert.equal(result.secondValid, false, 'A loose board must participate in collision detection');
  assert.equal(result.count, 1, 'The overlapping board is not placed');
});

test('loose materials rest flush on the ground in every axis and cross-section orientation', async () => {
  const failures = await page.evaluate(() => {
    const failures = [];
    for (let index = 0; index < MATERIALS.length; index++) {
      const item = MATERIALS[index];
      if (!['lumber', 'primitive', 'panel'].includes(item.kind)) continue;
      for (const axis of item.kind === 'panel' ? [0] : [0, 1, 2]) {
        for (const flip of [0, 1]) {
          equip(index);
          Object.assign(settings, { axis, flip, grip: 'Start', snapping: true, repeat: 1 });
          const hit = { box: null, point: [0, 0, 0], normal: [0, 1, 0] };
          const board = item.kind === 'panel' ? placePanel(item, hit) : placePrimitive(item, hit);
          const bottom = board.c[1] - board.s[1] / 2;
          if (Math.abs(bottom) > 1e-7) failures.push(`${item.name}/axis ${axis}/flip ${flip}: bottom is ${bottom}, expected ground Y=0`);
        }
      }
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('horizontal boards meet both sides of a support flush in every alignment mode', async () => {
  const failures = await page.evaluate(() => {
    const failures = [];
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    for (const alignment of ['Outside', 'Center', 'Inside', 'Custom']) {
      for (const side of [-1, 1]) {
        Object.assign(settings, defaults, { axis: 0, len: 48, alignment, faceOffset: 4 });
        const support = { id: 1, g: null, c: [48, .75, 0], s: [96, 1.5, 5.5], n: 'Existing plate', layer: 'Floor' };
        world.pieces = [support];
        const hit = { box: support, point: [24, .75, side * 2.75], normal: [0, 0, side] };
        const result = buildGhost(hit);
        const board = result.boxes[0];
        const contact = board.c[2] - side * board.s[2] / 2;
        if (Math.abs(contact - side * 2.75) > 1e-7) failures.push(`${alignment}/${side}: board misses support face (${contact})`);
        if (!result.valid) failures.push(`${alignment}/${side}: touching faces were blocked`);
      }
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('horizontal boards attach to the underside of a support without a gap or depth drift', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, len: 48 });
    const support = { id: 1, g: null, c: [48, 10, 0], s: [96, 1.5, 5.5], n: 'Existing plate', layer: 'Floor' };
    world.pieces = [support];
    const preview = buildGhost({ box: support, point: [24, 9.25, 0], normal: [0, -1, 0] });
    return { board: preview.boxes[0], valid: preview.valid };
  });
  closeTo(result.board.c[1] + result.board.s[1] / 2, 9.25, 'Board top meets the support underside');
  closeTo(result.board.c[2], 0, 'Board depth is aligned to the support center');
  assert.equal(result.valid, true);
});

test('measurement input accepts precise framing dimensions and rejects malformed numbers', async () => {
  const valid = [
    ['0', 0], ['96', 96], ['.5', .5], ['8.125', 8.125], ['1/2', .5], ['8 1/8', 8.125],
    ['8-1/8', 8.125], ['8\'', 96], ['8′ 1 1/8″', 97.125], ['8 ft 3 in', 99],
    ['1.5 feet', 18], [' -1′ 2 1/2″ ', -14.5], ['−1′ 2″', -14], ['+ 2 3/4 in', 2.75],
  ];
  for (const [input, expected] of valid) {
    const result = await page.evaluate(input => parseInches(input), input);
    closeTo(result, expected, `Measurement ${JSON.stringify(input)}`);
  }
  for (const input of ['', 'abc', '12abc', '1e3', '3/0', '2.3.4', '--1', '8′ 1 2', '1\'\'', 'NaN', 'Infinity', '1/2/3']) {
    const validNumber = await page.evaluate(input => Number.isFinite(parseInches(input)), input);
    assert.equal(validNumber, false, `${JSON.stringify(input)} must be rejected`);
  }
});

test('roof panels follow a sloped support and touch its surface exactly', async () => {
  const results = await page.evaluate(() => {
    const target = { id: 1, g: null, c: [0, 100, 0], s: [96, .5, 144], r: [-Math.atan(.5), 0, 0], n: 'Roof sheathing', layer: 'Roof' };
    const point = transformPoint(target, [20, .25, 40]);
    const normal = axesRotation(target).map(row => row[1]);
    const results = [];
    for (const flip of [0, 1]) {
      equip(MATERIALS.findIndex(item => item.name === 'Roof sheathing 4×8'));
      Object.assign(settings, defaults, { width: 48, len: 96, depth: .5, flip, grip: 'Center', snapping: false, alignment: 'Center' });
      world.pieces = [target];
      const board = placePanel(current(), { box: target, point, normal, axis: 1 });
      results.push({
        flip, board, overlap: obbOverlap(board, target),
        offset: dot(vSub(board.c, point), normal),
      });
    }
    return { results, rotation: target.r };
  });
  for (const { flip, board, overlap, offset } of results.results) {
    assert.deepEqual(board.s, flip ? [96, .5, 48] : [48, .5, 96]);
    assert.deepEqual(board.r, results.rotation, 'Panel follows the slope of the surface');
    closeTo(offset, .25, 'Panel center is half its thickness beyond the support face');
    assert.equal(overlap, false, 'Sloped sheets may touch but must not intersect');
  }
});

test('a diagonal joist snaps to the actual rim face rather than penetrating its center', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 99.25, snap: .25, snapping: true });
    const T = [Math.SQRT1_2, 0, Math.SQRT1_2];
    const ref = [0, .75, 0];
    world.pieces = [{ id: 1, g: null, c: [T[0] * 100, .75, T[2] * 100], s: [1.5, 1.5, 40], r: [0, -Math.PI / 4, 0], n: 'Rim board', layer: 'Floor' }];
    const base = {
      c: [T[0] * 49.625, .75, T[2] * 49.625], s: [99.25, 1.5, 5.5], r: [0, -Math.PI / 4, 0],
      placementAxis: 0, guideVector: T, guideOrigin: [0, 0, 0], startSign: 1, grip: 'Start', n: 'Test joist', layer: 'Floor',
    };
    const preview = lengthPreview({ base, axis: 0, vector: T, point: ref, anchor: 0, grip: 'Start', amount: 99.25, startSign: 1 });
    return { board: preview.boxes[0], valid: preview.valid, anchor: preview.anchorPoint, endpoint: preview.targetPoint };
  });
  closeTo(result.board.s[0], 99.25, 'The joist ends at the near face of the rim');
  assert.deepEqual(result.anchor, [0, .75, 0]);
  closeTo(result.endpoint[0], Math.SQRT1_2 * 99.25, 'Endpoint X');
  closeTo(result.endpoint[2], Math.SQRT1_2 * 99.25, 'Endpoint Z');
  assert.equal(result.valid, true, 'A flush diagonal joint must be placeable');
});

test('an axis-aligned joist prefers the rim face over its overlapping center', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 100, snap: .25, snapping: true });
    world.pieces = [{ id: 1, g: null, c: [100, .75, 0], s: [1.5, 1.5, 40], n: 'Rim board', layer: 'Floor' }];
    const base = { c: [50, .75, 0], s: [100, 1.5, 5.5], placementAxis: 0, startSign: 1, grip: 'Start', n: 'Test joist', layer: 'Floor' };
    const preview = lengthPreview({ base, axis: 0, point: [0, .75, 0], anchor: 0, grip: 'Start', amount: 100, startSign: 1 });
    return { length: preview.boxes[0].s[0], valid: preview.valid, endpoint: preview.targetPoint };
  });
  closeTo(result.length, 99.25, 'The board ends at the face, before the rim center');
  closeTo(result.endpoint[0], 99.25, 'The free end meets the near rim face');
  assert.equal(result.valid, true, 'The face joint remains placeable');
});

test('vertical studs repeated on an angled chalk line follow its on-center marks', async () => {
  const result = await page.evaluate(() => {
    const guide = { id: 1, a: [10, 0, 20], b: [130, 0, 180] };
    equip(MATERIALS.findIndex(item => item.name === 'Standard stud'));
    Object.assign(settings, defaults, { axis: 1, grip: 'Start', len: 96, repeat: 3, oc: 16, snapping: false });
    preview = buildGhost({ box: lineGuideBox(guide), guide, point: [70, 0, 100], normal: [0, 1, 0] });
    const valid = preview.valid;
    finalizePrimitive();
    return { valid, pieces: world.pieces };
  });
  assert.equal(result.valid, true);
  assert.equal(result.pieces.length, 3);
  for (let i = 1; i < result.pieces.length; i++) {
    closeTo(result.pieces[i].c[0] - result.pieces[i - 1].c[0], .6 * 16, 'Stud on-center offset X');
    closeTo(result.pieces[i].c[2] - result.pieces[i - 1].c[2], .8 * 16, 'Stud on-center offset Z');
  }
});

test('flipped panels on a chalk line keep their grip and stretch along their rotated length', async () => {
  const failures = await page.evaluate(() => {
    const guide = { id: 1, a: [10, 0, 20], b: [130, 0, 180] };
    const attach = [70, 0, 100];
    const N = [-.8, 0, .6];
    const failures = [];
    for (const grip of ['Start', 'Center', 'End', 'Offset']) {
      equip(MATERIALS.findIndex(item => item.name === 'Subfloor 4×8'));
      Object.assign(settings, defaults, { width: 48, depth: .75, len: 96, flip: 1, grip, gripOffset: 12, snapping: false });
      world = { name: 'Flipped panel test', pieces: [], groups: {}, guides: [guide], next: 2 };
      history = [];
      const hit = { box: lineGuideBox(guide), guide, point: attach, normal: [0, 1, 0] };
      gesture = screenLengthStart({}, hit);
      const g = gesture;
      endCanvas({ button: 0 });
      const placed = world.pieces[0];
      if (!placed || placed.s.some((value, i) => Math.abs(value - [48, .75, 96][i]) > 1e-7)) {
        failures.push(`${grip}: panel flip did not exchange width and length`);
        continue;
      }
      const offset = grip === 'Start' ? 0 : grip === 'Center' ? 48 : grip === 'End' ? 96 : 12;
      const anchor = transformPoint(placed, [0, 0, offset - 48]);
      if (Math.abs(anchor[0] - attach[0]) > 1e-7 || Math.abs(anchor[2] - attach[2]) > 1e-7) failures.push(`${grip}: click grip moved`);
      world.pieces = [];
      g.amount = 120;
      const dragged = lengthPreview(g).boxes[0];
      const expectedLength = grip === 'Center' ? 240 : grip === 'Offset' ? 132 : 120;
      if (Math.abs(dragged.s[2] - expectedLength) > 1e-7 || Math.abs(dragged.s[0] - 48) > 1e-7) failures.push(`${grip}: dragging changed the width rather than length`);
      const endpoint = transformPoint(dragged, [0, 0, dragged.s[2] / 2]);
      if (Math.abs(endpoint[0] - (g.point[0] + N[0] * 120)) > 1e-7 || Math.abs(endpoint[2] - (g.point[2] + N[2] * 120)) > 1e-7) failures.push(`${grip}: free end left its rotated length axis`);
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('dragging a sloped roof panel preserves its support plane and fixed grip', async () => {
  const failures = await page.evaluate(() => {
    const target = { id: 1, g: null, c: [0, 100, 0], s: [96, .5, 144], r: [-Math.atan(.5), 0, 0], n: 'Roof sheathing', layer: 'Roof' };
    const point = transformPoint(target, [20, .25, 40]);
    const rotation = axesRotation(target);
    const normal = rotation.map(row => row[1]);
    const failures = [];
    for (const flip of [0, 1]) {
      for (const grip of ['Start', 'Center', 'End', 'Offset']) {
        equip(MATERIALS.findIndex(item => item.name === 'Roof sheathing 4×8'));
        Object.assign(settings, defaults, { width: 48, len: 96, depth: .5, flip, grip, gripOffset: 12, snapping: false });
        world.pieces = [];
        const g = screenLengthStart({}, { box: target, point, normal, axis: 1 });
        g.amount = 120;
        const board = lengthPreview(g).boxes[0];
        const axis = flip ? 0 : 2;
        const direction = rotation.map(row => row[axis]);
        const expectedLength = grip === 'Center' ? 240 : grip === 'Offset' ? 132 : 120;
        const half = board.s.map(value => value / 2);
        const endLocal = [0, 0, 0];
        endLocal[axis] = half[axis];
        const end = transformPoint(board, endLocal);
        if (Math.abs(board.s[axis] - expectedLength) > 1e-7) failures.push(`${flip}/${grip}: stretched the wrong dimension`);
        const delta = end.map((value, i) => value - g.point[i] - direction[i] * 120);
        if (delta.some(value => Math.abs(value) > 1e-7)) failures.push(`${flip}/${grip}: free end left the support length axis`);
        const normalOffset = dot(vSub(board.c, point), normal);
        if (Math.abs(normalOffset - .25) > 1e-7) failures.push(`${flip}/${grip}: panel left the support plane (normal offset ${normalOffset})`);
      }
    }
    return failures;
  });
  assert.deepEqual(failures, []);
});

test('mouse look works immediately and WASD captures the pointer without an initial click', async () => {
  await page.mouse.move(640, 400);
  const initial = await page.evaluate(() => ({ yaw, pitch, eye: [...eye], locked: !!document.pointerLockElement }));
  await page.mouse.move(700, 430);
  const looked = await page.evaluate(() => ({ yaw, pitch, locked: !!document.pointerLockElement }));
  assert.equal(initial.locked, false);
  assert.equal(looked.locked, false);
  assert.notEqual(looked.yaw, initial.yaw, 'Moving the free pointer changes camera yaw');
  assert.notEqual(looked.pitch, initial.pitch, 'Moving the free pointer changes camera pitch');
  await page.keyboard.down('w');
  await page.waitForFunction(() => document.pointerLockElement === canvas);
  const moved = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve([...eye])))));
  await page.keyboard.up('w');
  assert.ok(moved.some((value, i) => Math.abs(value - initial.eye[i]) > 1e-7), 'W flies without a prior canvas click');
});

test('the first click captures the pointer and places the selected board', async () => {
  await page.mouse.move(640, 400);
  await page.keyboard.press('5');
  const selectedLength = await page.evaluate(() => {
    eye = [0, 120, 200]; yaw = 0; pitch = -.5;
    sceneDirty = mouse.dirty = true;
    return settings.len;
  });
  await page.mouse.click(640, 400);
  const result = await page.evaluate(() => ({ pieces: world.pieces, locked: !!document.pointerLockElement }));
  assert.equal(result.locked, true, 'The first build gesture also enables continuous mouse look');
  assert.equal(result.pieces.length, 1, 'The first click builds instead of being consumed by pointer capture');
  closeTo(result.pieces[0].s[1], selectedLength, 'A click keeps the selected stud length');
});

test('a board drag changes length while mouse look remains available', async () => {
  await page.mouse.move(640, 400);
  await page.keyboard.press('5');
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  const initial = await page.evaluate(() => {
    eye = [150, 150, 250]; yaw = -.6; pitch = -.5;
    sceneDirty = mouse.dirty = true;
    return { yaw, pitch, eye: [...eye], length: settings.len };
  });
  await page.mouse.down();
  await page.mouse.move(760, 400, { steps: 5 });
  await page.mouse.up();
  const result = await page.evaluate(() => ({ pieces: world.pieces, yaw, pitch, eye, locked: !!document.pointerLockElement }));
  assert.equal(result.locked, true);
  assert.equal(result.pieces.length, 1, 'Releasing the drag places a board');
  assert.notEqual(result.pieces[0].s[0], initial.length, 'Dragging stretches the board');
  assert.notEqual(result.yaw, initial.yaw, 'Mouse look keeps turning the screen while drawing');
  closeTo(result.pitch, initial.pitch, 'Camera pitch is fixed while dragging');
  assert.deepEqual(result.eye, initial.eye, 'Camera position is fixed while dragging');
});

test('moving over the inventory does not turn the camera', async () => {
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.body.classList.contains('showInventory'));
  const before = await page.evaluate(() => ({ yaw, pitch }));
  await page.mouse.move(450, 250);
  await page.mouse.move(750, 500, { steps: 3 });
  const after = await page.evaluate(() => ({ yaw, pitch }));
  assert.deepEqual(after, before);
});

async function frame() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
let dragPointer = { x: 640, y: 400 };

async function plateScene(overrides = {}) {
  await page.mouse.move(640, 400);
  dragPointer = { x: 640, y: 400 };
  await page.evaluate(overrides => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, overrides, { axis: 0, grip: 'Start', len: 96, repeat: 1, size: '2x6', flip: 0 });
    world = { name: 'Drag interaction', pieces: [{ id: 1, g: null, c: [96, .75, 0], s: [192, 1.5, 5.5], n: 'Reference plate', layer: 'Floor' }], groups: {}, guides: [], next: 2 };
    history = []; future = []; selected = null;
    eye = [0, 100, 300]; yaw = 0; pitch = -Math.atan((100 - 1.5) / 300);
    sceneDirty = geometryDirty = mouse.dirty = true;
  }, overrides);
  await frame();
}

async function beginPlateDrag(overrides) {
  await plateScene(overrides);
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'length' && document.pointerLockElement === canvas);
  await frame();
}

async function dragEndpoint(distance) {
  const delta = await page.evaluate(distance => {
    const g = gesture;
    const T = g.vector || [0, 1, 2].map(i => i === g.axis ? 1 : 0);
    const target = vAdd(g.point, vMul(T, distance + g.aimBias)),D = vSub(target, eye);
    const targetYaw = Math.atan2(D[0], -D[2]),targetPitch = Math.atan2(D[1], Math.hypot(D[0], D[2]));
    const turn = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
    return [turn / .0027, (pitch - targetPitch) / .0027];
  }, distance);
  dragPointer = { x: dragPointer.x + delta[0], y: dragPointer.y + delta[1] };
  await page.mouse.move(dragPointer.x, dragPointer.y, { steps: 5 });
  await frame();
}

test('the scene has one aim cursor and inventory restores the normal pointer', async () => {
  assert.equal(await page.locator('#scene').evaluate(el => getComputedStyle(el).cursor), 'none');
  await page.keyboard.down('w');
  await page.waitForFunction(() => document.pointerLockElement === canvas);
  await page.keyboard.up('w');
  assert.equal(await page.locator('#crosshair').evaluate(el => getComputedStyle(el).visibility), 'visible');
  await page.keyboard.press('e');
  await page.waitForFunction(() => !document.pointerLockElement);
  assert.equal(await page.locator('#crosshair').evaluate(el => getComputedStyle(el).visibility), 'hidden');
  assert.notEqual(await page.locator('#search').evaluate(el => getComputedStyle(el).cursor), 'none');
});

test('a real click and drag snaps to a reference midpoint and places the measured length', async () => {
  await beginPlateDrag();
  const anchor = await page.evaluate(() => [...gesture.point]);
  await dragEndpoint(95.3);
  const result = await page.evaluate(() => ({ length: preview.boxes[0].s[0], snap: preview.snapInfo, anchor: preview.anchorPoint, camera: [yaw, pitch] }));
  closeTo(result.length, 96, 'The endpoint lands exactly at the reference midpoint');
  assert.equal(result.snap.kind, 'mid');
  assert.deepEqual(result.anchor, anchor, 'The start stays fixed during the entire drag');
  assert.match(await page.locator('#placementOverlay').textContent(), /Midpoint/);
  await page.mouse.up();
  const board = await page.evaluate(() => world.pieces.find(b => b.id === 2));
  closeTo(board.s[0], 96, 'Release preserves the snapped length');
  closeTo(board.c[0] - board.s[0] / 2, 0, 'Release preserves the start');
});

test('a real drag snaps flush to the end of the reference', async () => {
  await beginPlateDrag();
  await dragEndpoint(191.3);
  const result = await page.evaluate(() => ({ length: preview.boxes[0].s[0], snap: preview.snapInfo, valid: preview.valid }));
  closeTo(result.length, 192, 'The board reaches the reference end exactly');
  assert.equal(result.snap.kind, 'end');
  assert.equal(result.valid, true);
  await page.mouse.up();
});

test('midpoint snapping stays steady under hand jitter and releases when dragged away', async () => {
  await beginPlateDrag();
  await dragEndpoint(95.5);
  await dragEndpoint(102);
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 96, 'A small movement retains the active midpoint');
  await dragEndpoint(112);
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 112, 'Moving away selects the next layout mark');
  await page.mouse.up();
});

test('custom spacing and offset accept fractions and control real drag snapping', async () => {
  await page.keyboard.press('c');
  await page.locator('#fields [data-field="layoutSpacing"]').fill('1\' 11 7/8"');
  await page.locator('#fields [data-field="layoutSpacing"]').press('Tab');
  await page.locator('#fields [data-field="layoutOffset"]').fill('3 1/4"');
  await page.locator('#fields [data-field="layoutOffset"]').press('Tab');
  const custom = await page.evaluate(() => ({ layoutSpacing: settings.layoutSpacing, layoutOffset: settings.layoutOffset }));
  assert.deepEqual(custom, { layoutSpacing: 23.875, layoutOffset: 3.25 });
  await page.keyboard.press('Escape');
  await beginPlateDrag(custom);
  await dragEndpoint(26.8);
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 27.125, 'The endpoint uses custom spacing plus offset');
  assert.equal(await page.evaluate(() => preview.snapInfo.kind), 'layout');
  await page.mouse.up();
});

test('Alt temporarily frees an active drag from both magnets and the grid', async () => {
  await beginPlateDrag();
  await dragEndpoint(95.3);
  const pointerAmount = await page.evaluate(() => gesture.amount);
  await page.keyboard.down('Alt');
  await frame();
  const free = await page.evaluate(() => ({ length: preview.boxes[0].s[0], raw: gesture.amount }));
  assert.ok(Math.abs(free.length - 95.3) < 1.5, 'Freehand follows the camera aim within one angular input pixel');
  closeTo(free.length, pointerAmount, 'Toggling fine adjustment does not move the endpoint');
  closeTo(free.length, free.raw, 'Freehand applies neither grid rounding nor a magnetic snap');
  assert.equal(await page.evaluate(() => preview.snapInfo), null);
  await page.keyboard.up('Alt');
  await frame();
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 96, 'Releasing Alt restores the midpoint');
  await page.mouse.up();
});

test('an almost end-on drag has a controlled length instead of a projection jump', async () => {
  await page.mouse.move(640, 400);
  await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Floor joist'));
    Object.assign(settings, defaults, { axis: 2, grip: 'Start' });
    world = { name: 'End-on', pieces: [{ id: 1, g: null, c: [0, 10, -.75], s: [5.5, 10, 1.5], n: 'Support', layer: 'Floor' }], groups: {}, guides: [], next: 2 };
    eye = [0, 10, 200]; yaw = 0; pitch = 0; sceneDirty = geometryDirty = mouse.dirty = true;
  });
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'length' && document.pointerLockElement === canvas);
  await page.mouse.move(700, 400, { steps: 5 });
  await frame();
  const result = await page.evaluate(() => ({ length: preview.boxes[0].s[2], anchor: preview.anchorPoint, valid: preview.valid }));
  assert.ok(result.length >= 1.5 && result.length < 40, 'A short drag produces a bounded, useful length');
  assert.deepEqual(result.anchor, [0, 10, 0]);
  assert.equal(result.valid, true);
  await page.mouse.up();
});

test('precision controls stay out of the scene until explicitly opened', async () => {
  assert.equal(await page.locator('.layoutControls').isVisible(), false);
  await page.keyboard.press('c');
  assert.equal(await page.locator('#fields [data-field="layoutSpacing"]').isVisible(), true);
  assert.equal(await page.locator('#fields [data-field="snap"]').isVisible(), true);
});

async function selectedBoardScene(extraPieces = []) {
  await page.mouse.move(640, 400);
  dragPointer = { x: 640, y: 400 };
  await page.evaluate(extraPieces => {
    equip(0);
    Object.assign(settings, defaults);
    world = { name: 'Direct editing', pieces: [{ id: 1, g: null, c: [48, .75, 0], s: [96, 1.5, 5.5], placementAxis: 0, n: 'Loose plate', layer: 'Floor' }, ...extraPieces], groups: {}, guides: [], next: 10 };
    history = []; future = []; selected = null;
    eye = [48, 100, 300]; yaw = 0; pitch = -Math.atan((100 - 1.5) / 300);
    sceneDirty = geometryDirty = mouse.dirty = true;
  }, extraPieces);
  await frame();
  await page.mouse.click(640, 400);
  await frame();
  assert.deepEqual(await page.evaluate(() => selected), { id: 1 });
  assert.equal(await page.locator('#right').isVisible(), false, 'Selecting keeps detailed controls out of the scene');
}

test('an existing piece can be selected and resized by dragging its end', async () => {
  await selectedBoardScene();
  await page.evaluate(() => {
    eye = [96, 100, 300]; yaw = 0; pitch = -Math.atan((100 - .75) / 300);
    sceneDirty = mouse.dirty = true;
  });
  await frame();
  assert.match(await page.locator('#placementOverlay').textContent(), /Drag end/);
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'length' && gesture.editId === 1);
  await dragEndpoint(127.3);
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 128, 'Existing pieces use the same layout snapping');
  await page.mouse.up();
  const pieces = await page.evaluate(() => world.pieces);
  assert.equal(pieces.length, 1, 'Resizing edits the existing object instead of duplicating it');
  assert.equal(pieces[0].id, 1);
  closeTo(pieces[0].s[0], 128, 'The new length is committed');
  closeTo(pieces[0].c[0] - pieces[0].s[0] / 2, 0, 'The opposite end stays fixed');
  await page.keyboard.press('Control+z');
  closeTo(await page.evaluate(() => world.pieces[0].s[0]), 96, 'Undo restores the old length');
});

test('dragging an existing piece body moves it without changing dimensions', async () => {
  await selectedBoardScene();
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'move');
  const next = await page.evaluate(() => project(vAdd(gesture.point, [32, 0, 0])));
  await page.mouse.move(next[0], next[1], { steps: 5 });
  await frame();
  const previewState = await page.evaluate(() => ({ board: preview.boxes[0], original: world.pieces[0], valid: preview.valid }));
  assert.equal(previewState.valid, true);
  assert.ok(Math.abs(previewState.board.c[0] - 80) < .5, 'The board follows the drag plane');
  assert.deepEqual(previewState.board.s, [96, 1.5, 5.5]);
  closeTo(previewState.board.c[1], .75, 'Movement preserves the support elevation');
  closeTo(previewState.original.c[0], 48, 'Changes remain reversible until release');
  await page.mouse.up();
  const pieces = await page.evaluate(() => world.pieces);
  assert.equal(pieces.length, 1);
  assert.deepEqual(pieces[0].s, [96, 1.5, 5.5]);
  assert.ok(Math.abs(pieces[0].c[0] - 80) < .5);
});

test('a blocked edit leaves the original piece intact', async () => {
  await selectedBoardScene([{ id: 2, g: null, c: [160, .75, 0], s: [32, 1.5, 5.5], n: 'Obstacle', layer: 'Floor' }]);
  await page.mouse.down();
  const next = await page.evaluate(() => project(vAdd(gesture.point, [100, 0, 0])));
  await page.mouse.move(next[0], next[1], { steps: 5 });
  await frame();
  assert.equal(await page.evaluate(() => preview.valid), false);
  await page.mouse.up();
  closeTo(await page.evaluate(() => world.pieces[0].c[0]), 48, 'Blocked movement does not alter the saved object');
});

test('Escape cancels an edit without losing the selected object', async () => {
  await selectedBoardScene();
  await page.mouse.down();
  const next = await page.evaluate(() => project(vAdd(gesture.point, [32, 0, 0])));
  await page.mouse.move(next[0], next[1]);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  closeTo(await page.evaluate(() => world.pieces[0].c[0]), 48, 'Cancellation preserves the original location');
  assert.equal(await page.evaluate(() => gesture), null);
  await page.keyboard.press('w');
  await page.waitForFunction(() => document.pointerLockElement === canvas);
});

test('a wall assembly moves as one object and keeps its editable recipe in sync', async () => {
  await page.mouse.move(640, 400);
  const before = await page.evaluate(() => {
    equip(0); Object.assign(settings, defaults);
    world = { name: 'Assembly edit', pieces: [], groups: {}, guides: [], next: 1 };
    const id = addGroup('wall', { a: [0, 0], b: [96, 0], y: 0, stud: '2x6', oc: 16, height: 97.125, tops: 2, header: '2x10', openings: [] });
    eye = [48, 50, 200]; yaw = 0; pitch = 0; sceneDirty = geometryDirty = mouse.dirty = true;
    return { id, pieces: copy(world.pieces), group: copy(world.groups[id]) };
  });
  await frame();
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'move' && !!gesture.editGroup);
  const next = await page.evaluate(() => project(vAdd(gesture.point, [32, 0, 0])));
  await page.mouse.move(next[0], next[1], { steps: 5 });
  await frame();
  assert.equal(await page.evaluate(() => preview.valid), true, 'Original connections inside the assembly remain allowed');
  await page.mouse.up();
  const after = await page.evaluate(id => ({ pieces: world.pieces, group: world.groups[id] }), before.id);
  assert.equal(after.pieces.length, before.pieces.length);
  const delta = after.group.a[0] - before.group.a[0];
  assert.ok(delta > 31 && delta < 33);
  closeTo(after.group.b[0] - before.group.b[0], delta, 'Both recipe endpoints move together');
  for (let i = 0; i < after.pieces.length; i++) {
    closeTo(after.pieces[i].c[0] - before.pieces[i].c[0], delta, 'Every component receives the same translation');
    assert.deepEqual(after.pieces[i].s, before.pieces[i].s);
  }
  await page.keyboard.press('Control+z');
  assert.deepEqual(await page.evaluate(id => world.groups[id], before.id), before.group);
});

test('an assembly drag cannot pass through another assembly', async () => {
  await page.mouse.move(640, 400);
  const before = await page.evaluate(() => {
    equip(0); Object.assign(settings, defaults);
    world = { name: 'Assembly collision', pieces: [], groups: {}, guides: [], next: 1 };
    const shape = { a: [0, 0], b: [96, 0], y: 0, stud: '2x6', oc: 16, height: 97.125, tops: 2, header: '2x10', openings: [] };
    const id = addGroup('wall', copy(shape));
    addGroup('wall', { ...copy(shape), a: [160, 0], b: [256, 0] });
    eye = [48, 50, 200]; yaw = 0; pitch = 0; sceneDirty = geometryDirty = mouse.dirty = true;
    return { id, group: copy(world.groups[id]) };
  });
  await frame(); await page.mouse.down();
  await page.waitForFunction(() => !!gesture?.editGroup);
  const next = await page.evaluate(() => project(vAdd(gesture.point, [100, 0, 0])));
  await page.mouse.move(next[0], next[1], { steps: 5 });
  await frame();
  assert.equal(await page.evaluate(() => preview.valid), false);
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(id => world.groups[id], before.id), before.group);
});

test('turning midpoint and layout magnets off leaves the drag on the fine grid', async () => {
  await beginPlateDrag({ snapMids: false, layoutSnap: false, snap: .0625 });
  await dragEndpoint(95.3);
  const result = await page.evaluate(() => ({ length: preview.boxes[0].s[0], snap: preview.snapInfo, raw: gesture.amount }));
  assert.equal(result.snap, null);
  assert.ok(Math.abs(result.raw - 95.3) < 1.5, 'The camera aim follows the target within one angular input pixel');
  closeTo(result.length, Math.round(result.raw * 16) / 16, 'Only the requested fine grid is applied to the actual aim');
  assert.notEqual(result.length, 96);
  closeTo(result.length * 16, Math.round(result.length * 16), 'The endpoint stays on the 1/16-inch grid');
  await page.mouse.up();
});

test('opening precision during an edit cancels the preview and restores the original drawing', async () => {
  await selectedBoardScene();
  const originalDraw = await page.evaluate(() => drawCounts[0]);
  await page.mouse.down();
  const next = await page.evaluate(() => project(vAdd(gesture.point, [32, 0, 0])));
  await page.mouse.move(next[0], next[1]);
  await frame();
  await page.keyboard.press('c');
  await page.mouse.up();
  await frame();
  assert.equal(await page.evaluate(() => gesture), null);
  closeTo(await page.evaluate(() => world.pieces[0].c[0]), 48, 'Opening numeric controls does not commit an unfinished move');
  assert.equal(await page.locator('#right').isVisible(), true);
  assert.equal(await page.evaluate(() => drawCounts[0]), originalDraw, 'The original solid is drawn again after cancelling its preview');
});

test('WASD can move the camera during a length drag without moving its start', async () => {
  await beginPlateDrag();
  await dragEndpoint(63.5);
  const before = await page.evaluate(() => ({ eye: [...eye], anchor: [...gesture.point] }));
  await page.keyboard.down('d');
  await page.waitForFunction(x => eye[0] > x + 3, before.eye[0]);
  await page.keyboard.up('d');
  const after = await page.evaluate(() => ({ eye: [...eye], anchor: [...gesture.point], valid: preview.valid }));
  assert.notDeepEqual(after.eye, before.eye);
  assert.deepEqual(after.anchor, before.anchor);
  assert.equal(after.valid, true);
  await page.mouse.up();
  const board = await page.evaluate(() => world.pieces.find(b => b.id === 2));
  closeTo(board.c[0] - board.s[0] / 2, before.anchor[0], 'The placed board still begins at the fixed world anchor');
});

test('R changes the active drag direction and Shift+R reverses it', async () => {
  await beginPlateDrag();
  await dragEndpoint(63.5);
  await page.keyboard.press('r');
  await frame();
  const vertical = await page.evaluate(() => ({ axis: gesture.axis, board: preview.boxes[0], anchor: [...gesture.point] }));
  assert.equal(vertical.axis, 1, 'The cached drag axis updates with R');
  closeTo(vertical.board.s[1], 64, 'Turning preserves the drawn length');
  closeTo(vertical.board.c[1] - vertical.board.s[1] / 2, 1.5, 'The rotated piece remains on the support');
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  await frame();
  const anchor = await page.evaluate(() => [...gesture.point]);
  await page.keyboard.press('Shift+r');
  await frame();
  const reversed = await page.evaluate(() => ({ axis: gesture.axis, board: preview.boxes[0], anchor: [...gesture.point], valid: preview.valid }));
  assert.equal(reversed.axis, 0);
  assert.deepEqual(reversed.anchor, anchor, 'Reversing keeps the same fixed start');
  closeTo(reversed.board.c[0] + reversed.board.s[0] / 2, anchor[0], 'The board now extends in the opposite direction');
  assert.equal(reversed.valid, true);
  await page.mouse.up();
});

async function concreteScene() {
  await page.mouse.move(640, 400); dragPointer = { x: 640, y: 400 };
  await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 96, alignment: 'Center' });
    world = { name: 'Concrete seating', pieces: [{ id: 1, g: 'G1', c: [96, -16, 0], s: [192, 48, 8], n: 'Foundation wall', layer: 'Foundation' }], groups: { G1: { kind: 'foundation', a: [0, 0], b: [192, 96], y: 8 } }, guides: [], next: 2 };
    eye = [48, 100, 300]; yaw = 0; pitch = -Math.atan((100 - 8) / 300);
    sceneDirty = geometryDirty = mouse.dirty = true;
  });
  await frame();
}

test('concrete does not override the chosen direction before or during drawing', async () => {
  await concreteScene();
  await page.keyboard.press('r'); await frame();
  closeTo(await page.evaluate(() => preview.boxes[0].s[1]), 96, 'Vertical direction remains a full length board');
  await page.keyboard.press('r'); await frame();
  assert.equal(await page.evaluate(() => preview.boxes[0].placementAxis), 2, 'A sill can run across the wall');
  await page.mouse.down(); await page.waitForFunction(() => gesture?.type === 'length');
  await page.keyboard.press('r'); await frame();
  assert.equal(await page.evaluate(() => gesture.axis), 0, 'The active concrete-supported drag can turn too');
  closeTo(await page.evaluate(() => preview.boxes[0].s[0]), 96, 'Turning preserves the stock length before a drag');
  await page.mouse.up();
});

test('B seats material flush outside, inside, or centered on concrete during a drag', async () => {
  await concreteScene();
  await page.mouse.down();
  await page.waitForFunction(() => gesture?.type === 'length' && document.pointerLockElement === canvas);
  await dragEndpoint(63.5);
  for (const [mode, z] of [['Inside', 1.25], ['Outside', -1.25], ['Center', 0]]) {
    await page.keyboard.press('b'); await frame();
    const state = await page.evaluate(() => ({ mode: settings.alignment, board: preview.boxes[0], valid: preview.valid }));
    assert.equal(state.mode, mode);
    closeTo(state.board.c[2], z, `${mode} uses the selected concrete reference`);
    closeTo(state.board.c[1] - state.board.s[1] / 2, 8, 'The sill remains exactly on top of concrete');
    assert.equal(state.valid, true);
    assert.match(await page.locator('#alignmentToggle').textContent(), new RegExp(mode));
  }
  await page.mouse.up();
});

test('top-edge inference places successive boards directly beside each other with no skipped slot', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 96 });
    world = { name: 'Adjacent boards', pieces: [{ id: 1, g: null, c: [48, .75, 0], s: [96, 1.5, 5.5], n: 'Existing sill', layer: 'Floor' }], groups: {}, guides: [], next: 2 };
    const states = [];
    for (const z of [2.6, 8.1]) {
      const source = world.pieces.at(-1);
      preview = buildGhost({ box: source, point: [0, 1.5, z], normal: [0, 1, 0] });
      states.push({ valid: preview.valid, board: copy(preview.boxes[0]) });
      finalizePrimitive();
    }
    return { states, pieces: world.pieces };
  });
  assert.equal(result.pieces.length, 3);
  for (let i = 1; i < 3; i++) {
    assert.equal(result.states[i - 1].valid, true);
    closeTo(result.pieces[i].c[2] - result.pieces[i - 1].c[2], 5.5, 'Centers advance by exactly one board width');
    closeTo(result.pieces[i].c[1], .75, 'Adjacent pieces retain the same seating elevation');
  }
});

test('thin studs snap against the very next stud face instead of leaving one stud gap', async () => {
  const pieces = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Standard stud'));
    Object.assign(settings, defaults, { axis: 1, grip: 'Start', len: 96 });
    world = { name: 'Stud pack', pieces: [{ id: 1, g: null, c: [0, 48, 0], s: [1.5, 96, 5.5], n: 'Existing stud', layer: 'Walls' }], groups: {}, guides: [], next: 2 };
    for (const x of [.65, 2.15]) {
      preview = buildGhost({ box: world.pieces.at(-1), point: [x, 96, 0], normal: [0, 1, 0] });
      finalizePrimitive();
    }
    return world.pieces;
  });
  assert.equal(pieces.length, 3);
  closeTo(pieces[1].c[0], 1.5, 'Second stud directly touches the first');
  closeTo(pieces[2].c[0], 3, 'Third stud directly touches the second');
  assert.ok(pieces.every(b => b.c[1] === 48), 'All studs sit at the same base elevation');
});

test('a butt joint takes priority over concrete layout marks', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 96, alignment: 'Center' });
    const concrete = { id: 1, g: null, c: [96, -16, 0], s: [192, 48, 8], n: 'Foundation wall', layer: 'Foundation' };
    world = { name: 'Butt on concrete', pieces: [concrete, { id: 2, g: null, c: [25, 8.75, 0], s: [50, 1.5, 5.5], n: 'First sill', layer: 'Floor' }], groups: {}, guides: [], next: 3 };
    const state = buildGhost({ box: concrete, point: [49.9, 8, 3.5], normal: [0, 1, 0] });
    return { board: state.boxes[0], valid: state.valid, label: state.snapInfo?.label };
  });
  assert.equal(result.valid, true);
  closeTo(result.board.c[0] - result.board.s[0] / 2, 50, 'The start joins the neighbor at 50 inches instead of using the 48-inch layout mark');
  assert.match(result.label, /Butt joint/);
});

test('length snapping stops at the first blocking piece instead of skipping to a farther one', async () => {
  const state = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start' });
    world.pieces = [{ id: 1, g: null, c: [100, .75, 0], s: [1.5, 1.5, 40], n: 'First rim', layer: 'Floor' }, { id: 2, g: null, c: [132, .75, 0], s: [1.5, 1.5, 40], n: 'Second rim', layer: 'Floor' }];
    const state = lengthPreview({ base: { c: [48, .75, 0], s: [96, 1.5, 5.5], n: 'Joist', layer: 'Floor' }, axis: 0, point: [0, .75, 0], anchor: 0, grip: 'Start', startSign: 1, amount: 131.2 });
    return { length: state.boxes[0].s[0], valid: state.valid, target: state.snapTarget };
  });
  assert.equal(state.valid, true);
  closeTo(state.length, 99.25, 'The endpoint stays at the nearest physical joint');
  assert.equal(state.target, 'First rim');
});

test('snapping beside a far end aligns the run instead of starting one whole board later', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 96 });
    const existing = { id: 1, g: null, c: [48, .75, 0], s: [96, 1.5, 5.5], n: 'Existing sill', layer: 'Floor' };
    world = { name: 'Aligned neighbors', pieces: [existing], groups: {}, guides: [], next: 2 };
    const state = buildGhost({ box: existing, point: [95.9, 1.5, 2.6], normal: [0, 1, 0] });
    return { board: state.boxes[0], valid: state.valid };
  });
  assert.equal(result.valid, true);
  closeTo(result.board.c[0] - result.board.s[0] / 2, 0, 'The adjacent board shares the existing start');
  closeTo(result.board.c[0] + result.board.s[0] / 2, 96, 'The adjacent board shares the existing end');
  closeTo(result.board.c[2], 5.5, 'It sits exactly one width beside the existing board');
});

test('R rotates a short panel using its intended length axis during drawing', async () => {
  await page.mouse.move(640, 400); dragPointer = { x: 640, y: 400 };
  await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Subfloor 4×8'));
    Object.assign(settings, defaults, { width: 48, len: 24, depth: .75, flip: 0, grip: 'Start' });
    world = { name: 'Short panel', pieces: [], groups: {}, guides: [], next: 1 };
    eye = [0, 100, 300]; yaw = 0; pitch = -Math.atan(100 / 300);sceneDirty = geometryDirty = mouse.dirty = true;
  });
  await page.keyboard.press('r'); await frame();
  assert.equal(await page.evaluate(() => preview.boxes[0].placementAxis), 0);
  await page.mouse.down(); await page.waitForFunction(() => gesture?.type === 'length');
  await dragEndpoint(15.8);
  await page.keyboard.press('r'); await frame();
  const state = await page.evaluate(() => ({ axis: gesture.axis, board: preview.boxes[0], valid: preview.valid }));
  assert.equal(state.axis, 2, 'The panel turns from X to Z');
  closeTo(state.board.s[2], 16, 'The short drawn length stays the length after turning');
  closeTo(state.board.s[0], 48, 'The sheet width is preserved');
  assert.equal(state.valid, true);
  await page.mouse.up();
});

test('Alt slows camera movement for fine length adjustment without an endpoint jump', async () => {
  await beginPlateDrag(); await dragEndpoint(63.5);
  const before = await page.evaluate(() => ({ raw: gesture.amount, yaw }));
  await page.keyboard.down('Alt'); await frame();
  closeTo(await page.evaluate(() => gesture.amount), before.raw, 'Entering fine adjustment preserves the current unsnapped endpoint');
  dragPointer.x += 9;
  await page.mouse.move(dragPointer.x, dragPointer.y); await frame();
  const after = await page.evaluate(() => ({ raw: gesture.amount, yaw, snap: preview.snapInfo }));
  assert.ok(after.yaw - before.yaw > .001 && after.yaw - before.yaw < .004, 'Fine adjustment uses a smaller camera step');
  assert.ok(Math.abs(after.raw - before.raw) < 2, 'The length changes gradually');
  assert.equal(after.snap, null);
  await page.keyboard.up('Alt'); await page.mouse.up();
});

test('an occupied adjacent face is blocked without skipping to a gap or stacking above', async () => {
  const result = await page.evaluate(() => {
    equip(MATERIALS.findIndex(item => item.name === 'Pressure-treated sill'));
    Object.assign(settings, defaults, { axis: 0, grip: 'Start', len: 96 });
    const source = { id: 1, g: null, c: [48, .75, 0], s: [96, 1.5, 5.5], n: 'First sill', layer: 'Floor' };
    world = { name: 'Occupied neighbor', pieces: [source, { ...copy(source), id: 2, c: [48, .75, 5.5], n: 'Second sill' }], groups: {}, guides: [], next: 3 };
    preview = buildGhost({ box: source, point: [0, 1.5, 2.6], normal: [0, 1, 0] });
    const result = { valid: preview.valid, board: copy(preview.boxes[0]) };
    finalizePrimitive();return { ...result, count: world.pieces.length };
  });
  assert.equal(result.valid, false);
  assert.equal(result.count, 2);
  closeTo(result.board.c[2], 5.5, 'The intended neighboring slot stays selected');
  closeTo(result.board.c[1], .75, 'Blocked inference does not silently stack the board');
});
