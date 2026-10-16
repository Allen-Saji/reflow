import { randomUUID } from 'node:crypto';
import type { Allocation,Candidate,Impact,Plan,Snapshot } from './model.js';
export function evaluateCandidates(s:Snapshot, impact:Impact, exposures:Record<string,Candidate['exposurePaths']>, approvals:Record<string,string[]>):Candidate[] {
 const products=impact.orderIds.map(id=>s.products.find(p=>p.id===s.orders.find(o=>o.id===id)!.productId)!);
 return s.offers.map(o=>{
  const reasons:string[]=[]; const exposed=!!exposures[o.id]?.length;
  const part=s.parts.find(p=>p.id===o.partId)!;
  const approved=approvals[o.id]||[];
  if(!products.some(p=>approved.includes(p.id)&&part.voltage===p.requiredVoltage)) reasons.push('Component does not meet the required specification or approval.');
  if(!o.upstreamKnown) reasons.push('Upstream source is unverified.');
  if(s.currentDay>o.validUntilDay) reasons.push('Quote has expired.');
  let usable=Math.max(0,o.quantity-(s.offerAllocated[o.id]||0));
  if(exposed && s.disruption && o.arrivalDay<=s.disruption.untilDay) {
   usable=Math.min(usable,Math.max(0,o.independentStock-(s.offerAllocated[o.id]||0)));
   if(!usable) reasons.push('Offer depends on the disrupted factory; no independent finished stock.');
  }
  if(!usable) reasons.push('No unallocated units available.');
  if(products.length && !products.some(p=>Math.max(s.currentDay,o.arrivalDay)+p.assemblyDays+p.deliveryDays<=Math.max(...s.orders.filter(x=>x.productId===p.id&&impact.orderIds.includes(x.id)).map(x=>x.dueDay)))) reasons.push('Arrival misses the affected delivery deadlines.');
  return {offerId:o.id,supplierId:o.supplierId,eligible:reasons.length===0,reasons,usableQuantity:usable,exposed,exposurePaths:exposures[o.id]||[],approvedProductIds:approved,sourceIds:[o.sourceId,...(exposed?[s.disruption!.sourceId]:[]),...products.map(p=>p.sourceId)].filter(x=>s.sources.some(y=>y.id===x))};
 });
}
export function planRecovery(s:Snapshot,impact:Impact,candidates:Candidate[]):Plan {
 const orders=s.orders.filter(o=>impact.orderIds.includes(o.id)).sort((a,b)=>a.dueDay-b.dueDay||a.id.localeCompare(b.id));
 const resources=[{id:'stock',quantity:Math.max(0,s.stock.quantity-s.stockReserved),cost:0,premium:0,arrival:s.currentDay,partId:s.stock.partId,approved:s.products.filter(p=>p.approvedPartIds.includes(s.stock.partId)).map(p=>p.id)},...candidates.filter(c=>c.eligible).map(c=>{const o=s.offers.find(o=>o.id===c.offerId)!;return{id:o.id,quantity:c.usableQuantity,cost:o.unitCostCents,premium:Math.max(0,o.unitCostCents-s.baselineCostCents),arrival:Math.max(s.currentDay,o.arrivalDay),partId:o.partId,approved:c.approvedProductIds};})];
 let evaluated=0,exhausted=true; const limit=80000;
 type State={allocations:Allocation[]; remaining:number[]; purchase:number;premium:number;stock:number; purchased:Record<string,number>};
 let best:State={allocations:[],remaining:resources.map(x=>x.quantity),purchase:0,premium:0,stock:0,purchased:{}};
 const score=(a:State)=>[a.allocations.filter(x=>x.complete).length,...orders.map(o=>a.allocations.find(x=>x.orderId===o.id)?.complete?1:0),a.allocations.reduce((n,x)=>n+x.covered,0),-a.premium,-a.purchase];
 const better=(a:State,b:State)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;};
 function walk(orderIndex:number,state:State){
  if(++evaluated>limit){exhausted=false;return;}
  if(orderIndex===orders.length){if(better(state,best))best=state;return;}
  const order=orders[orderIndex],product=s.products.find(p=>p.id===order.productId)!;
  // Capacity is reserved against every fully planned product on its assembly day.
  const chosen:number[]=resources.map(()=>0);
  function assign(r:number,need:number,remaining:number[],purchase:number,premium:number){
   if(evaluated>=limit){exhausted=false;return;}
   if(r===resources.length){
    const covered=order.quantity-need; const used=resources.map((x,i)=>chosen[i]>0?x.arrival:-1);const arrival=Math.max(s.currentDay,...used);
    const projected=covered?arrival+product.assemblyDays+product.deliveryDays:null;
    const assemblyDay=arrival+product.assemblyDays;
    const prior=state.allocations.filter(x=>x.complete&&x.projectedDay!==null&&x.projectedDay-s.products.find(p=>p.id===s.orders.find(o=>o.id===x.orderId)!.productId)!.deliveryDays===assemblyDay).reduce((n,x)=>n+x.covered,0);
    const complete=need===0&&projected!==null&&projected<=order.dueDay&&prior+covered<=s.assemblyCapacity;
    if(need===0&&!complete)return;
    const offerQuantities:Record<string,number>={};resources.forEach((x,i)=>{if(x.id!=='stock'&&chosen[i])offerQuantities[x.id]=chosen[i];});
    const allocation:Allocation={orderId:order.id,stockQuantity:chosen[0],offerQuantities,covered,shortage:need,projectedDay:complete?projected:null,complete};
    const purchased={...state.purchased};for(const[k,v]of Object.entries(offerQuantities))purchased[k]=(purchased[k]||0)+v;
    walk(orderIndex+1,{allocations:[...state.allocations,allocation],remaining,purchase,premium,stock:state.stock+chosen[0],purchased});return;
   }
   const supply=resources[r];const allowed=supply.approved.includes(product.id)&&s.parts.find(p=>p.id===supply.partId)!.voltage===product.requiredVoltage&&supply.arrival+product.assemblyDays+product.deliveryDays<=order.dueDay;
   let max=allowed?Math.min(remaining[r],need):0;
   if(supply.premium>0)max=Math.min(max,Math.floor((s.premiumCapCents-premium)/supply.premium));
   for(let amount=max;amount>=0;amount--){chosen[r]=amount;const next=[...remaining];next[r]-=amount;assign(r+1,need-amount,next,purchase+amount*supply.cost,premium+amount*supply.premium);if(evaluated>=limit){exhausted=false;break;}}
   chosen[r]=0;
  }
  assign(0,order.quantity,[...state.remaining],state.purchase,state.premium);
 }
 walk(0,{allocations:[],remaining:resources.map(x=>x.quantity),purchase:0,premium:0,stock:0,purchased:{}});
 const allocations=orders.map(o=>best.allocations.find(x=>x.orderId===o.id)||{orderId:o.id,stockQuantity:0,offerQuantities:{},covered:0,shortage:o.quantity,projectedDay:null,complete:false});
 return{id:randomUUID(),version:s.version,status:'proposed',allocations,purchased:best.purchased,stockUsed:best.stock,purchaseCents:best.purchase,premiumCents:best.premium,completeOrders:allocations.filter(x=>x.complete).length,totalAffected:orders.length,remainingShortage:allocations.reduce((n,x)=>n+x.shortage,0),exhausted,evaluated,evidenceIds:[...new Set([...s.sources.map(x=>x.id)])],createdAt:new Date().toISOString()};
}
export function validatePlan(s:Snapshot,p:Plan,candidates:Candidate[]):string[]{
 const errors:string[]=[];const totals:Record<string,number>={};let stock=0,cost=0,premium=0;
 if(p.version!==s.version)errors.push('Source data changed. Recalculate and approve a new plan.');
 for(const a of p.allocations){const order=s.orders.find(x=>x.id===a.orderId);if(!order){errors.push('Unknown order.');continue;}const product=s.products.find(x=>x.id===order.productId)!;
  stock+=a.stockQuantity;let covered=a.stockQuantity;
  if(!Number.isInteger(a.stockQuantity)||a.stockQuantity<0)errors.push('Invalid stock quantity.');
  if(a.stockQuantity&&!product.approvedPartIds.includes(s.stock.partId))errors.push('Stock is not approved.');
  for(const [id,q]of Object.entries(a.offerQuantities)){const o=s.offers.find(x=>x.id===id),c=candidates.find(x=>x.offerId===id);if(!o||!c?.eligible||!c.approvedProductIds.includes(product.id)||!Number.isInteger(q)||q<0){errors.push('Invalid replacement allocation.');continue;}totals[id]=(totals[id]||0)+q;covered+=q;cost+=q*o.unitCostCents;premium+=q*Math.max(0,o.unitCostCents-s.baselineCostCents);if(Math.max(s.currentDay,o.arrivalDay)+product.assemblyDays+product.deliveryDays>order.dueDay)errors.push('Replacement arrives too late.');}
  if(covered!==a.covered||covered>order.quantity||a.shortage!==order.quantity-covered||a.complete!==(covered===order.quantity))errors.push('Incorrect order coverage.');
 }
 if(stock>s.stock.quantity-s.stockReserved||stock!==p.stockUsed)errors.push('Stock over-allocation.');
 for(const[id,q]of Object.entries(totals))if(q>(candidates.find(x=>x.offerId===id)?.usableQuantity||0)||p.purchased[id]!==q)errors.push('Offer over-allocation.');
 if(Object.keys(p.purchased).some(id=>p.purchased[id]!==totals[id]))errors.push('Incorrect purchase quantities.');
 if(cost!==p.purchaseCents||premium!==p.premiumCents||premium>s.premiumCapCents)errors.push('Incorrect cost or budget exceeded.');
 return [...new Set(errors)];
}
