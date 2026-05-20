const DATA = window.FIS_DATA;
const shafts = DATA.shafts;
const heads = DATA.heads;
const defaults = DATA.dashboardDefaults;
const intents = ['Same','Less','More'];
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n) ? n : 0; };
const text = v => String(v ?? '').trim();
const norm = v => text(v).toLowerCase();
const uniq = arr => [...new Set(arr.filter(v => text(v) !== '').map(text))].sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));
const truthy = v => ['1','y','yes','true'].includes(norm(v)) || v === true || v === 1;
const tipNum = v => { const n = num(v); return n > 1 ? n/1000 : n; };
const flexNum = v => num(v);
const cleanTip = v => { const n = tipNum(v); return n ? n.toFixed(3).replace(/^0/,'0') : ''; };

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

function selectedShaft(){
  return shafts.find(s => text(s.ClubType)===$('shaftType').value && text(s.OEM)===$('shaftBrand').value && text(s.Series)===$('shaftSeries').value && text(s.Model)===$('shaftModel').value && text(s.WeightClass)===$('shaftWeightClass').value && text(s.Flex)===$('shaftFlex').value && cleanTip(s.TipSize)===$('shaftTip').value) || null;
}
function selectedHead(){
  return heads.find(h => text(h.ClubType)===$('headType').value && text(h.OEM)===$('headBrand').value && text(h.Model)===$('headModel').value && text(h.Variant)===$('headVariant').value && text(h.ReleaseYear)===$('headYear').value) || null;
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
  if(!base) return {rows:[], warning:'Select a current shaft first.'};
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

function fillSelect(id, values, preferred){
  const el=$(id), prior=preferred ?? el.value;
  el.innerHTML='';
  for(const v of values){ const opt=document.createElement('option'); opt.value=v; opt.textContent=v; el.appendChild(opt); }
  if(values.includes(prior)) el.value=prior;
}
let useDefaults = true;
function pref(key){ return useDefaults ? defaults[key] : undefined; }
function cascadeShaft(){
  fillSelect('shaftType', uniq(shafts.map(s=>s.ClubType)), pref('shaftType'));
  let pool=shafts.filter(s=>s.ClubType===$('shaftType').value);
  fillSelect('shaftBrand', uniq(pool.map(s=>s.OEM)), pref('brand'));
  pool=pool.filter(s=>s.OEM===$('shaftBrand').value);
  fillSelect('shaftSeries', uniq(pool.map(s=>s.Series)), pref('series'));
  pool=pool.filter(s=>s.Series===$('shaftSeries').value);
  fillSelect('shaftModel', uniq(pool.map(s=>s.Model)), pref('model'));
  pool=pool.filter(s=>s.Model===$('shaftModel').value);
  fillSelect('shaftWeightClass', uniq(pool.map(s=>s.WeightClass)), pref('weightClass'));
  pool=pool.filter(s=>s.WeightClass===$('shaftWeightClass').value);
  fillSelect('shaftFlex', uniq(pool.map(s=>s.Flex)), pref('flex'));
  pool=pool.filter(s=>s.Flex===$('shaftFlex').value);
  const headHosel = cleanTip(selectedHead()?.HoselSizeDefault);
  fillSelect('shaftTip', uniq(pool.map(s=>cleanTip(s.TipSize))), headHosel || pref('tip'));
  updateCards();
}
function cascadeHead(){
  fillSelect('headType', uniq(heads.map(h=>h.ClubType)), pref('headClubType'));
  let pool=heads.filter(h=>h.ClubType===$('headType').value);
  fillSelect('headBrand', uniq(pool.map(h=>h.OEM)), pref('headBrand'));
  pool=pool.filter(h=>h.OEM===$('headBrand').value);
  fillSelect('headModel', uniq(pool.map(h=>h.Model)), pref('headModel'));
  pool=pool.filter(h=>h.Model===$('headModel').value);
  fillSelect('headVariant', uniq(pool.map(h=>h.Variant)), pref('headVariant'));
  pool=pool.filter(h=>h.Variant===$('headVariant').value);
  fillSelect('headYear', uniq(pool.map(h=>h.ReleaseYear)), pref('headYear'));
  updateCards();
}
function updateCards(){
  const s=selectedShaft();
  $('selectedShaftCard').innerHTML = s ? `<b>${displayName(s)}</b><div class="chiprow"><span class="chip">${s.Material}</span><span class="chip">${num(s.Weight_g)}g</span><span class="chip">${s.Flex}</span><span class="chip">Tip ${cleanTip(s.TipSize)}</span><span class="chip">Tq ${text(s.Torque)||'—'}</span><span class="chip">L${s.LaunchNum||'—'} / S${s.SpinNum||'—'}</span></div><div class="muted">${canonicalId(s)}</div>` : 'No matching shaft.';
  const h=selectedHead();
  $('selectedHeadCard').innerHTML = h ? `<b>${h.OEM} ${h.Model} ${h.Variant} ${h.ReleaseYear}</b><div class="chiprow"><span class="chip">${h.ModelCategory||'Category —'}</span><span class="chip">${h.Construction||'Construction —'}</span><span class="chip">Hosel ${cleanTip(h.HoselSizeDefault)}</span><span class="chip">${h.AdapterFamily||'n/a'}</span></div>` : 'No matching head.';
  if(h && document.activeElement !== $('hoselSize')) $('hoselSize').value=cleanTip(h.HoselSizeDefault);
}
function render(){
  const {rows, warning}=rankResults();
  const tbody=$('resultsTable').querySelector('tbody'); tbody.innerHTML='';
  const intent = {weight:$('weightIntent').value, flex:$('flexIntent').value, torque:$('torqueIntent').value, launch:$('launchIntent').value, spin:$('spinIntent').value};
  $('warnings').innerHTML = warning ? `<div class="warning">${warning}</div>` : '';
  $('resultMeta').textContent = rows.length ? `Showing top ${rows.length} grouped production recommendations from ${shafts.length.toLocaleString()} shaft rows.`;
}
function init(){
  ['weightIntent','flexIntent','torqueIntent','launchIntent','spinIntent'].forEach(id=>fillSelect(id,intents,defaults[id]||'Same'));
  cascadeShaft(); cascadeHead(); useDefaults = false; render();
  ['shaftType','shaftBrand','shaftSeries','shaftModel','shaftWeightClass','shaftFlex','shaftTip'].forEach(id=>$(id).addEventListener('change',()=>{defaults[id.replace('shaft','').toLowerCase()] = $(id).value; cascadeShaft(); render();}));
  ['headType','headBrand','headModel','headVariant','headYear'].forEach(id=>$(id).addEventListener('change',()=>{cascadeHead(); cascadeShaft(); render();}));
  ['weightIntent','flexIntent','torqueIntent','launchIntent','spinIntent','hoselSize','currentOnly','availableBoost'].forEach(id=>$(id).addEventListener('change',render));
  $('runBtn').addEventListener('click',render);
  $('resetBtn').addEventListener('click',()=>location.reload());
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=8.1-layout-v3').catch(()=>{});
}
let deferredPrompt; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); deferredPrompt=e; $('installBtn').classList.remove('hidden');});
$('installBtn').addEventListener('click',async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $('installBtn').classList.add('hidden'); }});
init();
