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
 * 7. La primera vez te pedirá autorizar permisos de Gmail y Drive: aceptá.
 *    (Ahora también guarda presupuestos y fotos muestra en Drive, por eso pide Drive.)
 *    Si ya tenías una versión anterior implementada, volvé a Implementar → Gestionar
 *    implementaciones → Editar → Nueva versión, y re-autorizá cuando lo pida.
 *
 * Probar rápido: pegá la URL /exec en el navegador → debe responder "OK".
 ***********************************************************************/

var REMITENTE_CC = 'facundo.godoy@nielsenexpediciones.com.ar';
var NOMBRE_REMITENTE = 'Compras y Abastecimiento — Nielsen';

// Supabase — para escribir los links de Drive en el registro de la SC (que el CC los muestre)
var SB_URL = 'https://qivvewvgqlsptydftlhx.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdnZld3ZncWxzcHR5ZGZ0bGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzkyMjUsImV4cCI6MjA5MTkxNTIyNX0.4PGflbub6rz5bdpabOFgHVwihBh2UFC5LRqwi93fLIo';

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

    // Guardar presupuestos y fotos muestra en Drive (no bloquear el correo si falla)
    try {
      p._archivos = _guardarArchivos(p);
      if (p.tipo !== 'PA') _patchSCDriveUrls(p.num_sc, p._archivos.fotosFolderUrl, p._archivos.presupFolderUrl);
    } catch (fe) { p._archivos = { presup: [], fotos: [], error: String(fe) }; }

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
    items, p.obs, p.link_historial, _archivosHtml(p._archivos)
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
function _wrap(titulo, filas, items, obs, link, extra) {
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
      (extra || '') +
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

// ─────────────────────────────────────────────────────────────
// GUARDADO EN DRIVE — Presupuestos y Fotos muestra
// Carpetas: "PRESUPUESTOS SC" y "FOTOS MUESTRAS SC" (subcarpeta por N° SC)
// (Requiere permiso de Drive: la primera vez re-autorizá la Web App.)
// ─────────────────────────────────────────────────────────────
function _folderByName(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function _blobFromDataUrl(dataUrl, name) {
  try {
    if (!dataUrl) return null;
    var comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    var meta = dataUrl.substring(0, comma);          // data:<mime>;base64
    var b64  = dataUrl.substring(comma + 1);
    var mime = meta.substring(5, meta.indexOf(';'));
    var bytes = Utilities.base64Decode(b64);
    return Utilities.newBlob(bytes, mime, name || 'archivo');
  } catch (e) { return null; }
}
function _guardarArchivos(p) {
  var out = { presup: [], fotos: [] };
  var root = DriveApp.getRootFolder();
  var scId = String(p.num_sc || 'SIN_SC');
  out.scId = scId;

  if (p.presupuestos && p.presupuestos.length) {
    var fParent = _folderByName(root, 'PRESUPUESTOS SC');
    var fSC = _folderByName(fParent, scId);
    try { fSC.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    out.presupFolderUrl = fSC.getUrl();
    p.presupuestos.forEach(function(f) {
      var blob = _blobFromDataUrl(f.dataUrl, f.name);
      if (!blob) return;
      var file = fSC.createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      out.presup.push({ name: f.name, url: file.getUrl(), item: f.item || '' });
    });
  }
  if (p.fotos && p.fotos.length) {
    var gParent = _folderByName(root, 'FOTOS MUESTRAS SC');
    var gSC = _folderByName(gParent, scId);
    try { gSC.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    out.fotosFolderUrl = gSC.getUrl();
    p.fotos.forEach(function(f) {
      var blob = _blobFromDataUrl(f.dataUrl, f.name);
      if (!blob) return;
      var file = gSC.createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      out.fotos.push({ name: f.name, url: file.getUrl(), item: f.item || '' });
    });
  }
  return out;
}
// Escribe los links de las carpetas de Drive en la SC (Supabase) para que el CC los muestre
function _patchSCDriveUrls(numSC, fotosUrl, presupUrl) {
  if (!numSC) return;
  var body = {};
  if (fotosUrl)  body.drive_fotos_url  = fotosUrl;
  if (presupUrl) body.drive_presup_url = presupUrl;
  if (!Object.keys(body).length) return;
  try {
    UrlFetchApp.fetch(SB_URL + '/rest/v1/solicitudes_compra?num_sc=eq.' + encodeURIComponent(numSC), {
      method: 'patch',
      contentType: 'application/json',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
  } catch (e) {}
}
// Bloque HTML de adjuntos para el correo
function _archivosHtml(a) {
  if (!a) return '';
  var OR = '#E8611A';
  var h = '';
  if (a.presup && a.presup.length) {
    h += '<div style="margin-top:18px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + OR + '">Presupuestos adjuntos (' + a.presup.length + ')</div>' +
         '<div style="margin-top:6px;font-size:13px;color:#374151;line-height:1.9">' +
         a.presup.map(function(f) {
           return '📄 <a href="' + _esc(f.url) + '" style="color:' + OR + '">' + _esc(f.name) + '</a>' + (f.item ? ' — <b>' + _esc(f.item) + '</b>' : '');
         }).join('<br>') + '</div>';
  }
  if (a.fotos && a.fotos.length) {
    h += '<div style="margin-top:16px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + OR + '">Fotos muestra (' + a.fotos.length + ')</div>' +
         '<div style="margin-top:6px;font-size:13px;color:#374151;line-height:1.9">' +
         a.fotos.map(function(f) {
           return '🖼️ <a href="' + _esc(f.url) + '" style="color:' + OR + '">' + _esc(f.name) + '</a>' + (f.item ? ' — <b>' + _esc(f.item) + '</b>' : '');
         }).join('<br>') + '</div>';
  }
  if (h) {
    h = '<div style="margin-top:8px;padding-top:12px;border-top:1px dashed #e5e7eb">' + h +
        '<div style="margin-top:8px;font-size:11px;color:#9ca3af">Archivos guardados en Drive: «PRESUPUESTOS SC» y «FOTOS MUESTRAS SC» (subcarpeta ' + _esc(String(a.scId || '')) + ').</div></div>';
  }
  return h;
}
