import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWillowCanvasGeometry,
  configureWillowCanvasContext,
  drawWillowCanvasFrame,
  type CanvasRenderContext2D,
} from './willowCanvasIntro';

function createMockCanvasContext() {
  let strokeCalls = 0;
  let fillCalls = 0;
  let beginPathCalls = 0;
  let moveToCalls = 0;
  let bezierCalls = 0;
  let lineToCalls = 0;
  let quadraticCalls = 0;
  let fillStyleChanges = 0;
  let strokeStyleChanges = 0;

  let currentFillStyle: string | CanvasGradient | CanvasPattern = '#000';
  let currentStrokeStyle: string | CanvasGradient | CanvasPattern = '#000';

  const ctx: CanvasRenderContext2D = {
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val) {
      currentFillStyle = val;
      fillStyleChanges++;
    },
    get strokeStyle() {
      return currentStrokeStyle;
    },
    set strokeStyle(val) {
      currentStrokeStyle = val;
      strokeStyleChanges++;
    },
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save: () => {},
    restore: () => {},
    beginPath: () => {
      beginPathCalls++;
    },
    moveTo: () => {
      moveToCalls++;
    },
    lineTo: () => {
      lineToCalls++;
    },
    quadraticCurveTo: () => {
      quadraticCalls++;
    },
    bezierCurveTo: () => {
      bezierCalls++;
    },
    closePath: () => {},
    rect: () => {},
    clip: () => {},
    fill: () => {
      fillCalls++;
    },
    stroke: () => {
      strokeCalls++;
    },
  };

  return {
    ctx,
    getCounts: () => ({
      strokeCalls,
      fillCalls,
      beginPathCalls,
      moveToCalls,
      bezierCalls,
      lineToCalls,
      quadraticCalls,
      fillStyleChanges,
      strokeStyleChanges,
    }),
    resetCounts: () => {
      strokeCalls = 0;
      fillCalls = 0;
      beginPathCalls = 0;
      moveToCalls = 0;
      bezierCalls = 0;
      lineToCalls = 0;
      quadraticCalls = 0;
      fillStyleChanges = 0;
      strokeStyleChanges = 0;
    },
  };
}

test('builds deterministic weeping willow canvas geometry matching 74 strands and >1000 leaves', () => {
  const a = buildWillowCanvasGeometry();
  const b = buildWillowCanvasGeometry();

  assert.equal(a.strands.length, 74);
  assert.equal(b.strands.length, 74);

  const totalLeaves =
    a.backLeaves.length + a.middleLeaves.length + a.frontAndLaurelLeaves.length;
  assert.ok(totalLeaves > 1200, `Expected >1200 leaves, got ${totalLeaves}`);
  assert.deepEqual(a.strands[0], b.strands[0]);
  assert.deepEqual(a.frontAndLaurelLeaves[10], b.frontAndLaurelLeaves[10]);
});

test('uses a single beginPath, single fill, single stroke, quadraticCurveTo, and zero per-frame style changes', () => {
  const geometry = buildWillowCanvasGeometry();
  const mock = createMockCanvasContext();

  configureWillowCanvasContext(mock.ctx);
  assert.equal(mock.ctx.imageSmoothingEnabled, false);

  for (const progress of [0.15, 0.5, 0.85, 1.0]) {
    mock.resetCounts();
    mock.ctx.imageSmoothingEnabled = true;
    drawWillowCanvasFrame(mock.ctx, geometry, progress);
    const counts = mock.getCounts();

    assert.equal(mock.ctx.imageSmoothingEnabled, false);
    assert.equal(counts.beginPathCalls, 1);
    assert.equal(counts.fillCalls, 1);
    assert.equal(counts.strokeCalls, 1);
    assert.equal(counts.fillStyleChanges, 0);
    assert.equal(counts.strokeStyleChanges, 0);
    assert.equal(counts.lineToCalls, 0);
    assert.ok(counts.quadraticCalls > 0);
  }
});
