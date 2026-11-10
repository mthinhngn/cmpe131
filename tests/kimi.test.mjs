import test from 'node:test';
import assert from 'node:assert/strict';
import { accountItems, restoredItems } from '../src/kimi-memory.ts';

const swap = () => ({kind:'apply_plan_changes',operation:'swap',program_id:'ce',expected_revision:'v1',changes:[
  {kind:'move_course_in_plan',course_id:'a',program_id:'ce',expected_revision:'v1',previous_semester_slot:6,previous_status:'planned',semester_slot:7},
  {kind:'move_course_in_plan',course_id:'b',program_id:'ce',expected_revision:'v1',previous_semester_slot:7,previous_status:'in-progress',semester_slot:6}]});

test('restart restoration never turns unfinished work into an executable action',()=>{
  const item={query:'swap',request:{status:'awaiting_action',action:swap(),reply:''}};
  const restored=restoredItems([item],false)[0];
  assert.equal(restored.request.status,'failed'); assert.equal(restored.request.action,null);
  assert.equal(restoredItems([item],true)[0],item);
});
test('account history restoration pairs replies and marks unfinished messages interrupted',()=>{
  const items=accountItems([{role:'user',content:'hello'},{role:'assistant',content:'Hi'},{role:'user',content:'swap'}]);
  assert.equal(items[0].request.status,'completed');
  assert.equal(items[1].request.status,'failed'); assert.equal(items[1].request.action,null);
});
