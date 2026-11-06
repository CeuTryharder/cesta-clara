import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseList} from '../engine.js';
test('Normaliza gramos, decimales y redondea envases completos',()=>{const r=parseList('750 g de pasta, 1,5 litros de leche');assert.equal(r.items[0].quantity,.75);assert.equal(r.items[0].packs,2);assert.equal(r.items[1].packs,2);});
test('Agrupa duplicados antes de redondear envases',()=>{const r=parseList('250 g de pasta\n250 g de pasta');assert.equal(r.items.length,1);assert.equal(r.items[0].packs,1);});
test('Marca cantidades asumidas y admite docenas',()=>{assert.equal(parseList('leche').items[0].assumed,true);assert.equal(parseList('2 docenas de huevos').items[0].quantity,24);});
test('Rechaza cantidades negativas, unidades incompatibles y cero',()=>{assert.equal(parseList('-2 litros de leche\n0 kg de arroz\n1 litro de huevos').pending.length,3);});
