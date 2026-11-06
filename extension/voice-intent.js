const STORE_NAMES = new Map([
 ['mercadona', 'Mercadona'], ['dia', 'DIA'], ['carrefour', 'Carrefour'],
 ['alcampo', 'Alcampo'], ['lidl', 'Lidl'], ['aldi', 'ALDI'],
 ['eroski', 'Eroski'], ['consum', 'Consum'],
]);

function commandText(text) {
 return String(text ?? '').trim().replace(/^[¿¡]+|[.!?…。！？]+$/gu, '').trim().replace(/\s+/g, ' ');
}

function normalized(text) {
 return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Commands must occupy the whole utterance. Product descriptions remain literal.
export function parseVoiceIntent(text) {
 const original = String(text ?? '');
 const clean = commandText(original);
 const command = normalized(clean);
 const literal = () => ({type:'text', value:original});

 if (/^(?:terminar|listo|comparar|fin de lista)$/.test(command)) return {type:'compare'};
 if (/^(?:detener dictado|parar)$/.test(command)) return {type:'stop'};
 if (/^(?:deshacer|borra el ultimo producto)$/.test(command)) return {type:'undo'};

 if (/^(?:prefiero (?:la )?)?marca (?:blanca|propia|del supermercado)$/.test(command)) {
  return {type:'brand', value:{mode:'private'}};
 }
 if (/^(?:prefiero )?cualquier marca$/.test(command)) return {type:'brand', value:{mode:'any'}};

 const store = command.match(/^(?:preparar|prepara) (?:la )?cesta en ([a-z]+)$/);
 if (store) return STORE_NAMES.has(store[1]) ? {type:'store', value:STORE_NAMES.get(store[1])} : literal();

 const brand = clean.match(/^(?:prefiero\s+(?:la\s+)?)?marca\s+(.+)$/iu);
 if (brand) {
  const name = brand[1].trim();
  const brandWords = normalized(name);
  // A question, another instruction or a product quantity is not a brand choice.
  const uncertain = /^(?:que|cual|cualquiera|blanca|propia|del supermercado|mas|menos|barata|barato|de|del|no|ninguna)\b/.test(brandWords)
   || /\b(?:o|y|pero|porque|si|quiero|necesito|compra|comprar|anade|comparar)\b/.test(brandWords);
  if (name.length <= 80 && /^[\p{L}\p{N}][\p{L}\p{N}\s&.'’®-]*$/u.test(name) && !uncertain) {
   return {type:'brand', value:{mode:'specific', name}};
  }
 }
 return literal();
}
