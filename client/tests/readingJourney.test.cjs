const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/readingJourney.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {readingJourney,journeySeek,journeyPosition,journeySeconds,departingFlight,journeyReadingPosition,journeySeekTarget,parseJourneyMode}=context.exports;
test('first two pages hold the opening sky and last two hold the final sky',()=>{
 for(const position of [0,1,2])assert.equal(readingJourney(position,338).progress,0);
 assert.ok(readingJourney(2.1,338).progress>0);
 for(const position of [336,337,338])assert.equal(readingJourney(position,338).night,1);
 assert.equal(readingJourney(338,338).page,338);
});
test('night-first reverses daylight without reversing the physical left to right route',()=>{
 for(const p of [0,20,80,169,250,338]){const day=readingJourney(p,338),night=readingJourney(p,338,true);assert.ok(Math.abs(day.night+night.night-1)<1e-10);assert.equal(day.x,night.x);}
 assert.equal(readingJourney(169,338).dusk,1);assert.equal(readingJourney(0,338,true).night,1);assert.equal(readingJourney(338,338,true).night,0);
});
test('drag endpoints reach actual beginning and end; interior positions round-trip',()=>{
 assert.equal(journeySeek(-1,338),0);assert.equal(journeySeek(2,338),338);
 for(const t of [.1,.3,.5,.8])assert.ok(Math.abs(readingJourney(journeySeek(t,338),338).progress-t)<1e-10);
});
test('compressed preview keeps both holds and round-trips time including the end',()=>{
 assert.equal(journeyPosition(3,338),2);assert.equal(journeyPosition(37,338),336);assert.equal(journeyPosition(40,338),338);
 for(const t of [0,1,3,7,20,37,39,40])assert.ok(Math.abs(journeySeconds(journeyPosition(t,338),338)-t)<1e-8);
});
test('companions exchange after dusk; outgoing flight ends above the scene',()=>{
 assert.equal(readingJourney(0,338).departure,0);assert.equal(readingJourney(169,338).arrival,0);assert.equal(readingJourney(336,338).departure,1);assert.equal(readingJourney(336,338).arrival,1);assert.ok(departingFlight(1).y<-600);
});
test('real page order and media progress drive the sky even with gaps in printed numbering',()=>{
 const pages=[{number:2},{number:7},{number:11},{number:30}];
 assert.equal(journeyReadingPosition(11,pages,50),2.5);assert.equal(journeyReadingPosition(99,pages,80),0);
 assert.equal(journeyReadingPosition(30,pages,150),4);
 const target=journeySeekTarget(2.75,pages);assert.equal(target.number,11);assert.equal(target.percent,75);
 assert.equal(journeySeekTarget(4,pages).number,30);assert.equal(journeySeekTarget(4,pages).percent,0);assert.equal(journeySeekTarget(0,[]),null);
});
test('night-only stays dark while the half moon grows monotonically to full, including the end holds',()=>{
 let previous=.5;for(const p of [0,1,2,30,80,169,260,336,337,338]){const sky=readingJourney(p,338,false,'night');assert.equal(sky.night,1);assert.equal(sky.sunOpacity,0);assert.equal(sky.moonOpacity,1);assert.equal(sky.dusk,0);assert.ok(sky.moonIllumination>=previous);previous=sky.moonIllumination;}
 assert.equal(readingJourney(2,338,true,'night').moonIllumination,.5);assert.equal(readingJourney(336,338,true,'night').moonIllumination,1);
});
test('day-only keeps daylight and a visible sun from warm dawn through golden sunset',()=>{
 for(const p of [0,30,169,260,338]){const sky=readingJourney(p,338,true,'day');assert.equal(sky.night,0);assert.equal(sky.sunOpacity,1);assert.equal(sky.moonOpacity,0);}
 assert.ok(readingJourney(0,338,false,'day').dusk>readingJourney(169,338,false,'day').dusk);assert.ok(readingJourney(338,338,false,'day').dusk>.7);
});
test('all three modes retain the same seeking route and safely parse persisted choices',()=>{
 for(const p of [0,80,169,338])for(const mode of ['cycle','night','day']){const sky=readingJourney(p,338,false,mode),base=readingJourney(p,338);assert.equal(sky.x,base.x);assert.equal(sky.progress,base.progress);assert.equal(sky.page,base.page);}
 assert.equal(parseJourneyMode('night'),'night');assert.equal(parseJourneyMode('day'),'day');for(const value of [null,'invalid',{},'cycle'])assert.equal(parseJourneyMode(value),'cycle');
});
