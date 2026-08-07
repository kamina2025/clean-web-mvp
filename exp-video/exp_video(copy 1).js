// --- 1. CONFIGURACIÓN DEL EXPERIMENTO ---
const CREADOR_NANO = "nano_19dppxbmzraheooi888n9i9mrks9y5xgop1cg83p3engz3nisfdqj8urma86";
const PRECIO_VIDEO = 0.00001;

// Magnet URI corregido (URL exacta: wss://tracker.webtorrent.dev)
const TORRENT_MAGNET = "magnet:?xt=urn:btih:4cdebbc744f902c57bed1841ebfac88f19cf22b5&dn=Sintel.mp4&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337";

// Elementos del DOM
const btnPlay = document.getElementById('btnPlay');
const videoOverlay = document.getElementById('videoOverlay');
const videoPlayer = document.getElementById('videoPlayer');
const nanoTxStatus = document.getElementById('nanoTxStatus');
const payStatus = document.getElementById('payStatus');
const peerCount = document.getElementById('peerCount');
const downloadSpeed = document.getElementById('downloadSpeed');

let torrentCliente = null;

// --- 2. SOLICITUD DE PAGO A LA EXTENSIÓN ---
window.solicitarPagoVideo = function() {
  btnPlay.disabled = true;
  btnPlay.innerText = "⚡ Procesando...";
  nanoTxStatus.innerText = "⏳ Emitiendo transacción a la red Nano...";
  nanoTxStatus.style.color = "#facc15";

  window.postMessage({
    type: "CLEANWEB_MICROPAGO_TRIGGER",
    direccionDestino: CREADOR_NANO,
    montoXNO: PRECIO_VIDEO,
    concepto: "Pay-Per-View Video P2P"
  }, "*");
};

// --- 3. RESPUESTA DE LA EXTENSIÓN Y DESBLOQUEO ---
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEANWEB_PAGO_RESPUESTA") {
    if (event.data.exito) {
      nanoTxStatus.innerText = `✅ Hash: ${event.data.hash.substring(0, 10)}...`;
      nanoTxStatus.style.color = "var(--nano-green)";
      payStatus.innerText = "🔓 Contenido Desbloqueado";
      payStatus.classList.add("active");
      
      videoOverlay.style.display = "none";
      iniciarWebTorrent();
    } else {
      nanoTxStatus.innerText = `❌ Error: ${event.data.error || 'Saldo insuficiente'}`;
      nanoTxStatus.style.color = "#ef4444";
      btnPlay.disabled = false;
      btnPlay.innerText = "▶️ Reintentar Pago";
    }
  }
});

// --- 4. LÓGICA DE WEBTORRENT (Streaming progresivo de alta resiliencia) ---

const TRACKERS_WEBTORRENT = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev'
];

function iniciarWebTorrent() {
  // Destruir cliente previo de forma segura
  if (torrentCliente) {
    try {
      torrentCliente.destroy();
    } catch (e) {
      console.warn("⚠️ Limpiando cliente anterior:", e);
    }
  }

  torrentCliente = new WebTorrent();

  // Prevenir que errores globales no capturados de WebTorrent destruyan la ejecución
  torrentCliente.on('error', function (err) {
    console.warn("⚠️ Evento de error atrapado en cliente WebTorrent:", err.message || err);
  });

  console.log("⚡ Conectando a la red P2P WebTorrent...");

  const opcionesTorrent = {
    announce: TRACKERS_WEBTORRENT
  };

  torrentCliente.add(TORRENT_MAGNET, opcionesTorrent, function (torrent) {
    // 1. Manejo de errores dentro del torrent
    torrent.on('error', function (err) {
      console.warn("⚠️ Error en el torrent:", err);
    });

    // 2. Buscar archivo de video
    const file = torrent.files.find(function (f) {
      return f.name.endsWith('.webm') || f.name.endsWith('.mp4') || f.name.endsWith('.mkv');
    });

    if (!file) {
      console.error("❌ No se encontró ningún archivo de video compatible.");
      return;
    }

    console.log("✅ Archivo de video encontrado:", file.name);

    // 3. Forzar selección secuencial (descargar primero el inicio del video)
    file.select();

    // 4. Métricas P2P
    torrent.on('download', function () {
      const speedKB = (torrent.downloadSpeed / 1024).toFixed(2);
      if (downloadSpeed) downloadSpeed.innerText = `${speedKB} KB/s`;
      if (peerCount) peerCount.innerText = `${torrent.numPeers} Pares conectados`;
    });

    // 5. Preparar nodo de video en el DOM
    const viejoPlayer = document.getElementById('videoPlayer');
    const nuevoPlayer = viejoPlayer.cloneNode(false);
    
    nuevoPlayer.removeAttribute('src');
    nuevoPlayer.preload = "auto";
    nuevoPlayer.controls = true;
    
    viejoPlayer.parentNode.replaceChild(nuevoPlayer, viejoPlayer);

    console.log("🎬 Inyectando streaming en el reproductor...");

    // 6. Intentar Streaming con renderTo e intercepción de errores de Stream
    let renderStream;
    try {
      renderStream = file.renderTo(nuevoPlayer, { autoplay: false }, function (err, elem) {
        if (err) {
          console.warn("⚠️ Failure en renderTo, activando reproducción progresiva por URL:", err);
          iniciarReproduccionPorURL(file, nuevoPlayer);
          return;
        }

        console.log("🎬 Reproductor inyectado. Esperando primeros fotogramas...");

        elem.addEventListener('canplay', function () {
          console.log("🔋 Primeros fotogramas listos. Iniciando reproducción...");
          reproducirVideo(elem);
        }, { once: true });
      });

      // Interceptar error interno de videostream para que no lance "Uncaught Error"
      if (renderStream && typeof renderStream.on === 'function') {
        renderStream.on('error', function (err) {
          console.warn("⚠️ Interceptado error temporal de buffer en renderStream:", err);
        });
      }
    } catch (e) {
      console.warn("⚠️ Excepción al renderizar stream direct. Cambiando a modo URL...", e);
      iniciarReproduccionPorURL(file, nuevoPlayer);
    }
  });
}

// --- MÉTODOS AUXILIARES ---

// Alternativa en caso de fallo de videostream: genera URL de objeto del archivo progresivo
function iniciarReproduccionPorURL(file, videoElem) {
  file.getBlobURL(function (err, url) {
    if (err) {
      console.error("❌ Error al generar Blob URL:", err);
      return;
    }
    videoElem.src = url;
    reproducirVideo(videoElem);
  });
}

// Lógica de inicio de video adaptable a políticas de Autoplay del navegador
function reproducirVideo(elem) {
  const promise = elem.play();
  if (promise !== undefined) {
    promise.then(() => {
      console.log("▶️ Reproducción iniciada correctamente.");
    }).catch(err => {
      console.warn("⚠️ El navegador requiere silencio inicial para Autoplay. Silenciando...", err);
      elem.muted = true;
      elem.play();
    });
  }
}