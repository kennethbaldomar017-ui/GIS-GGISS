const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../components/map/heatmap-renderer.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const { dominantStatus, STATUS_DOTS, getChoroplethColor, scatterCaseDots, insideArea } = context.exports;

for (const [counts, expected] of [
  [[10, 2, 1], 'normal'], [[2, 10, 1], 'moderate'], [[2, 1, 10], 'severe'],
  [[4, 3, 2], 'normal'], [[5, 5, 0], 'mixed'], [[0, 5, 5], 'mixed'], [[5, 0, 5], 'mixed'],
  [[1, 1, 1], 'mixed'], [[0, 0, 0], 'unavailable'], [[undefined, 3, 1], 'unavailable'],
  [[-1, 3, 1], 'unavailable'], [[NaN, 3, 1], 'unavailable'], [[1.5, 2, 3], 'unavailable'],
]) {
  test(`status counts ${counts.join('/')} produce ${expected}`, () => {
    assert.equal(dominantStatus({ normal_count: counts[0], moderate_count: counts[1], severe_count: counts[2] }), expected);
  });
}

test('semantic colors stay green, amber, red, purple, and gray', () => {
  assert.equal(STATUS_DOTS.normal.color, '#16a34a');
  assert.equal(STATUS_DOTS.moderate.color, '#f59e0b');
  assert.equal(STATUS_DOTS.severe.color, '#dc2626');
  assert.equal(STATUS_DOTS.mixed.color, '#8b5cf6');
  assert.equal(STATUS_DOTS.unavailable.color, '#94a3b8');
});

test('prevalence distinguishes absent measurements and exact thresholds', () => {
  assert.equal(getChoroplethColor(0, 0), '#cbd5e1');
  assert.equal(getChoroplethColor(0, 100), '#FFEDA0');
  assert.equal(getChoroplethColor(7, 100), '#FD8D3C');
  assert.equal(getChoroplethColor(20, 100), '#BD0026');
});

const auditPath = process.env.HEATMAP_AUDIT_FILE;
const polygon = { type:'Polygon', coordinates:[[[125.52,9.11],[125.54,9.11],[125.54,9.13],[125.53,9.12],[125.52,9.13],[125.52,9.11]],[[125.525,9.115],[125.527,9.115],[125.527,9.117],[125.525,9.117],[125.525,9.115]]] };
const sampleArea = {name:'Test',lat:9.12,lng:125.53,normal_count:22,moderate_count:4,severe_count:3,other_count:5,scatter_geometry:polygon};

test('land-shaped scatter is denser, stable, and excludes polygon holes', () => {
  const dots = scatterCaseDots(sampleArea,[],6);
  assert.ok(dots.length>34);
  assert.equal(JSON.stringify(dots),JSON.stringify(scatterCaseDots(sampleArea,[],6)));
  assert.equal(new Set(dots.map(dot=>`${dot.lat},${dot.lng}`)).size,dots.length);
  for(const dot of dots) assert.ok(insideArea(dot.lng,dot.lat,polygon));
  assert.ok(dots.some(dot=>dot.lng<125.523));
  assert.ok(dots.some(dot=>dot.lng>125.537));
  assert.equal(scatterCaseDots({...sampleArea,scatter_geometry:undefined},[]).length,0);
  assert.equal(scatterCaseDots({...sampleArea,normal_count:undefined},[]).length,0);
});

test('density changes visual coverage while retaining measured color proportions', () => {
  const low=scatterCaseDots(sampleArea,[],1);
  const high=scatterCaseDots(sampleArea,[],12);
  assert.ok(high.length>low.length);
  for(const dots of [low,high]) for(const [status,count] of Object.entries({normal:22,moderate:4,severe:3,other:5})) {
    const allocated=dots.filter(dot=>dot.status===status).length;
    assert.ok(Math.abs(allocated-dots.length*count/34)<=1);
  }
});

test('multipolygons populate separate land parts without filling the gap', () => {
  const geometry={type:'MultiPolygon',coordinates:[[[[0,0],[1,0],[1,1],[0,1],[0,0]]],[[[2,0],[3,0],[3,1],[2,1],[2,0]]]]};
  const dots=scatterCaseDots({...sampleArea,scatter_geometry:geometry},[],1);
  assert.ok(dots.some(dot=>dot.lng<1));
  assert.ok(dots.some(dot=>dot.lng>2));
  assert.ok(dots.every(dot=>insideArea(dot.lng,dot.lat,geometry)));
});

test('all live barangay dots follow their land polygons and preserve status proportions', {skip:!auditPath},()=>{
  const {observations,centers}=JSON.parse(fs.readFileSync(auditPath,'utf8')).heatmap;
  assert.equal(observations.length,31);
  for(const area of observations) {
    const dots=scatterCaseDots(area,centers);
    if(!area.total_children) {assert.equal(dots.length,0);continue;}
    assert.ok(dots.length>=area.total_children,area.name);
    for(const dot of dots) assert.ok(insideArea(dot.lng,dot.lat,area.scatter_geometry),area.name);
    for(const [status,key] of Object.entries({normal:'normal_count',moderate:'moderate_count',severe:'severe_count',other:'other_count'})) {
      const actual=dots.filter(dot=>dot.status===status).length;
      assert.ok(Math.abs(actual-dots.length*area[key]/area.total_children)<=1,`${area.name}: ${status}`);
    }
    assert.equal(JSON.stringify(dots),JSON.stringify(scatterCaseDots(area,[])),`${area.name}: role-independent geometry`);
  }
});

test('all live barangay dots use their measured status counts', { skip: !auditPath }, () => {
  const data = JSON.parse(fs.readFileSync(auditPath, 'utf8')).heatmap.observations;
  assert.ok(data.length > 0);
  for (const area of data) {
    assert.equal(area.normal_count + area.moderate_count + area.severe_count + area.other_count, area.total_children, area.name);
    const values = [area.normal_count, area.moderate_count, area.severe_count];
    const highest = Math.max(...values);
    const winners = values.filter(count => count === highest).length;
    const expected = highest === 0 ? 'unavailable' : winners > 1 ? 'mixed' : ['normal', 'moderate', 'severe'][values.indexOf(highest)];
    assert.equal(dominantStatus(area), expected, area.name);
  }
});
