const DATA = window.FIS_DATA;
const shafts = DATA.shafts;
const heads = DATA.heads;
const defaults = DATA.dashboardDefaults;
const intents = ['Same','Less','More'];
const ALL = 'All';
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
const text = v => String(v ?? '').trim();
const norm = v => text(v).toLowerCase();
const uniq = arr => [...new Set(arr.filter(v => text(v) !== '').map(text))].sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));
const truthy = v => ['1','y','yes','true'].includes(norm(v)) || v === true || v === 1;
const tipNum = v => { const n = num(v); return n > 1 ? n/1000 : n; };
const flexNum = v => num(v);
const cleanTip = v => { const n = tipNum(v); return n ? n.toFixed(3).replace(/^0/,'0') : ''; };
const ALL_VALUE = '__ALL__';

const CLUB_TYPE_ORDER = {
  Driver: 1,
  Fairway: 2,
  Hybrid: 3,
  Iron: 4,
  Wedge: 5,
  Wood: 2,
  Woods: 2
};

function parseTorque(v){
  const raw = text(v).replace(/[–—]/g,'-').replace(/\bto\b/ig,'-');
  if(!raw) return '';
  const direct = parseFloat(raw);
  if(Number.isFinite(direct)) return direct;
  const range = raw.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if(range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const key = raw.toLowerCase();
  if(key === 'low') return 2;
  if(key === 'mid' || key === 'medium') return 3.5;
  if(key === 'high') return 5;
  return '';
}

function compatibleClub(inputClub, shaftClub){
  const i = text(inputClub), s = text(shaftClub);
  if((i === 'Driver' || i === 'Fairway') && !(s === 'Wood' || s === 'Woods')) return false;
  if(i === 'Hybrid' && s !== 'Hybrid') return false;
  if(i === 'Iron' && s !== 'Iron') return false;
  if(i === 'Wedge' && !(s === 'Iron' || s === 'Wedge')) return false;
  return true;
}

function cleanTaperVariant(v){
  return text(v)
    .replace(/\bTaper\s*(?:2|3|4|5|6|7|8|9|W|PW|GW|SW|LW)\b/ig,'Taper')
    .replace(/\b(?:2|3|4|5|6|7|8|9|W|PW|GW|SW|LW)\s*$/ig,'')
    .replace(/\s+/g,' ')
    .trim();
}

function isTaperSetRow(s){
  const tip = tipNum(s.TipSize);
  const club = text(s.ClubType);
  const variant = text(s.Variant);
  const display = text(s.DisplayName);
  return Math.abs(tip-0.355) < 0.0005 &&
    (club === 'Iron' || club === 'Wedge') &&
    (
      /\bTaper\s*(?:2|3|4|5|6|7|8|9|W|PW|GW|SW|LW)\b/i.test(`${variant} ${display}`) ||
      /\b(?:2|3|4|5|6|7|8|9|PW|GW|SW|LW)\b/i.test(variant)
    );
}

function displayGroupModel(s){
  return cleanTaperVariant(firstNonBlank(s.Model, s.DisplayName));
}

function displayGroupVariant(s){
  return cleanTaperVariant(firstNonBlank(s.Variant, s.DisplayName));
}

function groupKey(s){
  const tip = tipNum(s.TipSize);
  const club = text(s.ClubType);
  const model = norm(displayGroupModel(s));
  const variant = norm(displayGroupVariant(s));
  const flex = norm(s.Flex);
  const weightClass = norm(s.WeightClass) || String(Math.round(num(s.Weight_g)/10)*10);
  if(isTaperSetRow(s)) {
    return `${norm(s.OEM)}|${norm(s.Series)}|${model}|${weightClass}|${flex}|0355-TAPER-SET`;
  }
  return `${norm(s.OEM)}|${norm(s.Series)}|${model}|${variant}|${tip.toFixed(3)}|${club}|${weightClass}|${flex}`;
}

function retailVerified(s){ return truthy(s.RetailVerified2) || truthy(s.RetailVerified); }
function currentFlag(s){ return truthy(s.CurrentFlag) || norm(s.RecordStatus) === 'active' || norm(s.RecordStatus) === 'current'; }
function retailPrice(s){ return firstNonBlank(s.ManufacturerMSRP, s.Price_PGATSS, s.Price_GolfWorks); }
function firstNonBlank(...vals){ return vals.find(v => text(v) !== '' && text(v) !== '0') ?? ''; }
function displayName(s){
  const base = firstNonBlank(s.DisplayName, [s.Model,s.Variant,s.WeightClass,s.Flex].filter(Boolean).join(' '));
  if(isTaperSetRow(s)) {
    return cleanTaperVariant(base)
      .replace(/\bTaper\s*$/i,'Taper Set')
      .replace(/\s+/g,' ')
      .trim();
  }
  return base;
}
function canonicalId(s){ return firstNonBlank(s.CanonicalShaftID, s.NEWShaftID, s.ShaftID); }

const shaftFields = [
  ['shaftType','ClubType', v => text(v)],
  ['shaftBrand','OEM', v => text(v)],
  ['shaftSeries','Series', v => text(v)],
  ['shaftModel','Model', v => text(v)],
  ['shaftWeightClass','WeightClass', v => text(v)],
  ['shaftFlex','Flex', v => text(v)],
  ['shaftTip','TipSize', v => cleanTip(v)]
];
function isAll(v){ return text(v) === ALL || text(v) === ''; }
function selectedShaftFilters(){
  return Object.fromEntries(shaftFields.map(([id]) => [id, $(id)?.value ?? ALL]));
}
function shaftMatchesFilters(s, filters, excludeId){
  return shaftFields.every(([id, field, getter]) => {
    if(id === excludeId) return true;
    const selected = filters[id];
    return isAll(selected) || getter(s[field]) === selected;
  });
}
function selectedShaftCandidates(){
  const filters = selectedShaftFilters();
  return shafts.filter(s => shaftMatchesFilters(s, filters));
}
function selectedShaft(){
  const filters = selectedShaftFilters();
  if(Object.values(filters).some(isAll)) return null;
  return selectedShaftCandidates()[0] || null;
}
function selectedHead(){
  return heads.find(h =>
    ($('headType').value===ALL_VALUE || text(h.ClubType)===$('headType').value) &&
    ($('headBrand').value===ALL_VALUE || text(h.OEM)===$('headBrand').value) &&
    ($('headModel').value===ALL_VALUE || text(h.Model)===$('headModel').value) &&
    ($('headVariant').value===ALL_VALUE || text(h.Variant)===$('headVariant').value) &&
    ($('headYear').value===ALL_VALUE || text(h.ReleaseYear)===$('headYear').value)
  ) || null;
}

function scoreShaft(s, base, head, intent){
  const inputClub = $('headType').value || $('shaftType').value;
  if(!compatibleClub(inputClub, s.ClubType)) return -999;
  if($('currentOnly').checked && !currentFlag(s)) return -999;
  const d = num(s.Weight_g), baseW = num(base.Weight_g);
  const g = flexNum(s.FlexNum), baseFlex = flexNum(base.FlexNum);
  const h = parseTorque(s.Torque), baseTq = parseTorque(base.Torque);
  const launch = num(s.LaunchNum), baseLaunch = num(base.LaunchNum);
  const spin = num(s.SpinNum), baseSpin = num(base.SpinNum);
  const tip = tipNum(s.TipSize), hosel = tipNum($('hoselSize').value || head?.HoselSizeDefault || base.TipSize);
  const exactTip = hosel && Math.abs(tip-hosel)<0.0005;
  const crossFitIronTip = (inputClub==='Iron' || inputClub==='Wedge') && ((Math.abs(tip-0.355)<0.0005 && Math.abs(hosel-0.370)<0.0005) || (Math.abs(tip-0.370)<0.0005 && Math.abs(hosel-0.355)<0.0005));
  let score = 100;
  // Weight
  if(intent.weight === 'Same') score += -Math.abs(d-baseW)*2.5;
  else if(intent.weight === 'Less') score += d<baseW ? Math.max(0,24-Math.abs((baseW-d)-10)*2) : -Math.abs(d-baseW)*10;
  else score += d>baseW ? Math.max(0,24-Math.abs((d-baseW)-10)*2) : -Math.abs(d-baseW)*10;
  // Flex
  if(intent.flex === 'Same') score += -Math.abs(g-baseFlex)*16;
  else if(intent.flex === 'Less') score += g<baseFlex ? Math.max(0,34-Math.abs((baseFlex-g)-1)*18) : -Math.abs(g-baseFlex)*40;
  else score += g>baseFlex ? Math.max(0,34-Math.abs((g-baseFlex)-1)*18) : -Math.abs(g-baseFlex)*40;
  // Torque
  if(h !== '' && baseTq !== ''){
    if(intent.torque === 'Same') score += -Math.abs(h-baseTq)*8;
    else if(intent.torque === 'Less') score += h<baseTq ? Math.max(0,16-Math.abs((baseTq-h)-0.3)*18) : -Math.abs(h-baseTq)*18;
    else score += h>baseTq ? Math.max(0,16-Math.abs((h-baseTq)-0.3)*18) : -Math.abs(h-baseTq)*18;
  }
  // Launch
  if(intent.launch === 'Same') score += -Math.abs(launch-baseLaunch)*12;
  else if(intent.launch === 'Less') score += launch<baseLaunch ? Math.max(0,18-Math.abs((baseLaunch-launch)-1)*12) : -Math.abs(launch-baseLaunch)*22;
  else score += launch>baseLaunch ? Math.max(0,18-Math.abs((launch-baseLaunch)-1)*12) : -Math.abs(launch-baseLaunch)*22;
  // Spin
  if(intent.spin === 'Same') score += -Math.abs(spin-baseSpin)*10;
  else if(intent.spin === 'Less') score += spin<baseSpin ? Math.max(0,16-Math.abs((baseSpin-spin)-1)*12) : -Math.abs(spin-baseSpin)*18;
  else score += spin>baseSpin ? Math.max(0,16-Math.abs((spin-baseSpin)-1)*12) : -Math.abs(spin-baseSpin)*18;
  // Tip / build practicality
  if(hosel){
    if(exactTip) score += 80;
    else if(crossFitIronTip) score -= 35;
    else score -= 80;
  }
  if(currentFlag(s)) score += 15;
  if($('availableBoost').checked && retailVerified(s)) score += 10;
  if(canonicalId(s) === canonicalId(base) && Object.values(intent).every(v => v==='Same')) score += 65;
  if(inputClub === 'Fairway' && d >= 70) score += 4;
  if(inputClub === 'Driver' && d <= 70) score += 3;
  if(inputClub === 'Wedge' && d >= 105) score += 8;
  if(inputClub === 'Wedge' && (norm(s.Model).includes('wedge') || norm(s.Model).includes('spinner'))) score += 10;
  return Math.round(score*10)/10;
}

function rankResults(){
  const base = selectedShaft();
  const head = selectedHead();
  if(!base){
    const count = selectedShaftCandidates().length;
    return {rows:[], warning: count ? `Select a single current shaft first. Current filters match ${count.toLocaleString()} shaft rows.` : 'Select a current shaft first.'};
  }
  const intent = {weight:$('weightIntent').value, flex:$('flexIntent').value, torque:$('torqueIntent').value, launch:$('launchIntent').value, spin:$('spinIntent').value};
  const scored = shafts.map((s,idx)=>({s, idx, raw:scoreShaft(s,base,head,intent), group:groupKey(s)}));
  const best = new Map();
  for(const r of scored){ if(!best.has(r.group) || r.raw > best.get(r.group)) best.set(r.group, r.raw); }
  const seen = new Set();
  const winners=[];
  for(const r of scored){
    if(r.raw === best.get(r.group) && !seen.has(r.group)){
      let prod = r.raw;
      if(isTaperSetRow(r.s) && $('headType').value === 'Iron') prod += 12;
      winners.push({...r, prod}); seen.add(r.group);
    }
  }
  winners.sort((a,b)=> b.prod-a.prod || a.idx-b.idx);
  return {rows:winners.filter(r=>r.prod>=0).slice(0,20), warning:''};
}

function fitSummary(s, intent){
  const parts=[`Wt ${num(s.Weight_g).toFixed(1)}g`, text(s.Flex)];
  if(intent.weight !== 'Same') parts.push(`Wt ${intent.weight}`);
  if(intent.flex !== 'Same') parts.push(`Flex ${intent.flex}`);
  if(intent.torque !== 'Same') parts.push(`Tq ${intent.torque}`);
  if(intent.launch !== 'Same') parts.push(`Lch ${intent.launch}`);
  if(intent.spin !== 'Same') parts.push(`Spn ${intent.spin}`);
  return parts.join(' / ');
}

function fillSelect(id, values, preferred, includeAll=false){
  const el=$(id), prior=preferred ?? el.value;
  const finalValues = includeAll ? [ALL, ...values.filter(v => v !== ALL)] : values;
  el.innerHTML='';
  for(const v of finalValues){ const opt=document.createElement('option'); opt.value=v; opt.textContent=v; el.appendChild(opt); }
  if(finalValues.includes(prior)) el.value=prior;
  else if(includeAll) el.value=ALL;
  else if(finalValues.length) el.value=finalValues[0];
}
let useDefaults = true;
function pref(key){ return useDefaults ? defaults[key] : undefined; }
function shaftDefault(id){
  const map = {shaftType:'shaftType', shaftBrand:'brand', shaftSeries:'series', shaftModel:'model', shaftWeightClass:'weightClass', shaftFlex:'flex', shaftTip:'tip'};
  return pref(map[id]) ?? ALL;
}
function cascadeShaft(preferredTip){
  const filters = selectedShaftFilters();
  for(const [id, field, getter] of shaftFields){
    let values = uniq(shafts.filter(s => shaftMatchesFilters(s, filters, id)).map(s => getter(s[field])));
    if(id === 'shaftType') {
      values = values.sort((a,b)=>
        (CLUB_TYPE_ORDER[a] ?? 999) -
        (CLUB_TYPE_ORDER[b] ?? 999) || String(a).localeCompare(String(b), undefined, {numeric:true})
      );
    }
    const headHosel = cleanTip(selectedHead()?.HoselSizeDefault);
    const preferred = id === 'shaftTip'
      ? (preferredTip || (headHosel && values.includes(headHosel) ? headHosel : undefined) || shaftDefault(id))
      : shaftDefault(id);
    fillSelect(id, values, preferred, true);
    filters[id] = $(id).value;
  }
  updateCards();
}
function cascadeHead(){
  let pool = [...heads];

  fillSelect('headType',
    uniq(heads.map(h=>h.ClubType)),
    pref('headClubType'),
    true
  );

  if($('headType').value !== ALL_VALUE){
    pool = pool.filter(h=>h.ClubType === $('headType').value);
  }

  fillSelect('headBrand',
    uniq(pool.map(h=>h.OEM)),
    pref('headBrand'),
    true
  );

  if($('headBrand').value !== ALL_VALUE){
    pool = pool.filter(h=>h.OEM === $('headBrand').value);
  }

  fillSelect('headModel',
    uniq(pool.map(h=>h.Model)),
    pref('headModel'),
    true
  );

  if($('headModel').value !== ALL_VALUE){
    pool = pool.filter(h=>h.Model === $('headModel').value);
  }

  fillSelect('headVariant',
    uniq(pool.map(h=>h.Variant)),
    pref('headVariant'),
    true
  );

  if($('headVariant').value !== ALL_VALUE){
    pool = pool.filter(h=>h.Variant === $('headVariant').value);
  }

  fillSelect('headYear',
    uniq(pool.map(h=>h.ReleaseYear)),
    pref('headYear'),
    true
  );

  updateCards();
}
function updateCards(){
  const s=selectedShaft();
  const matches = selectedShaftCandidates().length;
  $('selectedShaftCard').innerHTML = s ? `<b>${displayName(s)}</b><div class="chiprow"><span class="chip">${s.Material}</span><span class="chip">${num(s.Weight_g)}g</span><span class="chip">${s.Flex}</span><span class="chip">Tip ${cleanTip(s.TipSize)}</span><span class="chip">Tq ${text(s.Torque)||'—'}</span><span class="chip">L${s.LaunchNum||'—'} / S${s.SpinNum||'—'}</span></div><div class="muted">${canonicalId(s)}</div>` : (matches ? `Narrow the shaft selectors to one current shaft. Matching rows: ${matches.toLocaleString()}.` : 'No matching shaft.');
  const h=selectedHead();
  $('selectedHeadCard').innerHTML = h ? `<b>${h.OEM} ${h.Model} ${h.Variant} ${h.ReleaseYear}</b><div class="chiprow"><span class="chip">${h.ModelCategory||'Category —'}</span><span class="chip">${h.Construction||'Construction —'}</span><span class="chip">Hosel ${cleanTip(h.HoselSizeDefault)}</span><span class="chip">${h.AdapterFamily||'n/a'}</span></div>` : 'No matching head.';
  if(h && document.activeElement !== $('hoselSize')) $('hoselSize').value=cleanTip(h.HoselSizeDefault);
}
function render(){
  const {rows, warning}=rankResults();
  const tbody=$('resultsTable').querySelector('tbody'); tbody.innerHTML='';
  const intent = {weight:$('weightIntent').value, flex:$('flexIntent').value, torque:$('torqueIntent').value, launch:$('launchIntent').value, spin:$('spinIntent').value};
  $('warnings').innerHTML = warning ? `<div class="warning">${warning}</div>` : '';
  $('resultMeta').textContent = rows.length ? `Showing top ${rows.length} grouped production recommendations from ${shafts.length.toLocaleString()} shaft rows.` : 'No scored recommendations for this scenario.';
  rows.forEach((r,i)=>{
    const s=r.s;
    const tr=document.createElement('tr');
    const source=firstNonBlank(s.PrimaryRetailURL,s.SecondaryRetailURL);
    const price=retailPrice(s);
    tr.innerHTML=`<td class="rank">${i+1}</td><td>${s.OEM}</td><td class="model-cell"><b>${displayName(s)}</b><span>${canonicalId(s)} — ${s.Material}</span></td><td>${num(s.Weight_g)}g<br><span class="muted">${s.WeightClass}</span></td><td>${s.Flex}</td><td>${cleanTip(s.TipSize)}</td><td class="score">${r.prod.toFixed(1)}${price?`<br><span class="muted">$${price}</span>`:''}</td><td class="availability">${text(s.AvailabilityText)||'—'}</td><td class="fit">${fitSummary(s,intent)}<br><span class="muted">Tq ${text(s.Torque)||'—'} / Launch ${s.LaunchNum||'—'} / Spin ${s.SpinNum||'—'}</span></td><td>${source?`<a class="source-link" href="${source}" target="_blank" rel="noopener">Open</a>`:'—'}</td>`;
    tbody.appendChild(tr);
  });
}
function init(){
  ['weightIntent','flexIntent','torqueIntent','launchIntent','spinIntent'].forEach(id=>fillSelect(id,intents,defaults[id]||'Same'));
  cascadeShaft(); cascadeHead(); useDefaults = false; render();
  ['shaftType','shaftBrand','shaftSeries','shaftModel','shaftWeightClass','shaftFlex','shaftTip'].forEach(id=>$(id).addEventListener('change',()=>{
  if(id === 'shaftType' && !isAll($('shaftType').value)){
    $('headType').value = $('shaftType').value;
    cascadeHead();
  }
  cascadeShaft();
  render();
}));
  ['headType','headBrand','headModel','headVariant','headYear'].forEach(id=>$(id).addEventListener('change',()=>{
    cascadeHead();
    const headHosel = cleanTip(selectedHead()?.HoselSizeDefault);
    cascadeShaft(headHosel);
    render();
  }));
  ['weightIntent','flexIntent','torqueIntent','launchIntent','spinIntent','hoselSize','currentOnly','availableBoost'].forEach(id=>$(id).addEventListener('change',render));
  $('runBtn').addEventListener('click',render);
  $('resetBtn').addEventListener('click',()=>location.reload());
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=8.2-all-cascade-tip').catch(()=>{});
}
let deferredPrompt; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; $('installBtn').classList.remove('hidden');});
$('installBtn').addEventListener('click',async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $('installBtn').classList.add('hidden'); }});
init();
