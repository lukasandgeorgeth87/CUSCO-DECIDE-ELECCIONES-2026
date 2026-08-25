const API='https://hknktjopqdqkuqmplnus.supabase.co';
const KEY='sb_publishable_CPV6D8xq9dZNsOTi0ylNiw_E7F5gmy0';
const SURVEY='lares-alcaldia-2026';
const H={'apikey':KEY,'Content-Type':'application/json'};
const $=id=>document.getElementById(id);
let candidates=[],specialOptions=[],pendingVote=null;

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.cdToast);window.cdToast=setTimeout(()=>t.classList.remove('show'),3500)}
function avatar(){return '<svg class="avatar" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="42" r="25" fill="#827970"/><path d="M20 112c4-29 20-45 40-45s36 16 40 45" fill="#827970"/></svg>'}
function token(){let t=localStorage.getItem('cusco_decide_device');if(!t){const a=new Uint8Array(24);crypto.getRandomValues(a);t=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('cusco_decide_device',t)}return t}
function votedKey(){return 'cusco_decide_voted_'+SURVEY}
function hasVoted(){return localStorage.getItem(votedKey())==='1'}
function markVoted(){localStorage.setItem(votedKey(),'1');updateVotingState()}

function updateVotingState(){
  const eligible=$('adult').checked&&$('elector').checked;
  const voted=hasVoted();
  $('adultCheck').classList.toggle('checked',$('adult').checked);
  $('electorCheck').classList.toggle('checked',$('elector').checked);
  $('voteLock').hidden=eligible||voted;
  $('alreadyVoted').hidden=!voted;
  $('candidateGrid').classList.toggle('disabled',!eligible||voted);
  $('specials').classList.toggle('disabled',!eligible||voted);
}

async function api(path,opts={}){const r=await fetch(API+path,{...opts,headers:{...H,...(opts.headers||{})}});const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(data?.message||data?.hint||'Error de conexión');return data}

async function loadChoices(){
  try{
    const surveys=await api('/rest/v1/surveys?slug=eq.'+SURVEY+'&select=id');
    if(!surveys.length)throw new Error('Sondeo no disponible');
    const sid=surveys[0].id;
    [candidates,specialOptions]=await Promise.all([
      api('/rest/v1/candidates?survey_id=eq.'+sid+'&active=eq.true&select=id,full_name,political_org,photo_url,logo_url,jne_status,source_checked_at,base_order&order=base_order.asc'),
      api('/rest/v1/special_options?survey_id=eq.'+sid+'&active=eq.true&select=id,label,code,base_order&order=base_order.asc')
    ]);
    renderChoices();
    renderSourceNote();
  }catch(e){
    $('candidateGrid').innerHTML='<div class="loading">No se pudieron cargar los candidatos.</div>';
    toast(e.message);
  }
}

function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}

function renderSourceNote(){
  const dates=candidates.map(c=>c.source_checked_at).filter(Boolean).map(d=>new Date(d));
  const latest=dates.length?new Date(Math.max(...dates.map(d=>d.getTime()))):null;
  $('sourceNote').textContent='Fuente: JNE – Voto Informado ERM 2026'+(latest?' · verificado '+latest.toLocaleDateString('es-PE'):'')+'. El orden de candidatos cambia aleatoriamente para mantener neutralidad.';
}

function renderChoices(){
  $('candidateGrid').innerHTML='';
  shuffle(candidates).forEach(c=>{
    const card=document.createElement('article');
    card.className='candidate';
    card.innerHTML='<div class="photo">'+(c.photo_url?'<img loading="lazy" alt="Fotografía oficial del candidato">':avatar())+'</div><div class="candidateInfo"><div class="candidateName"></div><div class="partyLine">'+(c.logo_url?'<img class="partyLogo" loading="lazy" alt="Símbolo de organización política">':'')+'<div><div class="party"></div><span class="jneStatus"></span></div></div><button class="btn primary" type="button">VOTAR</button></div>';
    const photo=card.querySelector('.photo img');
    if(photo){photo.src=c.photo_url;photo.alt='Fotografía de '+c.full_name;photo.addEventListener('error',()=>{photo.parentElement.innerHTML=avatar()},{once:true})}
    const logo=card.querySelector('.partyLogo');
    if(logo){logo.src=c.logo_url;logo.alt='Símbolo de '+(c.political_org||'organización política');logo.addEventListener('error',()=>logo.remove(),{once:true})}
    card.querySelector('.candidateName').textContent=c.full_name;
    card.querySelector('.party').textContent=c.political_org||'Organización pendiente';
    card.querySelector('.jneStatus').textContent='JNE: '+(c.jne_status||'estado no disponible');
    card.querySelector('button').addEventListener('click',()=>openVoteDialog('candidate',c.id,c.full_name,c.political_org||''));
    $('candidateGrid').appendChild(card);
  });

  $('specials').innerHTML='';
  specialOptions.forEach(o=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=o.label;
    b.addEventListener('click',()=>openVoteDialog('special',o.id,o.label,'Opción especial del sondeo'));
    $('specials').appendChild(b);
  });
  updateVotingState();
}

function openVoteDialog(type,id,label,party=''){
  if(!($('adult').checked&&$('elector').checked)){
    toast('Marca primero las dos casillas para poder votar.');
    $('adultCheck').scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if(hasVoted()){
    toast('Este dispositivo ya registró una participación en este sondeo.');
    return;
  }
  pendingVote={type,id,label};
  $('dialogChoice').textContent=label;
  $('dialogParty').textContent=party;
  const dialog=$('voteDialog');
  if(typeof dialog.showModal==='function') dialog.showModal();
  else if(confirm('¿Confirmas tu voto por: '+label+'?')) submitVote();
}

async function submitVote(){
  if(!pendingVote)return;
  const {type,id}=pendingVote;
  const confirmBtn=$('confirmVote');
  confirmBtn.disabled=true;
  confirmBtn.textContent='Registrando…';
  try{
    const res=await api('/rest/v1/rpc/cast_vote',{method:'POST',body:JSON.stringify({
      p_survey_slug:SURVEY,
      p_choice_type:type,
      p_choice_id:id,
      p_device_token:token(),
      p_age_group:$('age').value||null,
      p_community_text:$('community').value.trim()||null
    })});
    if(res?.ok===false){
      if(res.duplicate)markVoted();
      toast(res.message||'No se pudo registrar la participación.');
      if($('voteDialog').open)$('voteDialog').close();
      return;
    }
    markVoted();
    if($('voteDialog').open)$('voteDialog').close();
    toast(res.message||'Participación registrada correctamente.');
    await loadResults();
    setTimeout(()=>$('resultados').scrollIntoView({behavior:'smooth',block:'start'}),250);
  }catch(e){
    toast(e.message);
  }finally{
    confirmBtn.disabled=false;
    confirmBtn.textContent='Confirmar voto';
    pendingVote=null;
  }
}

async function loadResults(){
  try{
    const data=await api('/rest/v1/rpc/get_survey_results',{method:'POST',body:JSON.stringify({p_survey_slug:SURVEY})});
    if(!data.ok)throw new Error(data.message||'Resultados no disponibles');
    $('totalVotes').textContent=data.total+' '+(data.total===1?'participante':'participantes')+' · actualización '+new Date(data.updated_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
    $('ranking').innerHTML='';
    (data.candidates||[]).forEach((c,i)=>{
      const pct=data.total?100*c.votes/data.total:0;
      const row=document.createElement('div');
      row.className='rank';
      row.innerHTML='<div class="pos">'+(i+1)+'°</div><div><div class="rankIdentity">'+(c.logo_url?'<img class="rankLogo" loading="lazy" alt="Símbolo de organización política">':'')+'<div class="rankText"><div class="rankName"></div><div class="rankParty"></div></div></div><div class="bar"><span style="width:'+pct.toFixed(1)+'%"></span></div></div><div class="score">'+pct.toFixed(1)+'% <div class="mini">'+c.votes+' votos</div></div>';
      const logo=row.querySelector('.rankLogo');
      if(logo){logo.src=c.logo_url;logo.addEventListener('error',()=>logo.remove(),{once:true})}
      row.querySelector('.rankName').textContent=c.name;
      row.querySelector('.rankParty').textContent=(c.party||'Organización pendiente')+(c.jne_status?' · JNE: '+c.jne_status:'');
      $('ranking').appendChild(row);
    });
    $('specialResults').innerHTML=(data.specials||[]).map(s=>{const p=data.total?(100*s.votes/data.total).toFixed(1):'0.0';return '<strong>'+escapeHtml(s.label)+':</strong> '+s.votes+' ('+p+'%)'}).join(' &nbsp; · &nbsp; ')||'Sin respuestas especiales.';
  }catch(e){
    $('specialResults').textContent='No se pudieron actualizar los resultados.';
  }
}

function escapeHtml(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}

async function sharePage(){
  try{
    if(navigator.share)await navigator.share({title:'Cusco Decide',text:'Participa en el sondeo referencial de Cusco Decide – Lares 2026.',url:location.href});
    else{await navigator.clipboard?.writeText(location.href);toast('Enlace copiado para compartir.');}
  }catch{}
}

$('adult').addEventListener('change',updateVotingState);
$('elector').addEventListener('change',updateVotingState);
$('openPoll').addEventListener('click',()=>$('poll').scrollIntoView({behavior:'smooth'}));
$('share').addEventListener('click',sharePage);
$('shareMobile').addEventListener('click',sharePage);
$('confirmVote').addEventListener('click',submitVote);
$('voteDialog').addEventListener('close',()=>{pendingVote=null});

loadChoices();
loadResults();
updateVotingState();
setInterval(loadResults,15000);