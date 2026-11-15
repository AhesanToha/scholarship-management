import assert from 'node:assert/strict';
import {seed,parseCSV,buildCsvImportPreview} from '../src/lib/domain.js';

// The preview must show exactly what a CSV file would import — per school,
// per class and per shift — and flag every problem row before anything is
// sent, so the import is never silent and never rejected as a surprise.
const schools=[{id:'school-grammer',name:'Grammer School',active:true},{id:'school-aunushilon',name:'Aunushilon Academy',active:true}];
const base=()=>{const s=seed();s.schools=schools;s.schoolSubmissions=[];s.students=[];return s};
const csv=text=>parseCSV(text);

// A clean Grammer file: 10 students, 2 per class.
const grammer10=csv('name,school,grade\nAmin,"Grammer School",4\nBina,"Grammer School",4\nChad,"Grammer School",5\nDina,"Grammer School",5\nEmon,"Grammer School",6\nFari,"Grammer School",6\nGazi,"Grammer School",7\nHena,"Grammer School",7\nIrfan,"Grammer School",8\nJoya,"Grammer School",8\n');
const clean=buildCsvImportPreview(base(),grammer10);
assert.equal(clean.headerError,'');
assert.equal(clean.totalRows,10);
assert.equal(clean.valid.length,10,'all rows should be valid');
assert.equal(clean.problems.length,0);
assert.equal(clean.groups.length,1,'one school in the file');
assert.equal(clean.groups[0].schoolName,'Grammer School');
assert.equal(clean.groups[0].count,10);
assert.deepEqual(clean.groups[0].grades,{'4':2,'5':2,'6':2,'7':2,'8':2});
assert.deepEqual(clean.groups[0].shifts,{'shift-1':4,'shift-2':6},'Class 4-5 go to Shift 1, Class 6-8 to Shift 2');

// Two schools in one file group separately.
const mixed=buildCsvImportPreview(base(),csv('name,school,grade\nAmin,"Grammer School",4\nBina,"Aunushilon Academy",6\n'));
assert.equal(mixed.groups.length,2);
assert.equal(mixed.valid.length,2);

// Wrong header is a header error, not a silent empty preview.
const badHeader=buildCsvImportPreview(base(),csv('student,school,class\nAmin,"Grammer School",4\n'));
assert.equal(badHeader.headerError,'CSV headers must be name,school,grade.');
assert.equal(badHeader.valid.length,0);

// Problem rows are listed with their line number and reason, and the
// valid rows survive: unregistered school, bad class, twice in the file.
const messy=buildCsvImportPreview(base(),csv('name,school,grade\nAmin,"Grammer School",4\nBina,"Unknown School",5\nChad,"Grammer School",9\nAmin,"Grammer School",4\nDina,"Grammer School",6\n'));
assert.equal(messy.valid.length,2,'only the two good rows import');
assert.equal(messy.problems.length,3);
assert.equal(messy.problems[0].row,3,'the unregistered school is CSV line 3');
assert(messy.problems[0].reason.includes('Unknown School'));
assert.equal(messy.problems[1].row,4,'the bad class is CSV line 4');
assert.equal(messy.problems[2].row,5,'the repeat is CSV line 5');
assert(messy.problems[2].reason.includes('twice'));

// A row that already exists live (same name + class + school, no father
// name or guardian phone) is flagged — the server would reject the whole
// batch for it, so the preview must catch it first.
const withLive=base();
withLive.students.push({id:'live-1',name:'Amin',school:'Grammer School',schoolId:'school-grammer',grade:'4',roll:'260401',fatherName:'',guardianPhone:''});
const dup=buildCsvImportPreview(withLive,grammer10);
assert.equal(dup.valid.length,9,'the existing student is skipped');
assert.equal(dup.problems.length,1);
assert.equal(dup.problems[0].row,2);
assert(dup.problems[0].reason.includes('already exists'));
// …but the same name in a different class, or with a father name on the
// live record, is NOT a duplicate (the server compares those fields too).
const withLiveOther=base();
withLiveOther.students.push({id:'live-2',name:'Amin',school:'Grammer School',schoolId:'school-grammer',grade:'5',roll:'260501',fatherName:'',guardianPhone:''});
assert.equal(buildCsvImportPreview(withLiveOther,grammer10).valid.length,10);
const withLiveFather=base();
withLiveFather.students.push({id:'live-3',name:'Amin',school:'Grammer School',schoolId:'school-grammer',grade:'4',roll:'260401',fatherName:'Karim',guardianPhone:''});
assert.equal(buildCsvImportPreview(withLiveFather,grammer10).valid.length,10);

// The server rejects batches over 500 rows — the preview must say so
// before the user confirms, not after.
const letter=i=>String.fromCharCode(65+(i%26))+String.fromCharCode(65+(Math.floor(i/26)%26));
const rows501=Array.from({length:501},(_,i)=>['Student '+letter(i),'Grammer School','4']);
const over=buildCsvImportPreview(base(),[['name','school','grade'],...rows501]);
assert.equal(over.valid.length,501);
assert.equal(over.overLimit,true);

// An inactive school cannot receive imports.
const inactive=base();
inactive.schools[0].active=false;
const inact=buildCsvImportPreview(inactive,grammer10);
assert.equal(inact.valid.length,0);
assert(inact.problems[0].reason.includes('not a registered active school'));

console.log('PASS: CSV import preview — per-school/class/shift breakdown, problem rows with line numbers, live duplicates caught before sending');
