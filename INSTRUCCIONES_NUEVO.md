# Nielsen — Cambios de esta entrega

## 1) Compras por Proveedor — RESPONSIVE ✅
Los cuadros y gráficos ahora se reacomodan solos en celular/tablet (las dos
columnas pasan a una sola, las alturas se ajustan y la leyenda de la torta se
mueve abajo). Además se re-dibujan al rotar la pantalla. No hay que hacer nada.

## 2) Compras por Área y Compras por Campamento — NUEVAS ✅
Dos secciones nuevas en el menú **Proveedores**, abajo de "Compras por Proveedor".
Tienen filtros por mes, año y rango, gráfico de barras + torta + un gráfico por
categoría, KPIs y tabla con % del total. Todo responsive.

### Cómo cargar los datos (2 opciones)
**A) Manual (funciona YA):** botón "⬆️ Importar Planilla COMPRAS" (modo Editor).
Subís el Excel de la planilla COMPRAS y listo. El sistema:
- Toma **Q** (Precio Total+IVA+Otros) como monto.
- Agrupa por **T** (Campamento), **V** (Categoría), **W** (Área).
- Cuenta comprobantes distintos por **D** (N° Comprobante) — comprobantes con
  varios ítems se suman pero cuentan como 1.
- **Resta** las Notas de Crédito (NC).

> Detección de columnas: primero busca por nombre de encabezado; si no los
> encuentra usa las letras fijas D/Q/T/V/W. Detección de NC: si el N° de
> comprobante contiene "NC" o "NOTA DE CRÉDITO". **Confirmame si tu planilla
> marca las NC de otra forma** (otra columna, código distinto) y lo ajusto.

**B) Automática (sincronización diaria):** para que se llene solo como en
"Compras por Proveedor", hay que crear una tabla en Supabase y agregar unas
líneas al Apps Script (ver abajo).

---

## SQL — crear tabla en Supabase
En Supabase → SQL Editor → pegar y ejecutar:

```sql
create table if not exists public.compras_detalle (
  id          bigint generated always as identity primary key,
  comprobante text,
  monto       numeric,
  campamento  text,
  categoria   text,
  area        text,
  fecha       date
);
-- lectura pública (igual que compras_proveedor)
alter table public.compras_detalle enable row level security;
create policy "lectura publica compras_detalle"
  on public.compras_detalle for select using (true);
create policy "escritura anon compras_detalle"
  on public.compras_detalle for all using (true) with check (true);
```

---

## Apps Script — agregar al sync diario
En tu proyecto de Apps Script, agregá una función que recorra la planilla
COMPRAS y suba estas columnas a `compras_detalle` (full replace diario). Mapeo
de columnas (1-indexed en Apps Script): D=4, Q=17, T=20, V=22, W=23.

```javascript
function syncComprasDetalle() {
  var SB_URL = 'https://qivvewvgqlsptydftlhx.supabase.co';
  var SB_KEY = 'TU_SERVICE_ROLE_O_ANON_KEY';
  var sh = SpreadsheetApp.openById('1kbvtrc20NELbbSj66g8lpBgiKEdaALHeZ_SdNOV0fb4')
             .getSheetByName('COMPRAS'); // ajustá el nombre de la hoja
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var comp = String(r[3]  || '').trim();   // D
    var camp = String(r[19] || '').trim();   // T
    var cat  = String(r[21] || '').trim();   // V
    var area = String(r[22] || '').trim();   // W
    var monto = Number(r[16]) || 0;          // Q
    if (!comp && !camp && !area && !monto) continue;
    if (/\bNC\b|NOTA\s*DE\s*CR[EÉ]DITO/i.test(comp)) monto = -Math.abs(monto);
    var fecha = r[/* índice de tu columna fecha */ 0];
    var fechaStr = (fecha instanceof Date) ? Utilities.formatDate(fecha, 'GMT-3', 'yyyy-MM-dd') : '';
    rows.push({comprobante: comp, monto: monto, campamento: camp || 'SIN ESPECIFICAR',
               categoria: cat || 'SIN ESPECIFICAR', area: area || 'SIN ESPECIFICAR', fecha: fechaStr || null});
  }
  // borrar todo y reinsertar
  UrlFetchApp.fetch(SB_URL + '/rest/v1/compras_detalle?id=gt.0', {
    method: 'delete', headers: {apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY}, muteHttpExceptions: true});
  for (var j = 0; j < rows.length; j += 500) {
    UrlFetchApp.fetch(SB_URL + '/rest/v1/compras_detalle', {
      method: 'post', contentType: 'application/json',
      headers: {apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'return=minimal'},
      payload: JSON.stringify(rows.slice(j, j+500)), muteHttpExceptions: true});
  }
}
```
> Ajustá el índice de la columna **fecha** (en el código está en 0 como
> placeholder) y el nombre de la hoja. Después agendá `syncComprasDetalle` en
> el mismo trigger diario que ya usás.

---

## 3) Emails de confirmación — ahora por Gmail (Apps Script) ✅

Saqué EmailJS y lo pasé a **Apps Script + Gmail**, como pediste. Ventajas:
- Se envía desde **tu cuenta/dominio**, funciona en **cualquier** celular/tablet.
- **Copia automática (CC) a Compras** (facundo.godoy@nielsenexpediciones.com.ar) en cada solicitud/pedido.
- Sin claves por dispositivo ni límites de EmailJS. Mail con diseño Nielsen.

### Pasos (una sola vez)
1. Abrí **Apps_Script_Email.gs** (incluido en el ZIP) y copiá todo el código.
2. Andá a https://script.google.com → **Nuevo proyecto** y pegalo en un archivo `.gs`.
3. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo** (tu cuenta).
   - *Quién tiene acceso:* **Cualquier persona**.
4. La primera vez te pide **autorizar el permiso de Gmail** → aceptá.
5. Copiá la **URL que termina en `/exec`**.
6. Pegá esa URL en `MAIL_WEBAPP_URL` (arriba del bloque de envío) en **formulario_sc.html** y en **pedidos.html**.
7. Re-deploy a Vercel.

> Prueba rápida: pegá la URL `/exec` en el navegador → debe responder
> "OK — Web App de correos Nielsen activa".

> El correo se manda en modo "fire-and-forget" (Apps Script no expone CORS),
> así que la app muestra "✅ Confirmación enviada". Si querés que además te
> avise en pantalla cuando el server falla, lo podemos sumar con un segundo
> endpoint de verificación. Para el caso de uso, el envío por Gmail es muy
> confiable.

> Si cambiás el destinatario de copia, editá `REMITENTE_CC` en el Apps Script.

---

# Entrega adicional (esta sesión)

## A) Lista de Pedido copiable (Historial SC y PA)
En el modal **Ver** (tanto de SC como de PA) hay un botón **📋 Lista de pedido**
que abre un cuadro con el pedido enlistado (ítems numerados + datos) y un botón
**Copiar todo** para pegarlo en un mail o WhatsApp al proveedor.

## B) Fix — botón Eliminar en Historial de PA
El botón Eliminar del modal era compartido con el de SC y llamaba a `eliminarSC`,
por eso no borraba el PA (e incluso podía borrar la primera SC). Ahora un
dispatcher detecta si estás viendo una SC o un PA y llama a la función correcta
(`eliminarPA` / `eliminarSC`). Probado.

## C) Compras por Área / Campamento — lectura directa del Google Sheet
Agregué el botón **🔄 Traer de la planilla** en ambas secciones y, al abrirlas,
si no hay datos en Supabase, intenta leer la planilla automáticamente.

**Para que la lectura directa funcione**, la planilla COMPRAS tiene que estar
**publicada en la web** (esto evita el bloqueo CORS del navegador):
1. En la planilla: **Archivo → Compartir → Publicar en la web**.
2. Elegí la hoja **COMPRAS** y formato **CSV** → **Publicar**.
3. Copiá la URL (termina en `output=csv`) y pegala en `SHEET_DETALLE_CSV_URL`
   (arriba del bloque de detalle en index.html).

> Sin publicar, el sistema intenta el endpoint `export?format=csv` con el ID y
> gid de tu planilla (gid 1491641052). Si tu navegador lo bloquea por CORS,
> publicá en la web como arriba. La opción más robusta sigue siendo la
> sincronización diaria por Apps Script a la tabla `compras_detalle` (SQL +
> snippet más arriba en este documento).

> El import manual por Excel sigue disponible como antes.
