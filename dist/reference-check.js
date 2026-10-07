import {defaults,ratio,mul} from './engine.js';
import {calculateIntegrated} from './integrated.js';
// User-relayed approximate examples, not authenticated company formulas.
export function unionExampleCheck(){const salary=82000000,performance=370,targets={'메모리':750000000,'공통':530000000,'파운드리·시스템LSI':240000000};const rows=[];
 for(const division of Object.keys(targets)){const s=defaults();s.endYear=2026;s.people[0].salary=salary;s.people[0].division=division;s.opi2Policy.workBonusByYear[2026]=0;s.scenarios.middle.performance[2026]=performance;const r=calculateIntegrated(s),e=r.events.find(e=>e.type==='opi2'),target=targets[division],coefficient=s.settings.coefficients[division],requiredBasis=ratio(target,BigInt(s.settings.salaryBase)*BigInt(mul(1000000,s.settings.performanceBase))*1000000n,BigInt(s.settings.opi2Base)*BigInt(mul(1000000,performance))*BigInt(mul(1000000,coefficient)));
  rows.push({division,contractSalary:salary,workBonusInput:0,performance,coefficient,estimatedGross:e.gross,relayedApproximateTarget:target,difference:e.gross-target,requiredBasisIfTargetIsPretax:requiredBasis,requiredWorkBonusIfTargetIsPretax:requiredBasis-salary});
 }
 return {status:'assumption_comparison_not_official_validation',basis:'총 영업이익370조원 · 계약연봉8,200만원 · 업무성과급0원 · CL3/고과1 · 세전 OPI2 예시로 해석',rows,memoryTargetImpliedCommon:525000000,memoryTargetImpliedFoundry:225000000,foundryToMemoryTargetRatio:.32,unknowns:['노조 안내 원문·정확한 계약연봉·업무성과급','전달 금액이 세전인지 세후인지','사업부별 최종 지급률·반올림'],disclaimer:'사용자 전달 대략 예시입니다. 계수나 기준값을 이 금액에 맞추지 않았습니다.'};
}
