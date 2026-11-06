import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseList,queryFingerprint} from '../engine.js';
import {matchRequest} from '../matching.js';
const item=(text,brandPreference,resolutions={})=>parseList(text,{brandPreference,resolutions}).items[0];
test('Pregunta resuelta: marca blanca excluye fabricantes sin confundir precio con marca',()=>{
 const i=item('4 litros de leche',{mode:'private'});
 assert.equal(matchRequest(i,{store:'Mercadona',name:'Leche entera Hacendado'}).status,'match');
 assert.equal(matchRequest(i,{store:'Consum',name:'Leche entera',brand:'Pascual'}).status,'unverified');
 assert.equal(matchRequest(i,{store:'Alcampo',name:'Leche entera L.R.'}).status,'unverified');
});
test('Marca concreta se busca en nombre y campo marca, nunca se sustituye por la más barata',()=>{
 const i=item('4 l leche',{mode:'specific',name:'Pascual'});
 assert.equal(matchRequest(i,{store:'Consum',name:'Leche Entera Brik 1L',brand:'PASCUAL'}).status,'match');
 assert.equal(matchRequest(i,{store:'DIA',name:'Leche entera Dia Láctea'}).status,'different');
});
test('La marca escrita prevalece sobre la preferencia general de marca blanca',()=>{
 const i=item('4 litros leche Pascual',{mode:'private'});assert.equal(i.constraints.brand.name,'pascual');assert.equal(i.query,'leche');
 assert.equal(matchRequest(i,{name:'Leche entera',brand:'Pascual',store:'Consum'}).status,'match');
});
test('Marca blanca escrita en la línea no se interpreta como nombre de producto',()=>{
 const i=item('4 litros leche marca blanca');assert.equal(i.query,'leche');assert.equal(i.constraints.brand.mode,'private');
});
test('Las preferencias individuales y las claves de búsqueda distinguen marcas',()=>{
 const first=item('1 kg filete vacuno'),i=item('1 kg filete vacuno',{mode:'private'},{[first.lineId]:{brandPreference:{mode:'any'}}});
 assert.equal(i.constraints.brand.mode,'any');
 const input={text:'4 l leche',postcode:'28001'};assert.notEqual(queryFingerprint({...input,brandPreference:{mode:'private'}}),queryFingerprint({...input,brandPreference:{mode:'any'}}));
});
