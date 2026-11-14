// Guard the CSS ownership boundary that caused content to slide under the sidebar.
// This checks the actual cascade selectors; it is not a browser layout/screenshot test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div class="scholar-shell"><main class="scholar-main mantine-AppShell-main"></main></div>');
const main=dom.window.document.querySelector('main');
for(const file of ['src/styles.css','src/scholarship.css']){
  const style=dom.window.document.createElement('style');
  style.textContent=readFileSync(file,'utf8');dom.window.document.head.append(style);
  function check(rules){for(const rule of rules){
    if(rule.media?.mediaText.includes('print'))continue;
    if(rule.cssRules){check(rule.cssRules);continue;}
    if(!rule.selectorText||rule.selectorText.startsWith('@'))continue;
    const selectors=rule.selectorText.split(',').filter(selector=>!selector.includes('::'));
    if(!selectors.some(selector=>main.matches(selector)))continue;
    for(let i=0;i<rule.style.length;i++){
      const property=rule.style[i];
      assert(!/^padding(?:-|$)/.test(property),`${file}: ${rule.selectorText} overrides AppShell's responsive offsets with ${property}`);
    }
  }}
  check(style.sheet.cssRules);
}
dom.window.close();
console.log('PASS: custom styles preserve AppShell sidebar/header padding across all screen media rules; print remains independent');
