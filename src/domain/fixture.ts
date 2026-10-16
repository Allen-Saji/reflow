import { validateFixture, type Fixture } from './model.js';
const stamp='2026-10-16T08:00:00Z';
const source=(id:string,title:string,detail:string,kind='record')=>({id,title,detail,kind,updatedAt:stamp});
export function sampleFixture(quantity=80): Fixture {return validateFixture({
 name:'Northline Lighting',currentDay:0,baselineCostCents:1000,premiumCapCents:20000,assemblyCapacity:100,
 sources:[
 source('src_bom','Approved manufacturing specification','Desk and task lamps each require one 24V driver in the driver assembly. DRV24 is approved; DRV12 is not. Wall lights use a different 12V circuit.','specification'),
 source('src_orders','Customer delivery schedule','O-101: 60 desk lamps due Day 4. O-102: 40 task lamps due Day 6. O-103: 30 wall lights due Day 6. Complete shipments only. Assembly takes one day and delivery one day. Capacity: 100 units/day.','schedule'),
 source('src_inventory','Warehouse stock count','20 unallocated DRV24 drivers on hand. Expected purchases are not received inventory.','inventory'),
 source('src_a','Atlas supply agreement','80 approved drivers normally arrive Day 2 at $10/unit, produced at Factory Z. No independent finished inventory.','offer'),
 source('src_b','Beacon quote and sourcing declaration','100 approved drivers at $9/unit, arrival Day 2. Quote depends on production at Factory Z. Zero independent finished inventory.','offer'),
 source('src_c','Cobalt component quote','100 DRV12 components at $8/unit arriving Day 1. 12V component, not approved for desk/task lamp assembly.','offer'),
 source('src_d','Delta quote and manufacturing declaration',`${quantity} DRV24 approved drivers at $12/unit, arrival Day 2, produced at Factory Q. Documented upstream source; quote valid through Day 2.`,'offer'),
 source('src_notice','Factory Z disruption notice','Factory Z cannot produce or dispatch units through Day 8. Existing stock already held independently is unaffected.','notice'),
 ],
 factories:[{id:'factory_z',name:'Factory Z',sourceId:'src_a'},{id:'factory_q',name:'Factory Q',sourceId:'src_d'}],
 suppliers:[{id:'atlas',name:'Atlas Components',sourceId:'src_a'},{id:'beacon',name:'Beacon Supply',sourceId:'src_b'},{id:'cobalt',name:'Cobalt Electronics',sourceId:'src_c'},{id:'delta',name:'Delta Manufacturing',sourceId:'src_d'}],
 parts:[{id:'drv24',name:'DRV24 / 24V driver',voltage:24,sourceId:'src_bom'},{id:'drv12',name:'DRV12 / 12V driver',voltage:12,sourceId:'src_bom'}],
 products:[{id:'desk',name:'Arc desk lamp',partId:'drv24',requiredVoltage:24,approvedPartIds:['drv24'],assemblyDays:1,deliveryDays:1,sourceId:'src_bom'},{id:'task',name:'Beam task lamp',partId:'drv24',requiredVoltage:24,approvedPartIds:['drv24'],assemblyDays:1,deliveryDays:1,sourceId:'src_bom'},{id:'wall',name:'Line wall light',partId:'drv12',requiredVoltage:12,approvedPartIds:['drv12'],assemblyDays:1,deliveryDays:1,sourceId:'src_bom'}],
 orders:[{id:'O-101',customer:'Fieldwork Studio',productId:'desk',quantity:60,dueDay:4,sourceId:'src_orders'},{id:'O-102',customer:'Common Ground',productId:'task',quantity:40,dueDay:6,sourceId:'src_orders'},{id:'O-103',customer:'West Hall',productId:'wall',quantity:30,dueDay:6,sourceId:'src_orders'}],
 offers:[{id:'offer_a',supplierId:'atlas',partId:'drv24',factoryId:'factory_z',upstreamKnown:true,quantity:80,independentStock:0,arrivalDay:2,unitCostCents:1000,validUntilDay:2,sourceId:'src_a'},{id:'offer_b',supplierId:'beacon',partId:'drv24',factoryId:'factory_z',upstreamKnown:true,quantity:100,independentStock:0,arrivalDay:2,unitCostCents:900,validUntilDay:2,sourceId:'src_b'},{id:'offer_c',supplierId:'cobalt',partId:'drv12',factoryId:'factory_q',upstreamKnown:true,quantity:100,independentStock:100,arrivalDay:1,unitCostCents:800,validUntilDay:2,sourceId:'src_c'},{id:'offer_d',supplierId:'delta',partId:'drv24',factoryId:'factory_q',upstreamKnown:true,quantity,independentStock:0,arrivalDay:2,unitCostCents:1200,validUntilDay:2,sourceId:'src_d'}],
 stock:{id:'stock24',partId:'drv24',quantity:20,sourceId:'src_inventory'}
 });}
