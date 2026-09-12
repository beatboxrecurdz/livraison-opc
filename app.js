import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabase = createClient('https://xytiivsfvmkywfbbznem.supabase.co', 'sb_publishable_pyJ3hWsTIOPGq6GIowEUAA_yBIr9aeu');
const $ = (id) => document.getElementById(id);
const statusLabels = {new:'Nouvelle',assigned:'Assignée',accepted:'Acceptée',picking_up:'Récupération',on_the_way:'En route',delivered:'Livrée',cancelled:'Annulée'};
let session = null, profile = null, authMode = 'login';

function money(value){return new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(Number(value||0));}
function safe(value){const d=document.createElement('div');d.textContent=value??'';return d.innerHTML;}
function feeFor(distance){return Number(distance)<=8?5:Number(distance)<=14?8:15;}
function message(id,text,error=false){const el=$(id);el.textContent=text;el.classList.toggle('error',error);}
function openAuth(){ $('authModal').classList.remove('hidden'); document.body.classList.add('modal-open'); }
function closeAuth(){ $('authModal').classList.add('hidden'); document.body.classList.remove('modal-open'); }

function setAuthMode(mode){
  authMode=mode;
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));
  $('nameField').classList.toggle('hidden',mode!=='signup'); $('phoneField').classList.toggle('hidden',mode!=='signup');
  $('authTitle').textContent=mode==='signup'?'Créer mon compte':'Connexion';
  $('authSubmit').textContent=mode==='signup'?'Créer mon compte':'Se connecter';
  $('authForm').password.autocomplete=mode==='signup'?'new-password':'current-password'; message('authMessage','');
}

async function loadProfile(){
  if(!session){profile=null;return;}
  const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();
  if(error){console.error(error);return;} profile=data;
}

function orderCard(order,driverMode=false){
  const actions=driverMode&&order.status!=='delivered'&&order.status!=='cancelled'?`<div class="status-actions">
    ${order.status==='assigned'?`<button data-status="accepted" data-id="${order.id}">Accepter</button>`:''}
    ${['assigned','accepted'].includes(order.status)?`<button data-status="picking_up" data-id="${order.id}">Je récupère</button>`:''}
    ${['accepted','picking_up'].includes(order.status)?`<button data-status="on_the_way" data-id="${order.id}">En route</button>`:''}
    ${order.status==='on_the_way'?`<button data-status="delivered" data-id="${order.id}">Livrée</button>`:''}</div>`:'';
  return `<article class="order-card"><div class="order-top"><span class="status status-${order.status}">${statusLabels[order.status]||order.status}</span><small>${new Date(order.created_at).toLocaleString('fr-CA')}</small></div><h4>${safe(order.store_name)}</h4><p><b>Commerce :</b> ${safe(order.store_address)}</p><p><b>Livraison :</b> ${safe(order.delivery_address)}</p><p><b>Demande :</b> ${safe(order.requested_items)}</p>${order.notes?`<p><b>Note :</b> ${safe(order.notes)}</p>`:''}<div class="order-price"><span>Livraison ${money(order.delivery_fee)}</span><span>Pourboire ${money(order.tip)}</span></div>${actions}</article>`;
}

async function renderDashboard(){
  if(!session||!profile){$('dashboard').classList.add('hidden');return;}
  $('dashboard').classList.remove('hidden'); $('dashboardEmail').textContent=session.user.email;
  ['clientDashboard','driverDashboard','pendingDriver','adminDashboard'].forEach(id=>$(id).classList.add('hidden'));
  if(profile.role==='admin'){ $('dashboardRole').textContent='Administration'; $('dashboardTitle').textContent='Centre de répartition'; $('adminDashboard').classList.remove('hidden'); await loadAdmin(); }
  else if(profile.role==='driver'&&profile.driver_approved){ $('dashboardRole').textContent='Compte livreur'; $('dashboardTitle').textContent=`Bonjour ${profile.full_name||''}`; $('driverDashboard').classList.remove('hidden'); await loadDriver(); }
  else { $('dashboardRole').textContent='Compte client'; $('dashboardTitle').textContent=`Bonjour ${profile.full_name||''}`; $('clientDashboard').classList.remove('hidden'); $('pendingDriver').classList.remove('hidden'); $('requestDriverButton').disabled=profile.driver_requested; $('requestDriverButton').textContent=profile.driver_requested?'Demande envoyée':'Demander l’accès livreur'; if(profile.driver_requested)$('driverRequestText').textContent='Votre demande est en attente d’approbation.'; await loadClient(); }
  $('dashboard').scrollIntoView({behavior:'smooth',block:'start'});
}

async function loadClient(){
  const {data,error}=await supabase.from('orders').select('*').order('created_at',{ascending:false});
  $('clientOrders').innerHTML=error?'<p class="empty">Impossible de charger les demandes.</p>':data.length?data.map(o=>orderCard(o)).join(''):'<p class="empty">Vous n’avez encore aucune demande.</p>';
}

async function loadDriver(){
  $('availabilityLabel').textContent=profile.is_available?'Disponible':'Indisponible'; $('availabilityToggle').textContent=profile.is_available?'Me rendre indisponible':'Me rendre disponible'; $('availabilityToggle').classList.toggle('online',profile.is_available);
  const {data,error}=await supabase.from('orders').select('*').order('created_at',{ascending:false});
  $('driverOrders').innerHTML=error?'<p class="empty">Impossible de charger les livraisons.</p>':data.length?data.map(o=>orderCard(o,true)).join(''):'<p class="empty">Aucune livraison ne vous est assignée.</p>';
  document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>updateStatus(b.dataset.id,b.dataset.status));
}

async function loadAdmin(){
  const [{data:orders,error:oErr},{data:profiles,error:pErr}]=await Promise.all([supabase.from('orders').select('*').order('created_at',{ascending:false}),supabase.from('profiles').select('*').order('created_at',{ascending:false})]);
  if(oErr||pErr){$('adminOrders').innerHTML='<p class="empty">Impossible de charger les données.</p>';return;}
  const drivers=profiles.filter(p=>p.role==='driver'&&p.driver_approved), available=drivers.filter(p=>p.is_available), requests=profiles.filter(p=>p.driver_requested);
  $('newOrderCount').textContent=orders.filter(o=>o.status==='new').length;
  $('adminOrders').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div class="order-top"><span class="status status-${o.status}">${statusLabels[o.status]}</span><small>${new Date(o.created_at).toLocaleString('fr-CA')}</small></div><h4>${safe(o.store_name)}</h4><p>${safe(o.requested_items)}</p><p><b>Destination :</b> ${safe(o.delivery_address)}</p><div class="assign-row">${o.status==='new'?`<select id="driver-${o.id}"><option value="">Choisir un livreur disponible</option>${available.map(d=>`<option value="${d.id}">${safe(d.full_name||d.email)}</option>`).join('')}</select><button data-assign="${o.id}">Assigner</button>`:`<span>Livreur : ${safe(drivers.find(d=>d.id===o.driver_id)?.full_name||'Non assigné')}</span>`}</div></article>`).join(''):'<p class="empty">Aucune commande.</p>';
  $('driversList').innerHTML=drivers.length?drivers.map(d=>`<article class="driver-card"><span class="presence ${d.is_available?'online':''}"></span><div><strong>${safe(d.full_name||d.email)}</strong><small>${d.is_available?'Disponible':'Indisponible'}</small></div></article>`).join(''):'<p class="empty">Aucun livreur approuvé.</p>';
  $('driverRequests').innerHTML=requests.length?requests.map(d=>`<article class="driver-card"><div><strong>${safe(d.full_name||d.email)}</strong><small>${safe(d.phone)}</small></div><div class="approval-actions"><button data-approve="${d.id}">Approuver</button><button class="reject" data-reject="${d.id}">Refuser</button></div></article>`).join(''):'<p class="empty">Aucune demande en attente.</p>';
  document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assignOrder(b.dataset.assign,$(`driver-${b.dataset.assign}`).value));
  document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>approveDriver(b.dataset.approve,true)); document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>approveDriver(b.dataset.reject,false));
}

async function assignOrder(orderId,driverId){if(!driverId)return alert('Choisissez un livreur disponible.');const {error}=await supabase.rpc('assign_order',{order_to_assign:orderId,selected_driver:driverId});if(error)return alert(error.message);await loadAdmin();}
async function approveDriver(id,approve){const {error}=await supabase.rpc('approve_driver',{target_user:id,approve});if(error)return alert(error.message);await loadAdmin();}
async function updateStatus(id,status){const {error}=await supabase.rpc('update_delivery_status',{order_to_update:id,new_status:status});if(error)return alert(error.message);await loadDriver();}

$('accountButton').onclick=()=>session?renderDashboard():openAuth(); $('closeModal').onclick=closeAuth; $('authModal').onclick=e=>{if(e.target===$('authModal'))closeAuth();}; document.querySelectorAll('[data-auth-tab]').forEach(b=>b.onclick=()=>setAuthMode(b.dataset.authTab));
$('authForm').onsubmit=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget),email=String(f.get('email')).trim(),password=String(f.get('password'));message('authMessage','Un instant…');let result;if(authMode==='signup'){result=await supabase.auth.signUp({email,password,options:{data:{full_name:String(f.get('full_name')||'').trim(),phone:String(f.get('phone')||'').trim()},emailRedirectTo:location.origin}});}else result=await supabase.auth.signInWithPassword({email,password});if(result.error)return message('authMessage',result.error.message,true);if(authMode==='signup'&&!result.data.session){message('authMessage','Vérifiez votre courriel pour confirmer votre compte.');return;}closeAuth();};
$('logoutButton').onclick=async()=>{await supabase.auth.signOut();location.hash='accueil';};
$('distanceSelect').onchange=()=>{$('feePreview').textContent=$('distanceSelect').value?money(feeFor($('distanceSelect').value)):'—';};
$('orderForm').onsubmit=async(e)=>{e.preventDefault();if(!session){openAuth();return;}if(profile?.role==='driver'||profile?.role==='admin')return message('orderMessage','Utilisez un compte client pour commander.',true);const f=new FormData(e.currentTarget),distance=Number(f.get('distance_km')),payload={client_id:session.user.id,store_name:String(f.get('store_name')),store_address:String(f.get('store_address')),delivery_address:String(f.get('delivery_address')),requested_items:String(f.get('requested_items')),notes:String(f.get('notes')||''),distance_km:distance,delivery_fee:feeFor(distance),tip:Number(f.get('tip')||0)};const {error}=await supabase.from('orders').insert(payload);if(error)return message('orderMessage',error.message,true);e.currentTarget.reset();$('feePreview').textContent='—';message('orderMessage','Demande envoyée! Vous pouvez la suivre dans votre compte.');await loadClient();};
$('availabilityToggle').onclick=async()=>{const {error}=await supabase.rpc('set_driver_availability',{available:!profile.is_available});if(error)return alert(error.message);await loadProfile();await loadDriver();};
$('requestDriverButton').onclick=async()=>{const {error}=await supabase.rpc('request_driver_access');if(error)return alert(error.message);await loadProfile();await renderDashboard();};

supabase.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;await loadProfile();$('accountButton').textContent=session?'Mon tableau de bord':'Mon compte';$('loginRequired').classList.toggle('hidden',!!session);if(session)await renderDashboard();else{$('dashboard').classList.add('hidden');}});
const {data:{session:initialSession}}=await supabase.auth.getSession();session=initialSession;await loadProfile();$('accountButton').textContent=session?'Mon tableau de bord':'Mon compte';$('loginRequired').classList.toggle('hidden',!!session);
