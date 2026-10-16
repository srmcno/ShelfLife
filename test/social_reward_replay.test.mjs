import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, localDayKey } from '../src/state.js';
import { householdFixture } from './household-fixtures.mjs';
import { planFullBench, JOINT_BENCH_DAILY } from '../src/engine/court-joint.js';
import { planShoo, dismissHaunt, receiveInbox, outboxFor, clearOutbox } from '../src/engine/mischief.js';
import { rewardDay } from '../src/reward-state.js';
import { currencyRewardId, queueCoopReward, bindCoopMoney, applyCoopReward, readCoopRewardDetail } from '../src/engine/coop-money.js';
import { applyCoopReceipts } from '../src/engine/coop.js';
const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const A = U(1), B = U(2), NOW = Date.UTC(2026, 9, 14, 12), DAY = 86400000;
const shelf = () => normalizeState(householdFixture('established', NOW), NOW);
const receipt = (plan, operation, n = 1) => ({ ...plan, id: U(900+n), sourceId: operation, owner: A, kind: 'game', seq: n });
const haunt = (s, ref) => { s.mischief.user = A; s.mischief.haunt = { ref, ends: NOW+DAY, arrived: NOW, shooed: false, paid: false, from: { userId:B,name:'Bea' }, ghost: { id:'qa0',name:'Ghost',traits:[],mood:'fine',bond:0,art:{} } }; };

test('reward dates use the real zero-based local month and reject overflow calendar days', () => {
  assert.equal(rewardDay('2026-0-1'), '2026-0-1');
  assert.equal(rewardDay('2026-11-31'), '2026-11-31');
  assert.equal(rewardDay('2026-09-14'), '2026-9-14');
  assert.equal(rewardDay('2024-1-29'), '2024-1-29');
  for (const day of ['2026-1-29','2026-12-1','2026-3-31','2026-0-0','2026-9-99','2026-10-1x']) assert.equal(rewardDay(day), '');
});

test('Joint receipts replay once after restore, retain original-day caps and separate accounts', async () => {
  const s = shelf(), old = structuredClone(s); bindCoopMoney(s,A); bindCoopMoney(old,A);
  const before = s.mayhem.souls;
  for (let i=0; i<JOINT_BENCH_DAILY+1; i++) {
    const id=U(10+i), plan=planFullBench(s,id,'full',A,NOW), operation=await currencyRewardId(A,'joint_bench:'+id);
    assert.equal(plan.detail.paid,i<3); queueCoopReward(s,{...plan,id:operation,owner:A});
    assert.equal(s.mayhem.souls,before+Math.min(i,3)*25);
    const row=receipt(plan,operation,i+1); applyCoopReceipts(s,A,[row]); applyCoopReceipts(s,A,[row]); applyCoopReceipts(old,A,[row]);
  }
  assert.equal(s.mayhem.souls,before+75); assert.equal(old.mayhem.souls,s.mayhem.souls);
  assert.equal(planFullBench(old,U(13),'full',A,NOW+DAY),null,'zero capped receipt stays consumed on a later day');
  assert.equal(planFullBench(old,U(20),'full',A,NOW+DAY).detail.paid,true,'old receipts do not occupy tomorrow');
  assert.equal(planFullBench(old,U(10),'full',B,NOW).detail.paid,true,'other account owns different proof');
  old.courtroom.joint.paid=[];
  const reload=normalizeState(old,NOW);
  assert.equal(planFullBench(reload,U(10),'full',A,NOW),null,'history survives the clipped display');
  assert.equal(Object.keys(reload.courtroom.joint.rewards[A]).length,4);
});

test('ghost dismissal and its proposal survive offline reload without cash, then replay once with original-day caps', async () => {
  const s=shelf(); bindCoopMoney(s,A); const before=s.mayhem.souls;
  const records=[];
  for (let i=0;i<3;i++) {
    const ref=U(30+i); haunt(s,ref);
    const plan=planShoo(s,5,A,NOW), operation=await currencyRewardId(A,'mischief_shoo:'+ref);
    assert.equal(plan.detail.paid,i<2,'pending rewards reserve both daily slots');
    queueCoopReward(s,{...plan,id:operation,owner:A}); dismissHaunt(s,5,NOW);
    records.push(receipt(plan,operation,i+1));
  }
  assert.equal(s.mayhem.souls,before); assert.equal(outboxFor(s,A).filter(op=>op.op==='shoo').length,3);
  const reload=normalizeState(s,NOW+8*DAY);
  assert.equal(outboxFor(reload,A).filter(op=>op.op==='shoo').length,3,'unreported shoo proof is durable beyond activity expiry');
  assert.equal(reload.coop.money.pending.length,3);
  applyCoopReceipts(reload,A,records); applyCoopReceipts(reload,A,records);
  assert.equal(reload.mayhem.souls,before+30); assert.equal(Object.keys(reload.mischief.shooRewards[A]).length,3);
  const old=shelf(); bindCoopMoney(old,A); old.mischief.user=A; old.mischief.paid={day:localDayKey(NOW+DAY),help:0,knock:0,shoo:0};
  applyCoopReceipts(old,A,records);
  assert.equal(old.mischief.paid.shoo,0,'yesterday replay does not consume today');
  old.mischief.done=[];
  receiveInbox(old,{hexes:[],helps:[],hauntings:[{id:U(30),ghost:{id:'qa0',name:'Ghost',art:{}},fromUser:B,fromName:'Bea',createdAt:NOW,endsAt:NOW+DAY}]},A,NOW);
  assert.equal(old.mischief.haunt,null,'financial proof prevents pruned activity from restoring the same ghost');
});

test('ghost effects from an old account cannot dismiss the replacement visitor and malformed proofs are refused', () => {
  const s=shelf();haunt(s,U(30));s.mischief.user=B;
  applyCoopReward(s,A,{reward:'mischief_shoo',haunt_id:U(30),day:localDayKey(NOW),paid:true,taps:5});
  assert.equal(s.mischief.haunt.shooed,false);assert.ok(s.mischief.shooRewards[A][U(30)]);
  assert.equal(readCoopRewardDetail({reward:'mischief_shoo',haunt_id:U(30),day:localDayKey(NOW),paid:true,taps:4}),null);
  assert.equal(readCoopRewardDetail({reward:'joint_bench',hearing:U(30),day:'2026-1-30',paid:true}),null);
});


test('ownerless prototype reports remain quarantined through reload and account changes', () => {
  const s=shelf();
  s.mischief.outbox=[{op:'shoo',ref:U(50),user:'',taps:5,at:NOW},{op:'resolve',ref:U(51),user:'',choice:0,outcome:0,rebound:false,at:NOW}];
  const loaded=normalizeState(s,NOW+8*DAY);
  assert.equal(loaded.mischief.outbox.length,2,'unowned reports remain available for recovery');
  assert.deepEqual(outboxFor(loaded,A),[]);assert.deepEqual(outboxFor(loaded,B),[]);assert.deepEqual(outboxFor(loaded,''),[]);
  loaded.mischief.user=A;
  receiveInbox(loaded,{hexes:[],helps:[],hauntings:[]},B,NOW+8*DAY);
  assert.equal(loaded.mischief.outbox.length,2);assert.deepEqual(outboxFor(loaded,B),[]);
});


test('a quarantined or other-owner report cannot block the current authenticated shoo', () => {
  const s=shelf(), ref=U(70);haunt(s,ref);
  s.mischief.outbox=[{op:'shoo',ref,user:'',taps:5,at:NOW},{op:'shoo',ref,user:B,taps:5,at:NOW}];
  dismissHaunt(s,5,NOW);
  assert.equal(s.mischief.outbox.length,3);assert.equal(outboxFor(s,A).length,1);
  haunt(s,ref);dismissHaunt(s,5,NOW);
  assert.equal(outboxFor(s,A).length,1,'verified-owner retry is still deduplicated');
  clearOutbox(s,outboxFor(s,A));
  assert.deepEqual(s.mischief.outbox.map(item=>item.user),['',B],'recovery evidence and other account reports remain');
});
