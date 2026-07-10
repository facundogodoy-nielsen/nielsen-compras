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

// ─────────────────────────────────────────────────────────────
// doGet — enlaces de decisión: Aprobar / Stand by / Rechazar
// URL:  ...exec?t=<token>&a=aprobar|standby|rechazar[&d=dias][&m=motivo]
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  // Reparar adjuntos de una SC: ...exec?a=reindex&sc=<N° SC>
  if (p.a === 'reindex') return _htmlOut(_reindexarSC(p.sc));
  if (!p.t || !p.a) return _htmlOut(_pagina('Web App activa', 'El sistema de Compras de Nielsen está funcionando.', '#13161E'));
  var reg = _sbGetToken(p.t);
  if (!reg) return _htmlOut(_pagina('Enlace no válido', 'Este enlace no corresponde a ninguna solicitud vigente.', '#dc2626'));
  if (reg.decision && reg.decision !== 'PENDIENTE' && reg.decision !== 'STANDBY' && p.a !== 'standby') {
    return _htmlOut(_pagina('Ya registrada', 'Tu decisión sobre la CCP ' + reg.num_comp + ' ya fue registrada: <b>' + reg.decision + '</b>.', '#6b7280'));
  }
  var accion = String(p.a).toLowerCase();
  if (accion === 'aprobar')  return _htmlOut(_accionAprobar(reg));
  if (accion === 'rechazar') return _htmlOut(_accionRechazar(reg, p.m));
  if (accion === 'standby')  return _htmlOut(_accionStandby(reg, p.d));
  return _htmlOut(_pagina('Acción desconocida', 'El enlace no es válido.', '#dc2626'));
}
function _htmlOut(html){ return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }

function _accionAprobar(reg){
  _sbPatchToken(reg.token, { decision:'APROBADO', decidido_en:_hoy(), recordar_el:null });
  var comp = _sbGetComp(reg.comp_id);
  var aprobadas = _sbContarAprobaciones(reg.comp_id);
  var req = (comp && comp.aprob_requeridas) || 1;
  var listos = aprobadas >= req;
  var quienes = _sbNombresAprobadores(reg.comp_id);
  _sbPatchComp(reg.comp_id, listos
    ? { aprob_contadas:aprobadas, estado_autorizacion:'APROBADA', autorizado_por:quienes, autorizado_en:_hoy() }
    : { aprob_contadas:aprobadas, estado_autorizacion:'PENDIENTE' });
  _avisarCompras(reg, listos ? 'APROBADA (queda autorizada la compra)' : 'APROBADA (faltan ' + (req-aprobadas) + ' aprobación/es)', '');
  return _pagina('✓ Aprobación registrada',
    'Gracias, <b>' + _esc(reg.nombre||'') + '</b>. Registramos tu <b>aprobación</b> de la CCP <b>' + _esc(reg.num_comp) + '</b>.<br><br>'
    + (listos ? 'La compra queda <b>autorizada</b> y Compras ya fue notificado.'
              : 'Se requieren <b>' + req + '</b> aprobaciones; llevamos <b>' + aprobadas + '</b>.'), '#16a34a');
}
function _accionRechazar(reg, motivo){
  if (!motivo) {
    var url = ScriptApp.getService().getUrl();
    return _pagina('Rechazar la compra',
      'Indicá brevemente el motivo del rechazo de la CCP <b>' + _esc(reg.num_comp) + '</b>:'
      + '<form method="get" action="' + url + '" style="margin-top:18px">'
      + '<input type="hidden" name="t" value="' + _esc(reg.token) + '"><input type="hidden" name="a" value="rechazar">'
      + '<textarea name="m" required rows="4" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px" placeholder="Motivo del rechazo"></textarea>'
      + '<button type="submit" style="margin-top:12px;background:#dc2626;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer">Confirmar rechazo</button>'
      + '</form>', '#dc2626');
  }
  _sbPatchToken(reg.token, { decision:'RECHAZADO', decidido_en:_hoy(), motivo:String(motivo), recordar_el:null });
  _sbPatchComp(reg.comp_id, { estado_autorizacion:'RECHAZADA', rechazado_por:(reg.nombre||reg.email), rechazo_motivo:String(motivo) });
  _avisarCompras(reg, 'RECHAZADA', String(motivo));
  return _pagina('Rechazo registrado',
    'Registramos el <b>rechazo</b> de la CCP <b>' + _esc(reg.num_comp) + '</b>. Compras fue notificado con el motivo indicado.', '#dc2626');
}
function _accionStandby(reg, dias){
  var url = ScriptApp.getService().getUrl();
  if (!dias) {
    var op = function(d, txt){ return '<a href="' + url + '?t=' + encodeURIComponent(reg.token) + '&a=standby&d=' + d + '" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;margin:5px 6px 0 0">' + txt + '</a>'; };
    return _pagina('Dejar en stand by',
      'La CCP <b>' + _esc(reg.num_comp) + '</b> quedará en espera. ¿Cuándo querés volver a evaluarla?<div style="margin-top:16px">'
      + op(7,'En 7 días') + op(15,'En 15 días') + op(30,'En 30 días') + '</div>'
      + '<p style="font-size:13px;color:#6b7280;margin-top:16px">Ese día vas a recibir nuevamente este correo con el resumen y el memo.</p>', '#f59e0b');
  }
  var n = parseInt(dias, 10); if (isNaN(n) || n < 1) n = 7;
  var f = new Date(); f.setDate(f.getDate() + n);
  var fecha = Utilities.formatDate(f, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  _sbPatchToken(reg.token, { decision:'STANDBY', decidido_en:_hoy(), recordar_el:fecha });
  _sbPatchComp(reg.comp_id, { estado_autorizacion:'STANDBY' });
  _avisarCompras(reg, 'STAND BY (nueva evaluación el ' + fecha + ')', '');
  return _pagina('⏸ En stand by',
    'La CCP <b>' + _esc(reg.num_comp) + '</b> queda en espera. Te vamos a recordar la evaluación el <b>' + fecha + '</b>.', '#f59e0b');
}
function _pagina(titulo, cuerpo, color){
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + _esc(titulo) + '</title></head>'
    + '<body style="margin:0;background:#eceff3;font-family:Arial,Helvetica,sans-serif;padding:40px 16px">'
    + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">'
    + '<div style="background:#13161E;padding:18px 24px"><div style="color:#E8611A;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">Nielsen — Compras y Abastecimiento</div></div>'
    + '<div style="padding:26px 24px"><h1 style="margin:0 0 12px;font-size:20px;color:' + color + '">' + _esc(titulo) + '</h1>'
    + '<div style="font-size:14px;color:#374151;line-height:1.7">' + cuerpo + '</div></div>'
    + '<div style="background:#f9fafb;padding:13px 24px;border-top:1px solid #eee;color:#9ca3af;font-size:11px">Podés cerrar esta ventana. — Nielsen Logística y Expediciones S.A.</div>'
    + '</div></body></html>';
}
function _hoy(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ── Supabase helpers ──
function _sbHeaders(){ return { apikey:SB_KEY, Authorization:'Bearer '+SB_KEY }; }
function _sbGet(path){
  try{
    var r = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + path, { headers:_sbHeaders(), muteHttpExceptions:true });
    if (r.getResponseCode() >= 300) return null;
    return JSON.parse(r.getContentText());
  }catch(e){ return null; }
}
function _sbPost(table, body){
  try{
    UrlFetchApp.fetch(SB_URL + '/rest/v1/' + table, { method:'post', contentType:'application/json',
      headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, Prefer:'return=minimal' },
      payload:JSON.stringify(body), muteHttpExceptions:true });
  }catch(e){}
}
function _sbPatchToken(token, body){
  try{
    UrlFetchApp.fetch(SB_URL + '/rest/v1/ccp_autorizaciones?token=eq.' + encodeURIComponent(token), { method:'patch', contentType:'application/json',
      headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, Prefer:'return=minimal' }, payload:JSON.stringify(body), muteHttpExceptions:true });
  }catch(e){}
}
function _sbPatchComp(compId, body){
  try{
    UrlFetchApp.fetch(SB_URL + '/rest/v1/comparativas?id=eq.' + encodeURIComponent(compId), { method:'patch', contentType:'application/json',
      headers:{ apikey:SB_KEY, Authorization:'Bearer '+SB_KEY, Prefer:'return=minimal' }, payload:JSON.stringify(body), muteHttpExceptions:true });
  }catch(e){}
}
function _sbGetToken(token){ var j=_sbGet('ccp_autorizaciones?token=eq.'+encodeURIComponent(token)+'&select=*'); return (j&&j[0])?j[0]:null; }
function _sbGetComp(compId){ var j=_sbGet('comparativas?id=eq.'+encodeURIComponent(compId)+'&select=*'); return (j&&j[0])?j[0]:null; }
function _sbContarAprobaciones(compId){
  var j=_sbGet('ccp_autorizaciones?comp_id=eq.'+encodeURIComponent(compId)+'&decision=eq.APROBADO&select=token');
  return j ? j.length : 0;
}
function _sbNombresAprobadores(compId){
  var j=_sbGet('ccp_autorizaciones?comp_id=eq.'+encodeURIComponent(compId)+'&decision=eq.APROBADO&select=nombre');
  if(!j || !j.length) return '';
  return j.map(function(x){ return x.nombre; }).join(', ');
}
// Aviso a Compras de cada decisión
function _avisarCompras(reg, decision, motivo){
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">'
    + '<div style="background:#13161E;padding:18px 22px"><div style="color:#E8611A;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Nielsen — Compras</div>'
    + '<div style="color:#fff;font-size:18px;font-weight:800;margin-top:4px">Decisión sobre la CCP ' + _esc(reg.num_comp) + '</div></div>'
    + '<div style="padding:20px 22px;color:#374151;font-size:14px;line-height:1.7">'
    + '<b>' + _esc(reg.nombre || reg.email) + '</b> registró: <b>' + _esc(decision) + '</b>.'
    + (motivo ? '<div style="margin-top:12px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px"><b>Motivo:</b> ' + _esc(motivo) + '</div>' : '')
    + '</div></div>';
  try { GmailApp.sendEmail(REMITENTE_CC, 'CCP ' + reg.num_comp + ' — ' + decision, _plain(html), { name:NOMBRE_REMITENTE, htmlBody:html }); } catch(e){}
}

// ─────────────────────────────────────────────────────────────
// Recordatorios de STAND BY — crear el disparador diario UNA VEZ
// (Editor de Apps Script → Ejecutar → crearTriggerRecordatorios)
// ─────────────────────────────────────────────────────────────
function crearTriggerRecordatorios(){
  var ya = ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'revisarRecordatorios'; });
  if (ya) return 'El disparador diario ya existía.';
  ScriptApp.newTrigger('revisarRecordatorios').timeBased().everyDays(1).atHour(8).create();
  return 'Disparador diario creado (08:00).';
}
function revisarRecordatorios(){
  var hoy = _hoy();
  var pend = _sbGet('ccp_autorizaciones?decision=eq.STANDBY&recordar_el=lte.' + hoy + '&select=*');
  if (!pend || !pend.length) return;
  pend.forEach(function(reg){
    var comp = _sbGetComp(reg.comp_id);
    if (!comp) return;
    if (comp.estado_autorizacion === 'APROBADA' || comp.estado_autorizacion === 'RECHAZADA') { _sbPatchToken(reg.token, { recordar_el:null }); return; }
    var p = {
      num_comp: reg.num_comp, num_sc: comp.num_sc || '', asunto: comp.asunto || '', area: comp.area || '',
      nivel_label: comp.nivel_autorizacion || '', monto: (comp.divisa||'ARS') + ' ' + comp.precio_elegido,
      proveedor: comp.proveedor_elegido || '', ahorro: comp.ahorro || 0, items: [], condicion_pago: '',
      n_presupuestos: '', link_sistema: 'https://nielsen-compras.vercel.app/#comparativas', requeridas: comp.aprob_requeridas || 1
    };
    var html = _tplCCPSolicitud(p, reg.token, true);
    try { GmailApp.sendEmail(reg.email, 'Recordatorio — Autorización pendiente CCP ' + reg.num_comp, _plain(html), { name:NOMBRE_REMITENTE, htmlBody:html }); } catch(e){}
    _sbPatchToken(reg.token, { decision:'PENDIENTE', recordar_el:null });
  });
  _sbPatchCompsStandbyToPendiente(pend);
}
function _sbPatchCompsStandbyToPendiente(pend){
  var vistos = {};
  pend.forEach(function(r){ if (!vistos[r.comp_id]) { vistos[r.comp_id] = 1; _sbPatchComp(r.comp_id, { estado_autorizacion:'PENDIENTE' }); } });
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

    // Autorización de compra (CCP) — solicitud o notificación, con memo en PDF
    if (p.tipo === 'CCP_AUTH') { return _ccpAuth(p); }

    // Aviso de cambio de N° PC (desde el Centro de Control) — sin archivos
    if (p.tipo === 'PC_UPDATE') {
      var asuntoPC = 'N° PC asignado a tu SC ' + (p.num_sc || '') + ' — Nielsen';
      var htmlPC = _tplPCUpdate(p);
      var toPC = tieneDest ? dest : REMITENTE_CC;
      var optsPC = { name: NOMBRE_REMITENTE, htmlBody: htmlPC };
      if (tieneDest && dest.toLowerCase() !== REMITENTE_CC.toLowerCase()) optsPC.cc = REMITENTE_CC;
      GmailApp.sendEmail(toPC, asuntoPC, _plain(htmlPC), optsPC);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, to: toPC }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Guardar presupuestos y fotos muestra en Drive (no bloquear el correo si falla)
    try {
      p._archivos = _guardarArchivos(p);
      if (p.tipo !== 'PA') _patchSCDriveUrls(p.num_sc, p._archivos);
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
function _tplPCUpdate(p) {
  var OR = '#E8611A', NAVY = '#13161E';
  var items = _itemsHtml(p.items);
  var filas =
    _row('N° Solicitud (SC)', p.num_sc) +
    _row('N° PC anterior', p.num_pc_old) +
    _row('N° PC nuevo', p.num_pc_new) +
    _row('Área', p.area) +
    (p.asunto ? _row('Asunto', p.asunto) : '');
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">' +
    '<div style="background:' + NAVY + ';padding:20px 24px">' +
      '<div style="color:' + OR + ';font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase">NIELSEN — Compras y Abastecimiento</div>' +
      '<div style="color:#fff;font-size:20px;font-weight:800;margin-top:4px">Actualización de N° PC</div>' +
    '</div>' +
    '<div style="padding:22px 24px;color:#1f2937">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#374151">Se asignó / actualizó el <b>N° PC</b> de tu Solicitud de Compra. Guardá este número para hacer el seguimiento.</p>' +
      '<div style="text-align:center;margin:6px 0 18px"><span style="display:inline-block;background:rgba(232,97,26,.1);border:1px solid ' + OR + ';color:' + OR + ';font-size:20px;font-weight:800;padding:10px 22px;border-radius:10px;letter-spacing:1px">' + _esc(p.num_pc_new) + '</span></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' + filas + '</table>' +
      (items ? '<div style="margin-top:18px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + OR + '">Ítems</div>' +
               '<div style="margin-top:6px;font-size:13px;color:#374151;white-space:pre-line;background:#f9fafb;border:1px solid #eee;border-radius:8px;padding:12px">' + items + '</div>' : '') +
      (p.link_historial ? '<div style="margin-top:22px"><a href="' + _esc(p.link_historial) + '" style="display:inline-block;background:' + OR + ';color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:11px 20px;border-radius:8px">Ver en el sistema →</a></div>' : '') +
    '</div>' +
    '<div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #eee;color:#9ca3af;font-size:11px">Notificación automática de Compras — Nielsen Logística y Expediciones S.A.</div>' +
  '</div>';
}

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
    out.presupMap = {};
    p.presupuestos.forEach(function(f) {
      var blob = _blobFromDataUrl(f.dataUrl, f.name);
      if (!blob) return;
      var file = fSC.createFile(blob);
      try { file.setName(_prefijoItem(f.itemsIdx) + f.name); } catch (e) {}
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      var url = file.getUrl();
      out.presup.push({ name: f.name, url: url, item: f.item || '' });
      (f.itemsIdx || []).forEach(function(ix){
        var k = String(ix);
        if (!out.presupMap[k]) out.presupMap[k] = [];
        out.presupMap[k].push({ name: f.name, url: url });
      });
    });
  }
  if (p.fotos && p.fotos.length) {
    var gParent = _folderByName(root, 'FOTOS MUESTRAS SC');
    var gSC = _folderByName(gParent, scId);
    try { gSC.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    out.fotosFolderUrl = gSC.getUrl();
    out.fotosMap = {};
    p.fotos.forEach(function(f) {
      var blob = _blobFromDataUrl(f.dataUrl, f.name);
      if (!blob) return;
      var file = gSC.createFile(blob);
      try { file.setName(_prefijoItem(f.itemsIdx) + f.name); } catch (e) {}
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      var url = file.getUrl();
      out.fotos.push({ name: f.name, url: url, item: f.item || '' });
      (f.itemsIdx || []).forEach(function(ix){
        var k = String(ix);
        if (!out.fotosMap[k]) out.fotosMap[k] = [];
        out.fotosMap[k].push({ name: f.name, url: url });
      });
    });
  }
  return out;
}
// Escribe links de carpetas + mapa ítem→archivos en la SC (Supabase) para que el CC los muestre
// PATCH resiliente: si alguna columna no existe, PostgREST rechaza TODO el body.
// Por eso escribimos por partes y reintentamos campo por campo.
function _sbPatchSC(numSC, body) {
  try {
    var r = UrlFetchApp.fetch(SB_URL + '/rest/v1/solicitudes_compra?num_sc=eq.' + encodeURIComponent(numSC), {
      method: 'patch', contentType: 'application/json',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal' },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    return r.getResponseCode() < 300;
  } catch (e) { return false; }
}
function _patchSCDriveUrls(numSC, a) {
  if (!numSC || !a) return;
  var body = {};
  if (a.fotosFolderUrl)  body.drive_fotos_url  = a.fotosFolderUrl;
  if (a.presupFolderUrl) body.drive_presup_url = a.presupFolderUrl;
  if (a.fotosMap  && _keys(a.fotosMap).length)  body.fotos_map  = a.fotosMap;
  if (a.presupMap && _keys(a.presupMap).length) body.presup_map = a.presupMap;
  if (!_keys(body).length) return;
  if (_sbPatchSC(numSC, body)) return;               // 1º intento: todo junto
  _keys(body).forEach(function(k){                    // 2º: campo por campo (ignora los que no existan)
    var one = {}; one[k] = body[k];
    _sbPatchSC(numSC, one);
  });
}
function _keys(o){ return o ? Object.keys(o) : []; }
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


// ═════════════════════════════════════════════════════════════
// AUTORIZACIÓN DE COMPRAS — envío de la solicitud / notificación
// ═════════════════════════════════════════════════════════════
function _ccpAuth(p) {
  var pdf = null;
  try {
    if (p.memo_html) pdf = Utilities.newBlob(p.memo_html, 'text/html', 'Memo_' + (p.num_comp||'CCP') + '.html').getAs('application/pdf');
    if (pdf) pdf.setName('Memo_' + (p.num_comp||'CCP') + '.pdf');
  } catch (e) { pdf = null; }

  var enviados = [];
  if (p.modo === 'NOTIFICACION') {
    var htmlN = _tplCCPNotificacion(p);
    var toN = (p.copia||[]).map(function(x){ return x.email; }).join(',');
    if (toN) {
      var optsN = { name:NOMBRE_REMITENTE, htmlBody:htmlN };
      if (pdf) optsN.attachments = [pdf];
      GmailApp.sendEmail(toN, 'Compra autorizada por Compras — CCP ' + (p.num_comp||'') + (p.num_sc?(' · '+p.num_sc):''), _plain(htmlN), optsN);
      enviados = (p.copia||[]).map(function(x){ return x.email; });
    }
  } else {
    var cc = (p.copia||[]).map(function(x){ return x.email; }).join(',');
    (p.aprobadores||[]).forEach(function(ap) {
      var token = Utilities.getUuid();
      _sbPost('ccp_autorizaciones', {
        token: token, comp_id: String(p.comp_id), num_comp: p.num_comp || '',
        email: ap.email, nombre: ap.nombre || '', rol: 'APROBADOR', decision: 'PENDIENTE'
      });
      var html = _tplCCPSolicitud(p, token, false);
      var opts = { name:NOMBRE_REMITENTE, htmlBody:html };
      if (pdf) opts.attachments = [pdf];
      if (cc) opts.cc = cc;   // copia informativa (sin botones)
      GmailApp.sendEmail(ap.email, 'Solicitud de autorización de compra — CCP ' + (p.num_comp||'') + ' · ' + (p.monto||''), _plain(html), opts);
      enviados.push(ap.email);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ ok:true, enviados:enviados }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ccpResumenHTML(p) {
  var OR = '#E8611A';
  var fila = function(k, v){ return v ? ('<tr><td style="padding:7px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;width:42%">' + _esc(k) + '</td>'
    + '<td style="padding:7px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">' + _esc(String(v)) + '</td></tr>') : ''; };
  return '<div style="margin-top:18px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + OR + '">Resumen de la comparativa</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:5px">'
    + fila('N° de comparativa', p.num_comp)
    + fila('Solicitud vinculada', p.num_sc)
    + fila('Área solicitante', p.area)
    + fila('Presupuestos analizados', p.n_presupuestos)
    + fila('Proveedor recomendado', p.proveedor)
    + fila('Condición de pago', p.condicion_pago)
    + fila('Ahorro estimado', p.ahorro > 0 ? ((p.divisa||'$') + ' ' + Number(p.ahorro).toLocaleString('es-AR')) : '')
    + '</table>';
}
function _ccpItemsHTML(p) {
  if (!p.items || !p.items.length) return '';
  return '<div style="margin-top:18px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#E8611A">Elementos requeridos</div>'
    + '<ul style="margin:6px 0 0;padding-left:20px;font-size:13px;color:#374151;background:#f9fafb;border:1px solid #eee;border-radius:8px;padding:12px 14px 12px 32px">'
    + p.items.map(function(i){ return '<li style="margin:3px 0">' + _esc(i) + '</li>'; }).join('') + '</ul>';
}
function _ccpMontoHTML(p, titulo, sub) {
  return '<div style="background:rgba(232,97,26,.07);border:1px solid rgba(232,97,26,.32);border-radius:10px;padding:13px 16px;margin:16px 0">'
    + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#E8611A">' + _esc(titulo) + '</div>'
    + '<div style="font-size:17px;font-weight:800;color:#13161E;margin-top:2px">' + _esc(p.monto || '') + '</div>'
    + (sub ? '<div style="font-size:12px;color:#6b7280;margin-top:3px">' + _esc(sub) + '</div>' : '') + '</div>';
}
function _ccpFirma() {
  return '<div style="font-size:13px;color:#374151;line-height:1.6;margin-top:18px">Saludos cordiales,<br>'
    + '<b style="color:#13161E">Facundo Godoy Iramain</b><br>Responsable de Compras y Abastecimiento<br>Nielsen Logística y Expediciones S.A.</div>';
}
function _ccpShell(titulo, cuerpo, pie) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">'
    + '<div style="background:#13161E;padding:20px 24px">'
    + '<div style="color:#E8611A;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase">Nielsen — Compras y Abastecimiento</div>'
    + '<div style="color:#fff;font-size:20px;font-weight:800;margin-top:4px">' + _esc(titulo) + '</div></div>'
    + '<div style="padding:22px 24px;color:#1f2937">' + cuerpo + '</div>'
    + '<div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #eee;color:#9ca3af;font-size:11px">' + _esc(pie) + '</div></div>';
}

// Correo 1 — Notificación (menos de USD 200)
function _tplCCPNotificacion(p) {
  var b = '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">Estimados,</p>'
    + '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">Por medio del presente informo que, en el marco de las facultades del Departamento de Compras y Abastecimiento, se ha <b>autorizado la compra</b> correspondiente a la comparativa de presupuestos por '
    + _esc(p.asunto || 'la solicitud de referencia') + ', solicitada por el área de <b>' + _esc(p.area || '—') + '</b>'
    + (p.num_sc ? (' bajo la solicitud <b>' + _esc(p.num_sc) + '</b>') : '') + '.</p>'
    + _ccpItemsHTML(p)
    + _ccpResumenHTML(p)
    + _ccpMontoHTML(p, 'Monto total autorizado', 'Por resultar la opción más conveniente en términos económicos.')
    + '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">En virtud de lo expuesto, se procederá con la emisión de la orden de compra correspondiente'
    + (p.proveedor ? (' a favor de <b>' + _esc(p.proveedor) + '</b>') : '') + '.</p>'
    + '<p style="margin:0 0 14px;font-size:13px;color:#6b7280">Se adjunta memorándum interno con el detalle de la comparativa y análisis realizado.</p>'
    + '<div style="margin-top:18px"><a href="' + _esc(p.link_sistema||'#') + '" style="display:inline-block;border:1px solid #E8611A;color:#E8611A;text-decoration:none;font-weight:700;font-size:13px;padding:11px 20px;border-radius:8px">Ver comparativa en el sistema →</a></div>'
    + '<div style="font-size:11px;color:#9ca3af;margin-top:11px">Este correo es informativo: por el monto involucrado, la compra no requiere autorización de niveles superiores.</div>'
    + _ccpFirma();
  return _ccpShell('Compra autorizada', b, 'Notificación automática del sistema de Compras — Nielsen Logística y Expediciones S.A.');
}

// Correo 2 y 3 — Solicitud de autorización (con botones por token)
function _tplCCPSolicitud(p, token, esRecordatorio) {
  var url = ScriptApp.getService().getUrl();
  var link = function(a){ return url + '?t=' + encodeURIComponent(token) + '&a=' + a; };
  var btn = function(href, bg, txt){ return '<a href="' + href + '" style="display:inline-block;background:' + bg + ';color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:8px;margin:0 7px 7px 0">' + txt + '</a>'; };
  var reqTxt = (p.requeridas >= 2)
    ? 'Por el monto involucrado, la compra requiere la autorización de la Alta Dirección: alcanza con <b>2 de 3</b> aprobaciones. Cada destinatario recibe su propio enlace, de modo que el sistema registra quién autorizó y cuándo.'
    : 'Al elegir <b>Rechazar</b> se te pedirá el motivo. El Departamento de Compras recibe aviso de la decisión en el momento.';
  var b = (esRecordatorio ? '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#92400e"><b>Recordatorio:</b> esta comparativa quedó en stand by y corresponde una nueva evaluación.</div>' : '')
    + '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">Estimados,</p>'
    + '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">Por medio del presente, elevo para su consideración la comparativa de presupuestos correspondiente a '
    + _esc(p.asunto || 'la compra solicitada') + ', solicitada por el área de <b>' + _esc(p.area || '—') + '</b>'
    + (p.num_sc ? (' bajo la solicitud <b>' + _esc(p.num_sc) + '</b>') : '') + '.</p>'
    + _ccpItemsHTML(p)
    + '<p style="margin:14px 0;font-size:14px;color:#374151;line-height:1.65">Luego del análisis de las ofertas recibidas, desde el Departamento de Compras y Abastecimiento se recomienda avanzar con la propuesta de <b>'
    + _esc(p.proveedor || '—') + '</b>, por resultar la opción más conveniente en términos económicos, por un total de <b>' + _esc(p.monto || '') + '</b>'
    + (p.condicion_pago ? (', con condición de pago ' + _esc(p.condicion_pago)) : '') + '.</p>'
    + (p.ahorro > 0 ? ('<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">Asimismo, dicha alternativa representa un <b>ahorro estimado de ' + _esc((p.divisa||'$') + ' ' + Number(p.ahorro).toLocaleString('es-AR')) + '</b> respecto de la siguiente oferta considerada.</p>') : '')
    + _ccpResumenHTML(p)
    + _ccpMontoHTML(p, 'Monto a autorizar', 'Nivel requerido: ' + (p.nivel_label || ''))
    + '<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.65">En virtud de lo expuesto, se solicita autorización para proceder con la emisión de la orden de compra correspondiente'
    + (p.proveedor ? (' a favor de <b>' + _esc(p.proveedor) + '</b>') : '') + '.</p>'
    + '<p style="margin:0 0 14px;font-size:13px;color:#6b7280">Se adjunta memorándum interno con el detalle de la comparativa y análisis realizado.</p>'
    + '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">'
    + '<div style="font-size:13px;color:#374151;margin-bottom:11px"><b>Su decisión:</b> con un clic queda registrada en el sistema.</div>'
    + btn(link('aprobar'),  '#16a34a', '✓ Aprobar')
    + btn(link('standby'),  '#f59e0b', '⏸ Stand by')
    + btn(link('rechazar'), '#dc2626', '✕ Rechazar')
    + '<div style="font-size:11px;color:#9ca3af;margin-top:11px;line-height:1.6"><b>Stand by</b> deja la compra en espera y programa un recordatorio automático para una nueva evaluación (podrás elegir en cuántos días).<br>' + reqTxt + '</div>'
    + '</div>' + _ccpFirma();
  return _ccpShell('Solicitud de autorización de compra', b, 'Solicitud generada desde el sistema de Compras — Nielsen Logística y Expediciones S.A.');
}


// ═════════════════════════════════════════════════════════════
// ADJUNTOS — prefijo de ítem en el nombre del archivo
// Permite reconstruir el mapa ítem→archivo leyendo la carpeta de Drive.
//   [IT02] foto.jpg   → ítem 2 (índice 1)
//   [IT02-05] foto.jpg → ítems 2 y 5
//   [GRAL] foto.jpg   → general / todos los ítems
// ═════════════════════════════════════════════════════════════
function _prefijoItem(itemsIdx) {
  if (!itemsIdx || !itemsIdx.length) return '[GRAL] ';
  var nums = itemsIdx.map(function(i){ var n = Number(i) + 1; return (n < 10 ? '0' : '') + n; });
  return '[IT' + nums.join('-') + '] ';
}
function _idxDesdeNombre(nombre, totalItems) {
  var m = String(nombre || '').match(/^\[IT([\d\-]+)\]/i);
  if (m) return m[1].split('-').map(function(x){ return parseInt(x, 10) - 1; }).filter(function(n){ return !isNaN(n) && n >= 0; });
  if (/^\[GRAL\]/i.test(nombre || '')) {
    var all = [];
    for (var i = 0; i < (totalItems || 0); i++) all.push(i);
    return all;
  }
  return null;   // archivo viejo, sin prefijo
}
function _subcarpeta(padre, nombre) {
  var it = DriveApp.getFoldersByName(padre);
  while (it.hasNext()) {
    var f = it.next();
    var sub = f.getFoldersByName(nombre);
    if (sub.hasNext()) return sub.next();
  }
  return null;
}
// Reindexa las carpetas de Drive de una SC y reescribe los links en Supabase.
// URL:  ...exec?a=reindex&sc=SCSSMA-2026-0016
function _reindexarSC(numSC) {
  if (!numSC) return _pagina('Falta el N° de SC', 'No se indicó qué solicitud reparar.', '#dc2626');
  var comp = _sbGet('solicitudes_compra?num_sc=eq.' + encodeURIComponent(numSC) + '&select=items');
  var totalItems = 0;
  if (comp && comp[0] && comp[0].items) totalItems = String(comp[0].items).split('\n').filter(function(l){ return l.trim(); }).length;

  var res = { fotos: 0, presup: 0 };
  var body = {};

  var gSC = _subcarpeta('FOTOS MUESTRAS SC', numSC);
  if (gSC) {
    try { gSC.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    body.drive_fotos_url = gSC.getUrl();
    var mapF = {}, itF = gSC.getFiles();
    while (itF.hasNext()) {
      var f = itF.next();
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      res.fotos++;
      var idxs = _idxDesdeNombre(f.getName(), totalItems);
      if (!idxs) continue;
      idxs.forEach(function(ix){ var k = String(ix); if (!mapF[k]) mapF[k] = []; mapF[k].push({ name: f.getName(), url: f.getUrl() }); });
    }
    if (_keys(mapF).length) body.fotos_map = mapF;
  }
  var fSC = _subcarpeta('PRESUPUESTOS SC', numSC);
  if (fSC) {
    try { fSC.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    body.drive_presup_url = fSC.getUrl();
    var mapP = {}, itP = fSC.getFiles();
    while (itP.hasNext()) {
      var g = itP.next();
      try { g.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      res.presup++;
      var ip = _idxDesdeNombre(g.getName(), totalItems);
      if (!ip) continue;
      ip.forEach(function(ix){ var k = String(ix); if (!mapP[k]) mapP[k] = []; mapP[k].push({ name: g.getName(), url: g.getUrl() }); });
    }
    if (_keys(mapP).length) body.presup_map = mapP;
  }

  if (!_keys(body).length) {
    return _pagina('No se encontraron archivos',
      'No hay carpeta en Drive para la solicitud <b>' + _esc(numSC) + '</b>.<br><br>'
      + 'Es decir: <b>las fotos/presupuestos nunca llegaron a guardarse</b> desde el Formulario SC. '
      + 'Volvé a cargarlos desde el formulario o subilos a mano a «FOTOS MUESTRAS SC / ' + _esc(numSC) + '».', '#dc2626');
  }
  _keys(body).forEach(function(k){ var one = {}; one[k] = body[k]; _sbPatchSC(numSC, one); });
  return _pagina('✓ Adjuntos reparados',
    'Solicitud <b>' + _esc(numSC) + '</b>:<br>· Fotos encontradas: <b>' + res.fotos + '</b><br>· Presupuestos: <b>' + res.presup + '</b><br><br>'
    + 'Los enlaces quedaron actualizados. Volvé al Centro de Control y recargá la solicitud.'
    + (res.fotos && !body.fotos_map ? '<br><br><i>Nota: los archivos no tienen el prefijo de ítem (son anteriores a esta versión), '
      + 'por eso el badge abrirá la carpeta en lugar del archivo puntual.</i>' : ''), '#16a34a');
}
