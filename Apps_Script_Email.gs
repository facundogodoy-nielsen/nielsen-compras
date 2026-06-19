/***********************************************************************
 * NIELSEN — Web App de envío de correos (Gmail) para Formulario SC y
 * Pedidos V3. Reemplaza a EmailJS. Manda desde tu cuenta y copia (CC)
 * siempre a Compras.
 *
 * ──────────────────── CÓMO PUBLICARLO ────────────────────
 * 1. script.google.com → Nuevo proyecto (o tu proyecto existente).
 * 2. Pegá este código en un archivo .gs.
 * 3. (Opcional) Cambiá REMITENTE_CC si querés otra copia.
 * 4. Implementar → Nueva implementación → tipo "Aplicación web".
 *      - Ejecutar como:  Yo (tu cuenta)
 *      - Quién tiene acceso:  Cualquier persona
 * 5. Copiá la URL que termina en /exec.
 * 6. Pegá esa URL en MAIL_WEBAPP_URL dentro de formulario_sc.html y pedidos.html.
 * 7. La primera vez te pedirá autorizar el permiso de Gmail: aceptá.
 *
 * Probar rápido: pegá la URL /exec en el navegador → debe responder "OK".
 ***********************************************************************/

var REMITENTE_CC = 'facundo.godoy@nielsenexpediciones.com.ar';
var NOMBRE_REMITENTE = 'Compras y Abastecimiento — Nielsen';

function doGet(e) {
  return ContentService.createTextOutput('OK — Web App de correos Nielsen activa');
}

/**
 * Ejecutá ESTA función una vez desde el editor (botón "Ejecutar") para
 * conceder el permiso de Gmail de forma limpia. Te manda un mail de prueba
 * a vos mismo. Si llega, ya quedó autorizado y podés deployar la Web App.
 * (Útil si el deploy te da "Error 401: invalid_client".)
 */
function _autorizar() {
  GmailApp.sendEmail(
    REMITENTE_CC,
    'Prueba de autorización — Web App Nielsen',
    'Si recibís este correo, la autorización de Gmail quedó OK. Ya podés implementar la Web App.'
  );
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var dest = (p.email || '').trim();
    var tieneDest = /\S+@\S+\.\S+/.test(dest);

    var asunto, html;
    if (p.tipo === 'PA') {
      asunto = 'Pedido de Abastecimiento ' + (p.num_pa || '') + ' — Nielsen';
      html = _tplPA(p);
    } else {
      asunto = 'Solicitud de Compra ' + (p.num_sc || '') + ' — Nielsen';
      html = _tplSC(p);
    }

    // Destinatario principal: solicitante (si tiene mail válido); si no, va a Compras.
    var to  = tieneDest ? dest : REMITENTE_CC;
    var opts = { name: NOMBRE_REMITENTE, htmlBody: html };
    // CC a Compras salvo que el solicitante YA sea Compras (evita duplicado).
    if (tieneDest && dest.toLowerCase() !== REMITENTE_CC.toLowerCase()) opts.cc = REMITENTE_CC;

    GmailApp.sendEmail(to, asunto, _plain(html), opts);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, to: to, cc: opts.cc || null }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Plantilla SC ──
function _tplSC(p) {
  var items = _itemsHtml(p.items);
  return _wrap(
    'Solicitud de Compra ' + _esc(p.num_sc),
    _row('N° Solicitud', p.num_sc) +
    _row('N° OP', p.num_op) +
    _row('Solicitante', p.solicitante) +
    _row('Área', p.area) +
    _row('Criticidad', p.criticidad) +
    _row('Orden de Servicio', p.os) +
    _row('Destino', p.destino) +
    _row('Fecha', p.fecha) +
    _row('Fecha límite', p.fecha_limite) +
    _row('N° Vale', p.vale_num),
    items, p.obs, p.link_historial
  );
}

// ── Plantilla PA ──
function _tplPA(p) {
  var items = _itemsHtml(p.items);
  return _wrap(
    'Pedido de Abastecimiento ' + _esc(p.num_pa),
    _row('N° Pedido', p.num_pa) +
    _row('Solicitante', p.solicitante) +
    _row('Campamento', p.campamento) +
    _row('Categoría', p.categoria) +
    _row('Fecha', p.fecha) +
    _row('Fecha de entrega', p.fecha_entrega),
    items, p.obs, p.link_historial
  );
}

// ── Helpers de armado ──
function _wrap(titulo, filas, items, obs, link) {
  var OR = '#E8611A', NAVY = '#13161E';
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">' +
    '<div style="background:' + NAVY + ';padding:20px 24px">' +
      '<div style="color:' + OR + ';font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase">NIELSEN — Compras y Abastecimiento</div>' +
      '<div style="color:#fff;font-size:20px;font-weight:800;margin-top:4px">' + _esc(titulo) + '</div>' +
    '</div>' +
    '<div style="padding:22px 24px;color:#1f2937">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#374151">Tu solicitud fue <b>registrada correctamente</b>. Estos son los datos:</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' + filas + '</table>' +
      (items ? '<div style="margin-top:18px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + OR + '">Ítems</div>' +
               '<div style="margin-top:6px;font-size:13px;color:#374151;white-space:pre-line;background:#f9fafb;border:1px solid #eee;border-radius:8px;padding:12px">' + items + '</div>' : '') +
      (obs && obs !== '—' ? '<div style="margin-top:14px;font-size:13px;color:#374151"><b>Observaciones:</b> ' + _esc(obs) + '</div>' : '') +
      (link ? '<div style="margin-top:22px"><a href="' + _esc(link) + '" style="display:inline-block;background:' + OR + ';color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:11px 20px;border-radius:8px">Ver en el sistema →</a></div>' : '') +
    '</div>' +
    '<div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #eee;color:#9ca3af;font-size:11px">El área de Compras te notificará ante cualquier novedad. — Nielsen Logística y Expediciones S.A.</div>' +
  '</div>';
}
function _row(label, val) {
  if (val == null || val === '' || val === '—') return '';
  return '<tr><td style="padding:6px 0;color:#6b7280;width:42%;vertical-align:top">' + _esc(label) + '</td>' +
         '<td style="padding:6px 0;color:#111827;font-weight:600">' + _esc(val) + '</td></tr>';
}
function _itemsHtml(items) {
  if (!items) return '';
  if (Array.isArray(items)) {
    return items.map(function(it, i) {
      if (typeof it === 'string') return (i+1) + '. ' + _esc(it);
      var s = (i+1) + '. ' + _esc(it.nombre || '');
      if (it.cant) s += ' — ' + _esc(it.cant) + (it.medida ? ' ' + _esc(it.medida) : '');
      return s;
    }).join('\n');
  }
  return _esc(String(items));
}
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _plain(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
