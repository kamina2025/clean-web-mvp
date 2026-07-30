// content_script.js
console.log("🌱 Web Limpia: Content script activo en la página.");

// ============================================================================
// MODULO 1: CAPTURA DE EVENTOS MANUALES / INTERACTIVOS (Clic, Video, Música, Fotos)
// ============================================================================
window.addEventListener("message", (event) => {
    // Solo procesar mensajes originados en la propia pestaña y con nuestro evento
    if (event.source !== window || !event.data || event.data.type !== "CLEANWEB_MICROPAGO_TRIGGER") {
        return;
    }

    const { direccionDestino, montoXNO, concepto } = event.data;

    console.log(`📡 [Web Limpia] Acción manual capturada: ${concepto} (${montoXNO} XNO) -> ${direccionDestino}`);

    // Reenviar a background.js usando la estructura estándar
    chrome.runtime.sendMessage(
        {
            action: "DISPARAR_MICROPAGO",
            datos: {
                site_id: "EVENT-TRIGGER",
                destino: direccionDestino,
                monto: montoXNO,
                dwell_time_sec: 0,
                url: window.location.href,
                titulo: `${document.title} - [${concepto}]`
            }
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("❌ Error al comunicarse con background:", chrome.runtime.lastError.message);
                window.postMessage({ type: "CLEANWEB_PAGO_RESPUESTA", exito: false, error: chrome.runtime.lastError.message }, "*");
            } else if (response && response.exito) {
                console.log("✅ Micropago por evento procesado con éxito. Hash:", response.hash);
                window.postMessage({ type: "CLEANWEB_PAGO_RESPUESTA", exito: true, hash: response.hash }, "*");
            } else {
                console.error("❌ Falló el micropago por evento:", response ? response.error : "Sin respuesta");
                window.postMessage({ type: "CLEANWEB_PAGO_RESPUESTA", exito: false, error: response ? response.error : "Error desconocido" }, "*");
            }
        }
    );
});


// ============================================================================
// MODULO 2: ATENCIÓN AUTOMÁTICA BASADA EN METADATOS Y TIEMPO DE LECTURA (<meta>)
// ============================================================================
chrome.storage.local.get(["autoPayEnabled"], (res) => {
    if (res.autoPayEnabled === false) {
        console.log("🛑 Web Limpia: Micropagos automáticos deshabilitados por el usuario.");
        return;
    }

    function detectarYProcesarAtencion() {
        // 1. Extraer metadatos de la página del creador
        const metaSiteId = document.querySelector('meta[name="cleanweb-site-id"]');
        const metaDireccion = document.querySelector('meta[name="cleanweb-nano-address"]');
        const metaMonto = document.querySelector('meta[name="cleanweb-rate-xno"]');
        const metaTiempo = document.querySelector('meta[name="cleanweb-min-seconds"]');

        // Si la página no es de la Web Limpia (no tiene metadatos de dirección), no hace nada
        if (!metaDireccion) {
            console.log("ℹ️ Web Limpia: Esta página no contiene metadatos de Web Limpia.");
            return;
        }

        // Extraer valores o asignar fallbacks
        const siteId = metaSiteId ? metaSiteId.getAttribute("content") : "SITE-UNREGISTERED";
        const direccionCreador = metaDireccion.getAttribute("content");
        const montoXNO = parseFloat(metaMonto ? metaMonto.getAttribute("content") : "0.000001");
        const segundosRequeridos = parseInt(metaTiempo ? metaTiempo.getAttribute("content") : "15");

        console.log(`⏱️ Web Limpia: Detectada página con monetización [ID: ${siteId}]`);
        console.log(`📍 Creador: ${direccionCreador}`);
        console.log(`⏳ Tiempo requerido: ${segundosRequeridos}s | Monto: ${montoXNO} XNO`);

        // 2. Iniciar temporizador de atención activa
        let tiempoTranscurrido = 0;
        let pagoEnviado = false;

        const temporizador = setInterval(() => {
            // Solo contar tiempo si el usuario tiene la pestaña visible y activa
            if (!document.hidden) {
                tiempoTranscurrido++;
                console.log(`⏱️ Atención activa: ${tiempoTranscurrido}/${segundosRequeridos}s`);

                if (tiempoTranscurrido >= segundosRequeridos && !pagoEnviado) {
                    pagoEnviado = true;
                    clearInterval(temporizador);

                    console.log(
                        "🚀 Tiempo cumplido. Notificando a la extensión para emitir micropago y registrar métrica..."
                    );

                    // 3. Enviar mensaje a background.js con el esquema que Apps Script espera
                    chrome.runtime.sendMessage(
                        {
                            action: "DISPARAR_MICROPAGO",
                            datos: {
                                site_id: siteId,
                                destino: direccionCreador,
                                monto: montoXNO,
                                dwell_time_sec: tiempoTranscurrido,
                                url: window.location.href,
                                titulo: document.title
                            }
                        },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                console.error(
                                    "❌ Error al comunicarse con background:",
                                    chrome.runtime.lastError.message
                                );
                            } else if (response && response.exito) {
                                console.log("✅ Micropago procesado con éxito. Hash:", response.hash);
                            } else {
                                console.error(
                                    "❌ Falló el procesamiento del micropago:",
                                    response ? response.error : "Sin respuesta"
                                );
                            }
                        }
                    );
                }
            }
        }, 1000);
    }

    // Ejecutar la detección al cargar la página
    detectarYProcesarAtencion();
});