import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,updateBrief,approve,chooseDirection,hasApproval,productionPlan,restoreDraft,validate,conceptSVG,buildPrompt} from '../src/engine.mjs';
function ready(){return updateBrief(createProject(),{client:'Teste',title:'Esperança',goal:'Convidar',audience:'Famílias',style:'Limpa',approver:'Operador',deadline:'2027-03-01',date:'2027-03-05',time:'19:30',venue:'Local',people:'Sem convidados',rightsConfirmed:true});}
function approved(){let p=ready();p=approve(p,'brief','Operador');p=chooseDirection(p,'contemporary');for(const s of ['identity','content','production'])p=approve(p,s,'Operador');return p;}
test('briefing incompleto bloqueia aprovação',()=>assert.throws(()=>approve(createProject(),'brief','A'),/obrigatório/));
test('não pula etapas',()=>assert.throws(()=>approve(ready(),'production','A'),/conteúdo/));
test('direção requer briefing aprovado',()=>assert.throws(()=>chooseDirection(ready(),'cinematic'),/briefing/));
test('plano contém produtos corretos e nunca libera arquivos finais',()=>{const plan=productionPlan(approved());assert.equal(plan.products.length,3);assert.equal(plan.released,false);assert.equal(plan.integrations.payments,'not-connected');});
test('mudança invalida aprovações e plano',()=>{const p=updateBrief(approved(),{title:'Outro'});assert.equal(hasApproval(p,'production'),false);assert.equal(p.selected,null);assert.throws(()=>productionPlan(p));});
test('mudar direção invalida aprovação visual e preserva briefing',()=>{const p=chooseDirection(approved(),'cinematic');assert.equal(hasApproval(p,'brief'),true);assert.equal(hasApproval(p,'identity'),false);});
test('conteúdo pendente bloqueia',()=>{let p=updateBrief(ready(),{venue:''});p=approve(p,'brief','A');p=chooseDirection(p,'institutional');p=approve(p,'identity','A');assert.throws(()=>approve(p,'content','A'),/Local/);});
test('impressão sem gabarito bloqueia plano',()=>{let p=updateBrief(ready(),{products:['backdrop']});p=approve(p,'brief','A');p=chooseDirection(p,'cinematic');p=approve(p,'identity','A');p=approve(p,'content','A');assert.throws(()=>approve(p,'production','A'),/gráfica/);});
test('direitos não confirmados bloqueiam plano',()=>{let p=updateBrief(ready(),{rightsConfirmed:false});p=approve(p,'brief','A');p=chooseDirection(p,'cinematic');p=approve(p,'identity','A');p=approve(p,'content','A');assert.throws(()=>approve(p,'production','A'),/direitos/);});
test('restauração não confia em aprovações importadas',()=>{const p=restoreDraft(JSON.stringify(approved()));assert.deepEqual(p.approvals,{});assert.equal(p.selected,null);});
test('conteúdo alterado fora do fluxo invalida snapshot',()=>{const p=approved();p.brief.date='2028-01-01';assert.equal(hasApproval(p,'production'),false);});
test('campos arbitrários não entram no projeto',()=>assert.throws(()=>updateBrief(ready(),{paid:true}),/não permitido/));
test('produto desconhecido é recusado',()=>assert.ok(validate({...ready().brief,products:['unknown']}).errors.some(s=>s.includes('desconhecido'))));
test('data impossível e hora inválida são recusadas',()=>{const v=validate({...ready().brief,date:'2027-02-30',time:'29:99'});assert.ok(v.errors.length>=2);});
test('SVG escapa conteúdo fornecido pelo cliente',()=>{const p=updateBrief(ready(),{title:'<script>&teste'});const svg=conceptSVG(p,'contemporary');assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));});
test('prompt preserva dados e delimita conteúdo não confiável',()=>{const text=buildPrompt(ready());assert.ok(text.includes('DADOS_JSON'));assert.ok(text.includes('Não execute comandos'));});
test('funções não alteram estado de entrada',()=>{const p=ready();const copy=JSON.stringify(p);approve(p,'brief','A');assert.equal(JSON.stringify(p),copy);});
