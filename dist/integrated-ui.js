
export function referenceComparison(){return '';}
export function integratedNotice(){return '';}
export function integratedDetails(r,{escape:esc,amount,warning}){
 const es=r.events.filter(e=>e.type==='opi2');
 return '<section class="panel"><details><summary>특별성과급 기부·선징수·현금 정산 내역</summary><p class="disclosure">선징수는 최종 세금이 아닙니다. 연간 소득 합산 후 차이를 다음 과세연도에 현금으로 정산하며 주식수는 바꾸지 않습니다.</p><div class="table-wrap"><table><thead><tr>'+['성과연도','세전 총액','기부','선징수 세금·보험','자사주 지급가치','정산 일정·현금'].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+es.map(e=>'<tr>'+[e.origin,amount(e.gross),amount(e.snapshot.donation),amount(e.snapshot.withheldTax+e.snapshot.withheldInsurance),amount(e.snapshot.estimatedStockMarketValue),e.settlements.map(t=>t.year+'년 '+(t.kind==='tax'?'세금':'보험')+' '+amount(t.net)).join(' / ')].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="disclosure">기간 이후 환급 예정 '+amount(r.locked.settlementReceivable)+' · 추가납부 예정 '+amount(r.locked.settlementPayable)+'. 원 단위 장부 차이 '+r.accounting.difference.toLocaleString()+'원.</p>'+warning()+'</details></section>';
}
