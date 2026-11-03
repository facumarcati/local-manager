# Mis locales

Administración de alquileres, cobros y gastos propios. Interfaz para computadora y celular, con temas claro/oscuro y tamaño de texto normal/grande.

## Iniciar

Requiere Node.js 22 o posterior y MongoDB con transacciones (Atlas o un replica set).

1. Instalar las dependencias con npm install.
2. Configurar URI_MONGODB y, opcionalmente, PORT en .env. No compartir este archivo.
3. Ejecutar npm start. El puerto predeterminado es 8081; se respeta PORT si ya está configurado.

## Apariencia y navegación

Los selectores de apariencia y tamaño de texto están en el menú. Las preferencias se guardan en ese navegador y se conservan al cambiar de pantalla. Las pestañas y los enlaces internos cambian de pantalla sin recargar la página, con una transición breve que respeta la preferencia del sistema de reducir movimiento. También funcionan los botones Atrás y Adelante, la búsqueda y los formularios después de navegar. Los envíos que guardan datos conservan su confirmación y validación.

La estructura visual toma como referencia Landlord Studio (https://www.landlordstudio.com/): navegación lateral y organización de cobros, gastos y propiedades, adaptadas a este proyecto.

## Uso

- Agregar los locales y luego sus contratos.
- Para contratos anteriores, marcar “Este contrato ya terminó”. Se crean sus cuotas sin modificar la ocupación actual.
- Se crea una cuota completa por mes, sin prorrateo automático. Si el primer vencimiento ya pasó, vence al comenzar el contrato. Se puede corregir cada importe y vencimiento con un motivo.
- Los cobros pendientes incluyen las deudas de contratos finalizados. Registrar cada movimiento con su fecha real, medio y notas.
- Para aumentos anteriores: cargar el importe inicial, ajustar desde cada fecha de aumento y luego registrar los cobros históricos.
- Cargar una factura seleccionando uno o varios locales. El total se registra una sola vez y no genera deudas para inquilinos.
- Las anulaciones conservan el original y su motivo. Los gastos admiten pagos parciales.
- El resumen mensual usa las fechas reales de los movimientos; las alertas de deuda muestran la situación de hoy.
- Al terminar anticipadamente un contrato, corregir primero la fecha de fin y luego finalizarlo. Se impide retirar cuotas posteriores que tengan cobros.

Esta versión registra cobros y gastos. No emite comprobantes fiscales, no ejecuta transferencias y no distribuye automáticamente un pago entre varias cuotas. Los anticipos se pueden registrar en la cuota futura correspondiente; no hay una cuenta de crédito independiente para excedentes.

## Comprobaciones

- npm test: pruebas de fechas, importes y generación de cuotas.
- npm run test:integration: crea una base temporal local*manager_test* con sufijo numérico en el mismo servidor, comprueba rutas y operaciones, y elimina únicamente esa base al terminar. Necesita acceso a MongoDB y permisos para crear bases temporales.
- npm run format: formatea los archivos del proyecto.

## Copia y reinicio

La carpeta .backups está excluida de Git y contiene datos privados. Guardar una copia aparte antes de trasladar o borrar el proyecto.

El script scripts/reset-data.js requiere el argumento explícito RESET_LOCAL_MANAGER: exporta las cinco colecciones de la aplicación en EJSON, verifica el archivo y luego las vacía en una transacción. No usarlo durante el trabajo diario ni con la aplicación recibiendo operaciones. No borra otras colecciones ni bases.

Para recuperar una copia en la base vacía: node scripts/restore-data.js RUTA_DE_LA_COPIA RESTORE_LOCAL_MANAGER. La recuperación se rechaza si hay datos existentes y no toma credenciales del archivo.

## Alcance de acceso

La aplicación mantiene el acceso local del proyecto original y todavía no tiene usuarios ni contraseña. Antes de publicarla en Internet se necesita incorporar autenticación y configurar el despliegue. El diseño se adapta al celular; eso no publica automáticamente el servidor.
