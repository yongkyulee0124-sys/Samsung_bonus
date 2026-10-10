// Preserve existing numerical planning inputs. The mode name is not a claim that every year is consensus.
export const PLANNING_PERFORMANCE={2026:370,2027:550,2028:500,2029:518,2030:466};
export const CONSENSUS_REFERENCE={asOf:'2026-09-22',publicationDate:'2026-09-23',scope:'삼성전자 전체 연결 영업이익',source:'https://file.myasset.com/sitemanager/upload/2026/0923/071649/20260923071649410_0_ko.pdf',verified:{2027:566.349},calculationValues:PLANNING_PERFORMANCE,notice:'모드명은 증권가 평균 참고를 뜻합니다. 계산값370/550/500/518/466은 기존 계획값이며 실제 평균이라고 표시하지 않습니다.2027 검증 자료566.349조원과550조원 계획값은 다릅니다.2028 이후 평균 미확인. 자동 최신자료 수집 없음.'};
export const FORECAST_MODES=[['middle','증권가 평균'],['custom','사용자 지정']];
const copy=x=>structuredClone(x);
const saved=s=>Object.fromEntries(Object.entries(s??{}).filter(([k])=>['middle','downturn','custom'].includes(k)).map(([k,v])=>[k,{name:v.name,performance:copy(v.performance??{}),unpaid:copy(v.unpaid??{}),opi2Factor:v.opi2Factor,psuMode:v.psuMode}]));
export function normalizeForecast(s){
 if(s.forecastRevision!==1){const archive=saved(s.scenarios),active=s.scenarios?.[s.activeScenario]??s.scenarios?.custom;s.legacyScenarioInputs=archive;if(active)s.scenarios.custom=copy(active);s.activeScenario='custom';s.forecastRevision=1;s.forecastMigrationNotice='구형 전망의 적용값을 사용자 지정으로 가져왔습니다. 나머지 전망 숫자도 JSON의 legacyScenarioInputs에 보존하며 삭제된 선택지는 표시하지 않습니다.';}
 if(!['middle','custom'].includes(s.activeScenario)){const active=s.scenarios?.[s.activeScenario];if(active)s.scenarios.custom=copy(active);s.activeScenario='custom';}
 const market=s.scenarios.middle;const modified=Object.entries(PLANNING_PERFORMANCE).some(([y,v])=>market.performance?.[y]!==v);
 if(modified){if(s.activeScenario==='middle'){s.scenarios.custom=copy(market);s.activeScenario='custom';}s.legacyScenarioInputs??={};s.legacyScenarioInputs.importedMarket=saved({middle:market}).middle;market.performance=copy(PLANNING_PERFORMANCE);}
 s.scenarios.middle.name='증권가 평균';s.scenarios.custom.name='사용자 지정';
 return s;
}
export function publicForecasts(s){return Object.fromEntries(FORECAST_MODES.map(([key])=>[key,s.scenarios[key]]));}
export function forecastYearNote(year){return ({2026:'370조원 · 기존 사용자 계획값, 증권가 평균 아님',2027:'550조원 · 기존 반올림 계획값. 검증 자료 평균566.349조원(2026-09-22)',2028:'500조원 · 기존 하락 계획값, 시장 평균 미확인',2029:'518조원 · 기존 연장 계획값, 시장 평균 미확인',2030:'466조원 · 기존 연장 계획값, 시장 평균 미확인'})[year]??'자료 없음 · 사용자 지정에서 직접 입력';}
