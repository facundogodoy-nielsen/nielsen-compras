// Función serverless (Vercel) — Noticias de comercio internacional, Argentina y Chile.
// Uso: /api/noticias-comex?pais=ar   |   /api/noticias-comex?pais=cl   (&force=1 para saltear la caché)
//
// Junta, desde el servidor (sin restricciones de CORS), los últimos comunicados y noticias de
// los organismos que intervienen en el comercio exterior. Usa búsquedas de Google Noticias
// (RSS) filtradas por organismo y por dominio oficial, que indexan tanto los sitios de gobierno
// (Boletín Oficial, ARCA, Aduana de Chile, SUBREI, etc.) como los medios especializados.
// Cada noticia se marca como "oficial" si viene de un dominio de gobierno, y como "normativa"
// si el título habla de resoluciones, decretos, aranceles, percepciones, etc.
// Caché propia de 15 minutos (la configuración del sitio desactiva la caché de Vercel).

const TTL_MS = 15 * 60 * 1000;
const CACHE = {};

const CONSULTAS = {
  ar: [
    ['Boletín Oficial',       'site:boletinoficial.gob.ar (importación OR exportación OR aduana OR arancel OR "comercio exterior")'],
    ['ARCA · Aduana',         '(ARCA OR "Dirección General de Aduanas") (importación OR exportación OR aduana OR despacho)'],
    ['Gobierno Nacional',     'site:argentina.gob.ar ("comercio exterior" OR importación OR exportación OR aranceles)'],
    ['Industria y Comercio',  '"Secretaría de Industria y Comercio" (importación OR exportación OR arancel)'],
    ['Cancillería · Acuerdos','(Cancillería OR Mercosur) ("acuerdo comercial" OR "comercio internacional" OR "arancel externo común")'],
    ['Despachantes (CDA)',    'site:cda.org.ar'],
    ['Comercio exterior',     '"comercio exterior" Argentina (resolución OR decreto OR régimen OR percepción)'],
  ],
  cl: [
    ['Aduana de Chile',       '(site:aduana.cl OR "Servicio Nacional de Aduanas") (importación OR exportación OR aduana)'],
    ['SUBREI · Acuerdos',     '(SUBREI OR "Subsecretaría de Relaciones Económicas Internacionales") (acuerdo OR tratado OR comercio)'],
    ['ProChile',              '(site:prochile.gob.cl OR ProChile) (exportaciones OR comercio)'],
    ['SII',                   '("Servicio de Impuestos Internos" OR SII) (importación OR IVA OR aduana OR exportación)'],
    ['Diario Oficial',        '"Diario Oficial" Chile (arancel OR aduana OR importación OR exportación OR decreto)'],
    ['Comercio exterior',     '"comercio exterior" Chile (normativa OR resolución OR decreto OR arancel)'],
  ],
};

const OFICIALES = /(gob\.ar|gov\.ar|boletinoficial|afip|arca\.gob|aduana\.cl|subrei|prochile|sii\.cl|diariooficial|gob\.cl|mercosur\.int|cancilleria)/i;
const NORMATIVA = /(resoluci[oó]n|decreto|ley\b|arancel|al[ií]cuota|percepci[oó]n|tasa de estad[ií]stica|derecho[s]? de (importaci[oó]n|exportaci[oó]n)|r[eé]gimen|norma|reglament|IVA|impuesto|retenci[oó]n|certificado|licencia|cupo|nomenclatura|NCM|valoraci[oó]n|tratado|acuerdo)/i;

function limpiar(t) {
  return String(t || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function tag(xml, nombre) {
  const m = xml.match(new RegExp('<' + nombre + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + nombre + '>', 'i'));
  return m ? m[1] : '';
}
function parsearRSS(xml, entidad) {
  const items = [];
  const bloques = String(xml || '').match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const b of bloques) {
    let titulo = limpiar(tag(b, 'title'));
    const link = limpiar(tag(b, 'link'));
    const fecha = new Date(limpiar(tag(b, 'pubDate')));
    const srcM = b.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);
    const fuente = srcM ? limpiar(srcM[2]) : '';
    const fuenteUrl = srcM ? srcM[1] : '';
    // Google Noticias agrega " - Fuente" al final del título
    if (fuente && titulo.endsWith(' - ' + fuente)) titulo = titulo.slice(0, -(fuente.length + 3));
    if (!titulo || !link || isNaN(fecha)) continue;
    items.push({
      titulo, link, fecha: fecha.toISOString(), fuente, fuenteUrl, entidad,
      oficial: OFICIALES.test(fuenteUrl) || OFICIALES.test(link),
      normativa: NORMATIVA.test(titulo),
    });
  }
  return items;
}
function claveTitulo(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 90);
}
async function traer(pais, entidad, q) {
  const reg = pais === 'cl' ? 'gl=CL&ceid=CL:es-419' : 'gl=AR&ceid=AR:es-419';
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:60d') + '&hl=es-419&' + reg;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NielsenCompras/1.0)' } });
    clearTimeout(t);
    if (!r.ok) return { entidad, ok: false, items: [] };
    return { entidad, ok: true, items: parsearRSS(await r.text(), entidad) };
  } catch (e) { return { entidad, ok: false, items: [] }; }
}
async function juntar(pais) {
  const res = await Promise.all((CONSULTAS[pais] || []).map(([e, q]) => traer(pais, e, q)));
  const vistos = new Map();
  for (const r of res) for (const it of r.items) {
    const k = claveTitulo(it.titulo);
    const prev = vistos.get(k);
    if (!prev) vistos.set(k, { ...it, entidades: [it.entidad] });
    else if (!prev.entidades.includes(it.entidad)) prev.entidades.push(it.entidad);
  }
  const items = [...vistos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 120);
  return {
    pais, actualizado: new Date().toISOString(), items,
    fuentes: res.map(r => ({ entidad: r.entidad, ok: r.ok, cantidad: r.items.length })),
  };
}

async function handler(req, res) {
  const pais = String((req.query && req.query.pais) || 'ar').toLowerCase() === 'cl' ? 'cl' : 'ar';
  const force = req.query && (req.query.force === '1' || req.query.force === 'true');
  const c = CACHE[pais];
  if (!force && c && Date.now() - c.t < TTL_MS) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ...c.data, cache: true });
  }
  const data = await juntar(pais);
  if (data.items.length) CACHE[pais] = { t: Date.now(), data };
  else if (c) { res.setHeader('Access-Control-Allow-Origin', '*'); return res.status(200).json({ ...c.data, cache: true, aviso: 'Sin respuesta de las fuentes; se muestra la última lectura' }); }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ ...data, cache: false });
}
export default handler;
export { parsearRSS };
