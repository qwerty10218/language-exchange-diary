import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { svgPathProperties } from 'svg-path-properties';
import { createGuidedStroke, GUIDE_DEFAULTS } from '../src/stroke-engine.mjs';
import { points } from './path-samples.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../data/phase0.strokes.json'));
for (const [index, id, count] of [[1,'03042',3],[2,'030a2',2]]) {
  test(`${data.characters[index].display} 忠實保留已附來源的曲線、順序、比例與方向`,()=>{
    const c=data.characters[index],svg=read(`../public/strokes/sources/${id}.svg`);
    const hashes={ '03042':'3553cd24cba506dffe12e1214f231fc129c2535f719c1bdc86a9fb651aa9ec9b', '030a2':'f7dfe4a6af4c4622b611b5b1e92005fe3356c808dbb44ea0e877e02e46f6ee73' };
    assert.equal(createHash('sha256').update(svg).digest('hex'),hashes[id]);
    assert.match(svg,/viewBox="0 0 109 109"/);
    assert.match(svg,/Ulrich Apel/); assert.equal(c.license,'CC-BY-SA-3.0');
    const originals=[...svg.matchAll(new RegExp(`<path id="kvg:${id}-s(\\d+)" d="([^"]+)"`,'g'))];
    assert.equal(originals.length,count);assert.equal(c.paths.length,count);
    originals.forEach((match,i)=>{
      assert.equal(+match[1],i+1);
      // Compare every command/control point, not a self-comparison of sampled fixtures.
      assert.equal(c.paths[i],match[2].replace(/-?\d*\.?\d+/g,n=>String(+(Number(n)*1024/109).toFixed(6))));
      assert.match(c.paths[i],/c/);assert.doesNotMatch(c.paths[i],/L/);
      const original=new svgPathProperties(match[2]),normal=new svgPathProperties(c.paths[i]);
      for(let n=0;n<=100;n++){
        const a=original.getPointAtLength(original.getTotalLength()*n/100),b=normal.getPointAtLength(normal.getTotalLength()*n/100);
        assert.ok(Math.hypot(b.x-a.x*1024/109,b.y-a.y*1024/109)<.001);
      }
      const start=normal.getPointAtLength(0);
      assert.ok(Math.hypot(c.starts[i][0]-start.x,c.starts[i][1]-start.y)<.001);
    });
  });
}
test('高寬容模式仍不把舊遮罩動畫折線當作標準曲線',()=>{
  const original=read('../public/strokes/sources/12354.svg');
  const wrong=[...original.matchAll(/<path style="--d:(\d+)s;"[^>]* d="([^"]+)"/g)].slice(0,3).map(m=>m[2]);
  wrong.forEach((d,i)=>{
    assert.notEqual(data.characters[1].paths[i],d);
    assert.match(data.characters[1].paths[i],/c/);
  });
});
test('練習初值符合新規格，標準字形不隨容錯變動',()=>{
  assert.deepEqual([GUIDE_DEFAULTS.startRadius,GUIDE_DEFAULTS.snapRadius,GUIDE_DEFAULTS.maxDeviation,GUIDE_DEFAULTS.completion,GUIDE_DEFAULTS.closeRatio],[.15,.13,.20,.75,.60]);
});
