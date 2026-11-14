import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWillowCanvasGeometry,
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

  const ctx: CanvasRenderContext2D = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
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
    quadraticCurveTo: () => {},
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
    }),
    resetCounts: () => {
      strokeCalls = 0;
      fillCalls = 0;
      beginPathCalls = 0;
      moveToCalls = 0;
      bezierCalls = 0;
      lineToCalls = 0;
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

test('batches all canvas stroke calls into a single stroke() per frame across animation progress', () => {
  const geometry = buildWillowCanvasGeometry();
  const mock = createMockCanvasContext();

  for (const progress of [0.15, 0.5, 0.85, 1.0]) {
    mock.resetCounts();
    drawWillowCanvasFrame(mock.ctx, geometry, progress);
    const counts = mock.getCounts();

    assert.equal(
      counts.strokeCalls,
      1,
      `Expected exactly 1 batched ctx.stroke() call at progress=${progress}, got ${counts.strokeCalls}`,
    );
    assert.ok(
      counts.fillCalls <= 4,
      `Expected <=4 batched ctx.fill() calls at progress=${progress}, got ${counts.fillCalls}`,
    );
  }
});
