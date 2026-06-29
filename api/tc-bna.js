// Función serverless (Vercel) — corre en el servidor, sin restricción de CORS.
// Devuelve la Cotización DIVISAS · VENTA del dólar (Banco Nación) para una fecha.
// Uso: /api/tc-bna?fecha=YYYY-MM-DD
//
// Estrategia:
//   1) Intenta el histórico de BNA (sección Divisas) para esa fecha.
//   2) Si no hay dato, cae al dólar oficial de ArgentinaDatos (fuente BNA) de esa fecha.
// Siempre informa la "fuente" para que el tablero sea transparente.

function parseDolarVenta(html) {
  if (!html) return 0;
  // Buscar la fila del dólar y tomar el SEGUNDO número (Venta) que le sigue.
  const idx = html.search(/Dolar\s*U\.?\s*S\.?\s*A/i);
  if (idx < 0) return 0;
  const slice = html.slice(idx, idx + 600);
  // Números tipo 1.477,0000 o 1477,0000
  const nums = slice.match(/\d{1,3}(?:\.\d{3})*,\d+|\d+,\d+/g);
  if (!nums || nums.length < 2) return 0;
  const venta = parseFloat(nums[1].replace(/\./g, '').replace(',', '.'));
  return venta > 0 ? venta : 0;
}

async function tryFetch(url, asText) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NielsenCompras/1.0)' } });
    if (!r.ok) return null;
    return asText ? await r.text() : await r.json();
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  const fecha = String((req.query && req.query.fecha) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    res.status(400).json({ error: 'Parámetro fecha inválido (YYYY-MM-DD)' });
    return;
  }
  const [y, m, d] = fecha.split('-');
  const ddmmyyyy = `${d}-${m}-${y}`;

  // 1) BNA histórico — Divisas primero, luego Billetes (ambos son BNA)
  const bnaUrls = [
    { url: `https://www.bna.com.ar/Cotizador/HistoricoPrincipales?id=divisas&fecha=${ddmmyyyy}&filtroEuro=0&filtroDolar=0`, fuente: 'BNA Divisas' },
    { url: `https://www.bna.com.ar/Cotizador/HistoricoPrincipales?id=billetes&fecha=${ddmmyyyy}&filtroEuro=0&filtroDolar=0`, fuente: 'BNA' }
  ];
  for (const c of bnaUrls) {
    const html = await tryFetch(c.url, true);
    const venta = parseDolarVenta(html);
    if (venta > 0) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      res.status(200).json({ venta, fecha, fuente: c.fuente });
      return;
    }
  }

  // 2) Fallback: dólar oficial (ArgentinaDatos, fuente Banco Nación)
  const j = await tryFetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/${y}/${m}/${d}`, false);
  const ventaOf = j && (j.venta || j.value_sell);
  if (ventaOf && ventaOf > 0) {
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json({ venta: ventaOf, fecha, fuente: 'oficial' });
    return;
  }

  res.status(404).json({ error: 'Sin cotización para la fecha', fecha });
}
