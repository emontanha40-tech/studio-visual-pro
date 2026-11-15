import {CATALOG,DIRECTIONS,FIELD_LABELS,createProject,validate,missingContent,updateBrief,approve,chooseDirection,hasApproval,productionPlan,buildPrompt,restoreDraft,conceptSVG} from '/engine.mjs';

import {iniciarAcervo} from '/acervo.mjs';
const $=s=>document.querySelector(s); let project=createProject(); const urls=[];

function message(s){$('#message').textContent=s;}
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function action(fn){try{fn();render();}catch(e){message(e.message);}}
for(const [key,title] of Object.entries(FIELD_LABELS)){
  const label=node('label',title);const input=node(['goal','audience','references','avoid','printSpec','notes'].includes(key)?'textarea':'input');
  input.name=key;input.maxLength=2000;
  if(['date','deadline'].includes(key))input.type='date';if(key==='time')input.type='time';
  label.append(input);$('#fields').append(label);
}
for(const item of CATALOG){const label=node('label');const c=node('input');c.type='checkbox';c.name='products';c.value=item.id;label.append(c,document.createTextNode(' '+item.name));$('#products').append(label);}
function render(){
  for(const k of Object.keys(FIELD_LABELS))$('#brief-form').elements[k].value=project.brief[k];
  document.querySelectorAll('[name=products]').forEach(c=>c.checked=project.brief.products.includes(c.value));
  $('[name=rightsConfirmed]').checked=project.brief.rightsConfirmed;
  $('#revision').textContent='REVISÃO '+project.revision;
  const v=validate(project.brief);$('#validation').replaceChildren();
  for(const [items,cls] of [[v.errors,'errors'],[v.warnings,'warnings'],[missingContent(project.brief),'warnings']]){
    if(items.length){const ul=node('ul',undefined,cls);for(const t of items)ul.append(node('li',t));$('#validation').append(ul);}
  }
  if(!v.errors.length)$('#validation').append(node('p','Briefing básico completo. Revise também as pendências de conteúdo.','ok'));
  for(const u of urls)URL.revokeObjectURL(u);urls.length=0;$('#concepts').replaceChildren();
  for(const d of DIRECTIONS){const card=node('article',undefined,'concept'+(project.selected===d.id?' selected':''));const img=node('img');
    img.src=URL.createObjectURL(new Blob([conceptSVG(project,d.id)],{type:'image/svg+xml'}));urls.push(img.src);img.alt='Estudo estrutural '+d.name;
    const button=node('button',project.selected===d.id?'Direção escolhida':'Escolher direção');button.disabled=!hasApproval(project,'brief');
    button.onclick=()=>action(()=>{ensureApplied();project=chooseDirection(project,d.id);message('Direção selecionada. Confira a identidade antes de aprovar.');});
    card.append(img,node('h3',d.name),node('p',d.description),button);$('#concepts').append(card);
  }
  $('#approvals').replaceChildren();
  for(const [stage,label] of [['brief','Briefing'],['identity','Identidade'],['content','Conteúdo'],['production','Plano de produção']]){
    const card=node('div');card.append(node('strong',label),node('p',hasApproval(project,stage)?'Aprovado nesta revisão':'Aguardando conferência'));
    const btn=node('button','Aprovar '+label.toLowerCase());btn.disabled=hasApproval(project,stage);btn.onclick=()=>action(()=>{ensureApplied();project=approve(project,stage,project.brief.approver);message(label+' aprovado no laboratório local.');});card.append(btn);$('#approvals').append(card);
  }
  $('#history').replaceChildren(...project.history.map(h=>node('li',`R${h.revision} · ${new Date(h.at).toLocaleString('pt-BR')} · ${h.action} · ${h.actor}`)));

}
function formBrief(){const f=new FormData($('#brief-form'));return {...Object.fromEntries(Object.keys(FIELD_LABELS).map(k=>[k,String(f.get(k)||'')])),products:f.getAll('products'),rightsConfirmed:f.has('rightsConfirmed')};}
function ensureApplied(){if(JSON.stringify(formBrief())!==JSON.stringify(project.brief))throw new Error('Existem alterações no formulário. Clique em “Aplicar alterações ao briefing” antes de avançar.');}
$('#brief-form').onsubmit=e=>{e.preventDefault();action(()=>{project=updateBrief(project,formBrief());message('Briefing aplicado. Confira as pendências e aprove a versão atual.');});};
$('#save').onclick=()=>action(()=>{ensureApplied();localStorage.setItem('svp-draft-v1',JSON.stringify({schemaVersion:1,brief:project.brief}));message('Rascunho salvo neste navegador. Ao reabrir, as aprovações precisam ser refeitas.');});
$('#export').onclick=()=>action(()=>{ensureApplied();download('studio-visual-pro-projeto.json',JSON.stringify(project,null,2));message('Projeto exportado. As aprovações locais não têm validade de aceite autenticado.');});
$('#prompt').onclick=()=>action(()=>{ensureApplied();download('studio-visual-pro-briefing-ia.txt',buildPrompt(project),'text/plain');message('Briefing para IA exportado. Nenhum serviço foi chamado.');});
$('#plan').onclick=()=>action(()=>{ensureApplied();download('studio-visual-pro-plano-producao.json',JSON.stringify(productionPlan(project),null,2));message('Especificação exportada. Ainda não é o pacote de artes finais.');});
$('#example').onclick=()=>action(()=>{if(project.brief.title&&!confirm('Substituir o projeto atual pelo exemplo fictício?'))return;project=updateBrief(createProject(),{client:'Igreja Exemplo — dados fictícios',title:'Além do Amanhã',goal:'Convidar a comunidade para uma série de esperança.',audience:'Visitantes e famílias',style:'Contemporânea, sóbria e limpa',colors:'Azul petróleo e areia',avoid:'Excesso de brilho e muitos símbolos',references:'Pergunta em destaque; espaço livre e hierarquia.',date:'2027-04-10',time:'19:30',venue:'Local de demonstração — confirmar endereço real',people:'Sem convidados',approver:'Responsável de demonstração',deadline:'2027-04-01',rightsConfirmed:true});message('Exemplo fictício carregado. Comece pela aprovação do briefing.');});
$('#reset').onclick=()=>action(()=>{if(!confirm('Limpar este projeto e o rascunho salvo neste navegador?'))return;localStorage.removeItem('svp-draft-v1');project=createProject();message('Novo projeto iniciado.');});
try{const saved=localStorage.getItem('svp-draft-v1');if(saved){project=restoreDraft(saved);message('Rascunho recuperado. Reconfirme as aprovações.');}}catch{message('Não foi possível recuperar o rascunho. Um projeto vazio foi iniciado.');}
render();

// Consultar o acervo sem recriar o formulário de briefing.
iniciarAcervo();
