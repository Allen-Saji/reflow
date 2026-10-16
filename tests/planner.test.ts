import {describe,it,expect} from 'vitest';
import {sampleFixture} from '../src/domain/fixture.js';
import {evaluateCandidates,planRecovery,validatePlan} from '../src/domain/planner.js';
import type{Snapshot,Impact}from'../src/domain/model.js';
const impact:Impact={orderIds:['O-101','O-102'],unaffectedOrderIds:['O-103'],paths:{}};
const snapshot=(quantity=80):Snapshot=>({...sampleFixture(quantity),version:2,stockReserved:0,offerAllocated:{},disruption:{factoryId:'factory_z',untilDay:8,sourceId:'src_notice'}});
const candidates=(s:Snapshot)=>evaluateCandidates(s,impact,{offer_a:[{ids:['offer_a','factory_z'],names:[],sourceIds:[]}],offer_b:[{ids:['offer_b','factory_z'],names:[],sourceIds:[]}]},{offer_a:['desk','task'],offer_b:['desk','task'],offer_c:['wall'],offer_d:['desk','task']});
describe('recovery constraints',()=>{
 it('covers two orders at a $160 premium with an $960 draft requisition',()=>{const s=snapshot(),c=candidates(s),p=planRecovery(s,impact,c);expect(p.completeOrders).toBe(2);expect(p.remainingShortage).toBe(0);expect(p.premiumCents).toBe(16000);expect(p.purchaseCents).toBe(96000);expect(p.stockUsed).toBe(20);expect(validatePlan(s,p,c)).toEqual([]);});
 it('reports the 30-unit shortfall when the quote drops to 50',()=>{const s=snapshot(50),p=planRecovery(s,impact,candidates(s));expect(p.completeOrders).toBe(1);expect(p.remainingShortage).toBe(30);expect(p.allocations.find(x=>x.orderId==='O-101')?.complete).toBe(true);expect(p.allocations.find(x=>x.orderId==='O-102')?.covered).toBe(10);});
 it('honors a binding premium cap',()=>{const s={...snapshot(),premiumCapCents:8000},p=planRecovery(s,impact,candidates(s));expect(p.premiumCents).toBeLessThanOrEqual(8000);expect(p.completeOrders).toBe(1);});
 it('accepts documented independent stock from an exposed factory',()=>{const s=snapshot();s.offers.find(x=>x.id==='offer_b')!.independentStock=100;expect(candidates(s).find(x=>x.offerId==='offer_b')?.eligible).toBe(true);});
 it('rejects missing upstream evidence, incompatibility and expired quotes',()=>{const s=snapshot();s.offers.find(x=>x.id==='offer_d')!.upstreamKnown=false;expect(candidates(s).filter(x=>x.eligible)).toHaveLength(0);s.offers.find(x=>x.id==='offer_d')!.upstreamKnown=true;s.currentDay=3;expect(candidates(s).filter(x=>x.eligible)).toHaveLength(0);});
 it('independently rejects stale or tampered allocations',()=>{const s=snapshot(),c=candidates(s),p=planRecovery(s,impact,c);expect(validatePlan({...s,version:3},p,c).length).toBeGreaterThan(0);p.allocations[0].stockQuantity=100;expect(validatePlan(s,p,c).length).toBeGreaterThan(0);});
});
