// Article examples are rounded estimates, not official company payout rates.
export const ARTICLE_MODEL={revision:2,source:'https://www.segye.com/newsView/20261010501154',published:'2026-10-10',referenceSalary:80000000,referenceCorporateProfit:370,memoryTotal:750000000,memoryOPI1:40000000,memoryOPI2:710000000,coefficients:{'메모리':1,'공통':.7,'파운드리·시스템LSI':.3},reportedTotals:{'메모리':750000000,'공통':530000000,'파운드리·시스템LSI':240000000},notice:'보도 총액은 OPI1+OPI2 합계입니다. 기사 연봉은 8,000만원대 초반으로 정확한 값이 없어, 8,000만원·OPI1 50%를 계산용으로 가정합니다. 메모리 예시만 기준으로 삼고 공통70%·파운드리30% 계수는 유지합니다. 다른 사업부 기사 총액의 오차를 정밀 계수로 역산하지 않습니다. 회사 확정 지급률이 아니며 이후 연도 비례 외삽도 사용자 재정계획 가정입니다.'};
export function dsGate(state,scenario,year){
 const threshold=state.settings.thresholds[year]??(year<=2028?200:100),value=scenario.dsPerformance?.[year];
 if(scenario.unpaid[year]||scenario.opi2Factor===0)return {status:'unpaid',reason:'사용자 미지급 가정',threshold,dsProfit:value??null};
 if(value!==undefined&&value!==null&&value!=='')return {status:value<threshold?'below':'met',reason:value<threshold?'지급 기준 미달 · DS 영업이익':'DS 입력 기준 문턱 충족',threshold,dsProfit:value};
 if(scenario.dsEligibilityAssumed?.[year]!==false)return {status:'assumed',reason:'가정: DS 문턱 충족 (DS 실적 미입력)',threshold,dsProfit:null};
 return {status:'pending',reason:'DS 영업이익 미입력 · 지급 판정 대기',threshold,dsProfit:null};
}
export function normalizeArticleModel(s){
 if(s.opi2ModelRevision!==ARTICLE_MODEL.revision){s.legacyOPI2Model??={opi2Base:s.settings.opi2Base,performanceBase:s.settings.performanceBase,salaryBase:s.settings.salaryBase,coefficients:structuredClone(s.settings.coefficients)};s.opi2ModelRevision=ARTICLE_MODEL.revision;s.modelMigrationNotice='연봉·업무성과급·PSU·전망 입력은 유지했습니다. 구형 5.4억원/300조원/8,500만원 기준을 메모리 보도 사례 기반 계획 모델로 보정했습니다. DS 실적은 새 별도 입력이며 기본은 문턱 충족 가정입니다.';}
 for(const sc of Object.values(s.scenarios)){sc.dsPerformance??={};sc.dsEligibilityAssumed??={};for(let y=s.dataStartYear;y<=s.endYear;y++){if(!Object.hasOwn(sc.dsPerformance,y))sc.dsPerformance[y]=null;if(!Object.hasOwn(sc.dsEligibilityAssumed,y))sc.dsEligibilityAssumed[y]=true;}}
 Object.assign(s.settings,{opi2Base:ARTICLE_MODEL.memoryOPI2,performanceBase:ARTICLE_MODEL.referenceCorporateProfit,salaryBase:ARTICLE_MODEL.referenceSalary,coefficients:structuredClone(ARTICLE_MODEL.coefficients)});return s;
}
