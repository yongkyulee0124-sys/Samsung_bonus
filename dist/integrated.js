// Planning estimates: delivery withholding and later cash settlement are distinct.
// No company-confirmed share quantity or final administrative tax is invented.
import {calculate as legacyCalculate,defaults,validateState,salaryAt,taxAndInsurance,allocate,split3,mul,ratio,sum,years,TYPES,DISCLAIMER} from './engine.js';
import {calculatePolicyDraft,plusYears,normalizeSimpleState} from './policy.js';
const clone=structuredClone;
const zero=()=>Object.fromEntries(TYPES.map(t=>[t,0]));
const row=year=>({year,salary:0,allowance:0,gross:zero(),net:zero(),details:[],reasons:[]});
const taxTotal=t=>sum([t.income,t.local]);
const signedRatio=(amount,n,d)=>amount<0?-ratio(-amount,n,d):ratio(amount,n,d);

export function buildPolicyLedger(s,scenario=s.scenarios[s.activeScenario]){
 const q=clone(s);if(q.opi2Policy.simpleInput)normalizeSimpleState(q);const p=q.opi2Policy,c=q.settings,person=q.people[0];q.startYear=q.dataStartYear;
 const zeroReasons={};
 if(p.rateSource==='legacy')p.rateScope='personal';
 for(let y=q.dataStartYear;y<=q.endYear;y++){
  const performance=scenario.performance[y]??0,threshold=c.thresholds[y]??(y<=2028?200:100);
  const manual=p.simpleInput&&Object.hasOwn(p.manualGrossByYear,y);const reason=manual?(p.manualGrossByYear[y]===0?'사용자 입력 0원':null):scenario.unpaid[y]||scenario.opi2Factor===0?'사용자 미지급 가정':p.rateSource==='legacy'&&performance<threshold?'지급 기준 미달':null;
  zeroReasons[y]=reason;
  if(p.rateSource==='legacy')p.paymentRateByYear[y]=reason?0:ratio(c.opi2Base,mul(1000000,performance),mul(1000000,c.performanceBase),c.coefficients[person.division],scenario.opi2Factor)/c.salaryBase;
 }
 const ledger=calculatePolicyDraft(q,{salaryForYear:y=>salaryAt(person,y,q),multiply:mul,splitAmount:split3,grossForYear:({year,basis,gradeMultiplier,divisionMultiplier,studyMultiplier,rate})=>{
  if(p.simpleInput&&Object.hasOwn(p.manualGrossByYear,year))return p.manualGrossByYear[year];
  if(zeroReasons[year])return 0;
  if(p.rateSource==='legacy')return ratio(c.opi2Base,BigInt(mul(1000000,scenario.performance[year]??0))*BigInt(basis),BigInt(mul(1000000,c.performanceBase))*BigInt(c.salaryBase),c.coefficients[person.division],gradeMultiplier,studyMultiplier,scenario.opi2Factor);
  return mul(basis,rate,gradeMultiplier,divisionMultiplier,studyMultiplier,scenario.opi2Factor);
 }});
 for(const r of ledger.rows){r.inputMethod=p.simpleInput&&Object.hasOwn(p.manualGrossByYear,r.originYear)?'manual_final_gross':'automatic_forecast';r.rateSource=p.rateSource;r.zeroReason=zeroReasons[r.originYear];r.expectedRateIsEstimate=p.rateSource==='legacy';r.prices.salePriceAssumption='지급일 종가 유지 매각 가정';}
 return ledger;
}

export function awardIdentity({gross,donation,withheldTax,withheldInsurance,stockBudget,stockValue,finalTax,finalInsurance}){
 const settlementTax=withheldTax-finalTax,settlementInsurance=withheldInsurance-finalInsurance;
 const marketAdjustment=stockValue===null?null:stockValue-stockBudget;
 const finalEconomicValue=stockValue===null?null:sum([stockValue,settlementTax,settlementInsurance]);
 return {costIdentity:{gross,donation,withheldTax,withheldInsurance,stockBudget,difference:sum([stockBudget,donation,withheldTax,withheldInsurance])-gross},marketAdjustment,settlementTax,settlementInsurance,finalEconomicValue,valuationIdentityDifference:stockValue===null?null:finalEconomicValue-sum([gross,-donation,-finalTax,-finalInsurance,marketAdjustment])};
}

export function calculateIntegrated(s,scenario=s.scenarios[s.activeScenario]){
 if(s.opi2Policy.simpleInput)s=normalizeSimpleState(clone(s));validateState(s);const c=s.settings,p=s.people[0],policy=s.opi2Policy;
 const old=legacyCalculate(s,scenario).people[0],ledger=buildPolicyLedger(s,scenario),accrual=[];
 for(let y=s.dataStartYear;y<=s.endYear;y++){const a=row(y);a.salary=salaryAt(p,y,s);a.allowance=p.allowance;a.gross.salary=sum([a.salary,a.allowance]);accrual.push(a);}
 const events=old.events.filter(e=>e.type!=='opi2').map(e=>({id:e.id,personId:e.personId,type:e.type,origin:e.origin,payYear:e.payYear,gross:e.gross,taxableIncome:e.gross,liquidYears:e.liquidYears}));
 const pendingOrigins=[],calculationWarnings=[];
 for(const r of ledger.rows){const a=accrual.find(a=>a.year===r.originYear),candidate=r.selectedWithholdingScenario;
  if(r.preliminaryGross===null||!candidate){pendingOrigins.push({origin:r.originYear,reasons:r.reasons});a.opi2Pending=true;a.reasons.push('OPI2 미확정 입력/미래조건 · 부분합계에서 제외 (0원 확정 아님)');continue;}
  const paymentDate=r.payment.actualDate??r.payment.assumedDate;
  const payYear=paymentDate?Number(paymentDate.slice(0,4)):r.payment.expectedYear;
  if(payYear===null){pendingOrigins.push({origin:r.originYear,reasons:['지급연도 미입력']});a.opi2Pending=true;continue;}
  const stockBudget=candidate.stockBudget,price=r.prices.mean,close=r.prices.closingPrice;
  const stockValue=stockBudget<0?null:ratio(stockBudget,BigInt(close)*3n,price.numerator);
  if(stockBudget<0){calculationWarnings.push({origin:r.originYear,message:'공제 재원 부족 · 추가납부 필요 · 해당 주식가치와 전체 합계 미완료',fundingShortfall:-stockBudget});a.opi2Incomplete=true;}
  const e={id:`${p.id}:${r.originYear}:opi2`,personId:p.id,type:'opi2',origin:r.originYear,payYear,gross:r.preliminaryGross,taxableIncome:candidate.reportedEmploymentIncomeExample,liquidYears:[payYear,payYear+1,payYear+2],reason:r.zeroReason,paymentDate,assumedDelivery:!r.payment.exactDateConfirmed,snapshot:{assumptionOnly:true,reportedSharesDefinitionConfirmed:false,gross:r.preliminaryGross,benchmarkStockBudget:stockBudget,reportedFractionalShares:candidate.reportedFractionalShares,estimatedNetFractionalShares:candidate.netFractionalShares,actualDeliveredShares:null,reportedEmploymentIncome:candidate.reportedEmploymentIncomeExample,withheldTax:candidate.tax,withheldInsurance:candidate.insurance,donation:candidate.donation,referencePrice:clone(price),deliveryClose:close,estimatedStockMarketValue:stockValue,fundingShortfall:Math.max(0,-stockBudget),salePriceAssumption:'지급일 종가 유지 매각 가정'},policyRow:r};
  events.push(e);a.reasons.push(r.zeroReason??'미확정 정책 · 선택한 가정에 따른 OPI2 추정');
 }
 const taxYears=[...new Set([...accrual.map(a=>a.year),...events.map(e=>e.payYear)])].sort((a,b)=>a-b),taxLog=[];
 for(const y of taxYears){const baseGross=sum([salaryAt(p,y,s),p.allowance]),baseTax=taxAndInsurance(baseGross,y,c.tax),ev=events.filter(e=>e.payYear===y),bonus=sum(ev.map(e=>e.taxableIncome)),fullTax=taxAndInsurance(sum([baseGross,bonus]),y,c.tax),incrementTax=Math.max(0,taxTotal(fullTax)-taxTotal(baseTax)),incrementInsurance=Math.max(0,fullTax.insurance-baseTax.insurance),weights=ev.map(e=>({id:e.id,weight:e.taxableIncome})),taxAlloc=allocate(incrementTax,weights),insuranceAlloc=allocate(incrementInsurance,weights);
  ev.forEach((e,i)=>{e.finalTaxEstimate=taxAlloc[i];e.finalInsuranceEstimate=insuranceAlloc[i];e.deduction=sum([taxAlloc[i],insuranceAlloc[i]]);if(e.type!=='opi2')e.net=e.gross-e.deduction;});
  const a=accrual.find(a=>a.year===y);if(a){a.net.salary=baseGross-baseTax.total;a.baseTax=baseTax;}
  taxLog.push({person:p.name,year:y,baseGross,bonus,baseTax,fullTax,increment:sum([incrementTax,incrementInsurance]),incrementTax,incrementInsurance,allocation:ev.map(e=>({id:e.id,type:e.type,origin:e.origin,taxableIncome:e.taxableIncome,finalTaxEstimate:e.finalTaxEstimate,finalInsuranceEstimate:e.finalInsuranceEstimate})),futureAssumption:y>s.endYear,method:'동년 모든 신고소득 합산 증분 세금·보험료 각각 소득 비례 최대잔여법. 선징수를 다시 차감하지 않음.'});
 }
 const cashEvents=[],settlements=[];
 for(const e of events){const a=accrual.find(a=>a.year===e.origin);a.gross[e.type]+=e.gross;
  if(e.type==='opi2'){
   const x=e.snapshot,identity=awardIdentity({gross:e.gross,donation:x.donation,withheldTax:x.withheldTax,withheldInsurance:x.withheldInsurance,stockBudget:x.benchmarkStockBudget,stockValue:x.estimatedStockMarketValue,finalTax:e.finalTaxEstimate,finalInsurance:e.finalInsuranceEstimate});
   e.identity=identity;e.marketAdjustment=identity.marketAdjustment;e.net=identity.finalEconomicValue;
   const taxYear=policy.taxSettlementYearByOrigin[e.origin]??e.payYear+policy.taxSettlementDelay,insuranceYear=policy.insuranceSettlementYearByOrigin[e.origin]??e.payYear+policy.insuranceSettlementDelay;
   if(taxYear<e.payYear||insuranceYear<e.payYear)throw Error('정산연도는 과세·지급연도 이후여야 합니다');
   e.settlements=[{id:e.id+':tax',origin:e.origin,payYear:e.payYear,year:taxYear,type:'settlement',kind:'tax',estimatedMonth:2,timingAssumption:'과세 다음 해 2월 계산용 가정 · 삼성 확정 입금일 아님',net:identity.settlementTax,gross:identity.settlementTax,assumptionOnly:true},{id:e.id+':insurance',origin:e.origin,payYear:e.payYear,year:insuranceYear,type:'settlement',kind:'insurance',estimatedMonth:4,timingAssumption:'지급 다음 해 4월 보험 차액 정산 가정 · 회사 실제 일정 미확인',net:identity.settlementInsurance,gross:identity.settlementInsurance,assumptionOnly:true}];
   settlements.push(...e.settlements);
   // An unaffordable cohort remains incomplete: no zero clamp, no imaginary shares.
   if(e.net===null){a.opi2Incomplete=true;e.tranches=[];a.reasons.push(`추가납부 필요 ${x.fundingShortfall.toLocaleString()}원 · 합계 미완료`);continue;}
   cashEvents.push(...e.settlements);a.net.opi2+=e.net;a.opi2StockMarketValue=(a.opi2StockMarketValue??0)+x.estimatedStockMarketValue;a.opi2SettlementEconomic=(a.opi2SettlementEconomic??0)+sum(e.settlements.map(t=>t.net));
   const netParts=split3(x.estimatedStockMarketValue),grossParts=split3(e.gross);
   e.tranches=e.liquidYears.map((year,i)=>({id:e.id+':stock:'+i,year,net:netParts[i],gross:grossParts[i],origin:e.origin,payYear:e.payYear,type:'opi2',availableDate:e.paymentDate?plusYears(e.paymentDate,i):null,assumptionOnly:true}));
  }else{
   a.net[e.type]+=e.net;const netParts=allocate(e.net,e.liquidYears.map((_,i)=>({id:String(i),weight:1}))),grossParts=allocate(e.gross,e.liquidYears.map((_,i)=>({id:String(i),weight:1})));
   e.tranches=e.liquidYears.map((year,i)=>({id:e.id+':'+i,year,net:netParts[i],gross:grossParts[i],origin:e.origin,payYear:e.payYear,type:e.type}));
  }
  cashEvents.push(...e.tranches);a.details.push(e);
 }
 let cumulative=0;const cashflow=years(s).map(y=>{const a=accrual.find(a=>a.year===y),r=row(y);r.net.salary=a.net.salary;r.gross.salary=a.gross.salary;r.details=cashEvents.filter(t=>t.year===y);for(const t of r.details){r.net[t.type]+=t.net;r.gross[t.type]+=t.gross;}r.netTotal=sum(Object.values(r.net));r.grossTotal=sum(Object.values(r.gross));r.cumulative=cumulative=sum([cumulative,r.netTotal]);return r;});
 for(const a of accrual){a.netTotal=sum(Object.values(a.net));a.grossTotal=sum(Object.values(a.gross));a.netStock=sum([a.opi2StockMarketValue??0,a.net.psu]);a.netCash=a.netTotal-a.netStock;a.lockedStock=sum(a.details.filter(e=>['opi2','psu'].includes(e.type)).flatMap(e=>e.tranches.filter(t=>t.year>a.year)).map(t=>t.net));}
 const future=cashEvents.filter(t=>t.year>s.endYear),openingEvents=cashEvents.filter(t=>t.origin<s.startYear&&t.year>=s.startYear);
 const stock=t=>['opi2','psu'].includes(t.type),openingStock=sum(openingEvents.filter(stock).map(t=>t.net)),openingCash=sum(openingEvents.filter(t=>!stock(t)).map(t=>t.net));
 const unpaidStock=sum(future.filter(t=>stock(t)&&t.payYear>s.endYear).map(t=>t.net)),paidLockedStock=sum(future.filter(t=>stock(t)&&t.payYear<=s.endYear).map(t=>t.net)),normalUnpaidCash=sum(future.filter(t=>!stock(t)&&t.type!=='settlement').map(t=>t.net)),settlementAfterPeriod=sum(future.filter(t=>t.type==='settlement').map(t=>t.net));
 const locked={unpaidStock,paidLockedStock,totalStock:sum([unpaidStock,paidLockedStock]),unpaidCash:sum([normalUnpaidCash,settlementAfterPeriod]),normalUnpaidCash,settlementAfterPeriod,settlementReceivable:sum(future.filter(t=>t.type==='settlement'&&t.net>0).map(t=>t.net)),settlementPayable:-sum(future.filter(t=>t.type==='settlement'&&t.net<0).map(t=>t.net)),settlementEvents:future.filter(t=>t.type==='settlement')};
 const selected=accrual.filter(a=>a.year>=s.startYear),opening={stock:openingStock,cash:openingCash,total:sum([openingStock,openingCash])},totals={grossAccrual:sum(selected.map(a=>a.grossTotal)),netAccrual:sum(selected.map(a=>a.netTotal)),netLiquid:cumulative,contract:sum(selected.map(a=>a.salary)),grossLiquid:sum(cashflow.map(a=>a.grossTotal)),marketAdjustment:sum(events.filter(e=>e.type==='opi2'&&e.marketAdjustment!==null).map(e=>e.marketAdjustment)),donation:sum(events.filter(e=>e.type==='opi2').map(e=>e.snapshot.donation)),settlementTotal:sum(settlements.map(t=>t.net)),settlementInPeriod:sum(settlements.filter(t=>t.year>=s.startYear&&t.year<=s.endYear).map(t=>t.net))};
 const accounting={opening:opening.total,netAccrual:totals.netAccrual,netLiquid:totals.netLiquid,closingStock:locked.totalStock,closingCash:locked.unpaidCash,difference:sum([opening.total,totals.netAccrual,-totals.netLiquid,-locked.totalStock,-locked.unpaidCash]),complete:calculationWarnings.length===0};
 if(accounting.complete&&accounting.difference!==0)throw Error('통합 보상 원장 보존 실패 '+accounting.difference);
 const personResult={person:clone(p),accrual:selected,cashflow,events,taxLog,psuShares:old.psuShares,opening,locked,totals};
 ledger.assumedPayoutPreviews=events.filter(e=>e.type==='opi2').map(e=>({originYear:e.origin,snapshot:e.snapshot,identity:e.identity,finalTaxEstimate:e.finalTaxEstimate,finalInsuranceEstimate:e.finalInsuranceEstimate,settlements:e.settlements}));
 ledger.cashSettlementLedger={status:'planning_estimate',events:settlements,doesNotRewriteDeliveredShares:true,taxTiming:'회사 안내를 채택한 소득 귀속 가정 · 다음 해 2월 계산용 가정; 삼성 확정 입금일 아님',insuranceTiming:'다음 해 4월 보험 차액 정산 가정 · 이미 선징수한 보험 전액을 다시 차감하지 않음; 실제 일정 미확인'};
 return {people:[personResult],accrual:selected,cashflow,events,taxLog,locked,opening,totals,policyLedger:ledger,settlementEvents:settlements,pendingOrigins,calculationWarnings,accounting,resultModel:'policy_integrated_estimate',complete:!pendingOrigins.length&&!calculationWarnings.length,confirmed:{deliveredShares:null,annualCompensation:null,annualCashflow:null,finalTax:null},scenario:clone(scenario),period:{start:s.startYear,end:s.endYear},disclaimer:DISCLAIMER+' 공제전 주수·선징수 기준·미래 반복·최종 세금 및 정산은 선택한 추정 가정. 지급일 종가 유지 매각 가정. 실제 보험료 결정/정산 및 원천징수 시차·연말정산 공제는 미반영.'};
}
export const calculatePlan=(s,scenario)=>s.opi2Policy.mode==='review'?calculateIntegrated(s,scenario):legacyCalculate(s,scenario);
export const comparePlan=s=>Object.fromEntries(Object.entries(s.scenarios).map(([k,v])=>[k,calculatePlan(s,v)]));
export function comparePresetsPlan(s){const base=defaults().scenarios.middle,down=defaults().scenarios.downturn,opt=clone(base);opt.name='낙관 사용자 조정 예시 ×1.25';for(const y of years(s))opt.performance[y]=(base.performance[y]??0)*1.25;return {basic:calculatePlan(s,base),conservative:calculatePlan(s,down),optimistic:calculatePlan(s,opt)};}
function exportDetailedIntegrated(s){const r=calculateIntegrated(s);return {schemaVersion:2,input:clone(s),resultModel:r.resultModel,assumptions:{settings:clone(s.settings),policy:clone(s.opi2Policy),period:r.period,confirmedAnnualTotals:null,confirmedLiquidCashflow:null,disclaimer:r.disclaimer},people:r.people,performanceScenario:r.scenario,annualAccrualCompensation:r.accrual,annualLiquidCashflow:r.cashflow,openingCompensationBalance:r.opening,lockedStockAfter2030:{asOf:s.endYear,...r.locked},cashSettlementAfterPeriod:r.locked.settlementEvents,scenarioComparison:Object.fromEntries(Object.entries(comparePlan(s)).map(([k,v])=>[k,{name:v.scenario.name,totals:v.totals,annual:v.cashflow,locked:v.locked,complete:v.complete}])),inputPresetComparison:Object.fromEntries(Object.entries(comparePresetsPlan(s)).map(([k,v])=>[k,{name:v.scenario.name,totals:v.totals,annual:v.cashflow}])),opi2PolicyReview:r.policyLedger,accounting:r.accounting,complete:r.complete,pendingOrigins:r.pendingOrigins,calculationWarnings:r.calculationWarnings,confirmed:r.confirmed,disclaimer:r.disclaimer+' 생활비·부동산 비용 차감 전 · 수수료·매각세금0원 가정.'};}

export function exportIntegrated(s){
 if(!s.opi2Policy.simpleInput)return exportDetailedIntegrated(s);
 const clean=normalizeSimpleState(clone(s)),d=exportDetailedIntegrated(clean),simple={simpleInput:true,manualGrossByYear:clone(clean.opi2Policy.manualGrossByYear),donationRate:clean.opi2Policy.donationRate};
 d.input.opi2Policy=simple;
 d.assumptions.policy={...simple,workBonusByYear:clone(clean.opi2Policy.workBonusByYear),withholdingTaxRate:.495,withholdingInsuranceRate:.04967,withholdingBase:'gross',donationBase:'gross',price:clean.people[0].psuPrice>0?clean.people[0].psuPrice:250000,priceAssumption:'하나의 평가가격 유지',paymentAssumption:'성과 다음 해 4월 1일 예정',stockRelease:'지급해/1년 뒤/2년 뒤 각 1/3',cashSettlement:'과세 다음 해 현금 정산',manualAward:'고과·소속·연수 등이 이미 반영된 최종 세전액; 추가 배수 없음'};
 d.specialCompensation=d.opi2PolicyReview.rows.map(r=>({year:r.originYear,inputMethod:r.inputMethod,gross:r.preliminaryGross,zeroReason:r.zeroReason}));delete d.opi2PolicyReview;
 d.disclaimer='예상치이며 실제 지급액·세금과 다를 수 있음. 연간 소득 합산 누진세 추정, 다음해 지급과 현금 정산, 단일 평가가격 유지 가정. 생활비·부동산 비용은 차감하지 않은 총유입액.';
 return JSON.parse(JSON.stringify(d,(k,v)=>['policyRow','withholdingAlternatives','shareIncomeCandidates'].includes(k)?undefined:v));
}
