// --- 1. CONFIGURACIÓN DEL EXPERIMENTO ---
const CREADOR_NANO = "nano_19dppxbmzraheooi888n9i9mrks9y5xgop1cg83p3engz3nisfdqj8urma86";
const PRECIO_VIDEO = 0.00001;

// Magnet URI oficial de Sintel
const TORRENT_MAGNET = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel";

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
}

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

// --- 4. LÓGICA DE WEBTORRENT (Con control de AutoPlay Avanzado) ---
function iniciarWebTorrent() {
  if (torrentCliente) {
    try { torrentCliente.destroy(); } catch(e){}
  }

  torrentCliente = new WebTorrent();
  console.log("Conectando a la red P2P WebTorrent...");

  const opcionesTorrent = {
    announce: [
      'wss://tracker.webtorrent.dev',
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.btorrent.xyz'
    ]
  };

  torrentCliente.add(TORRENT_MAGNET, opcionesTorrent, function (torrent) {
    const file = torrent.files.find(function (f) {
      return f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mkv');
    });

    if (file) {
      console.log("✅ Archivo de video encontrado:", file.name);

      let reproductorMontado = false;

      torrent.on('download', function () {
        // Actualizar métricas
        const speedKB = (torrent.downloadSpeed / 1024).toFixed(2);
        downloadSpeed.innerText = `${speedKB} KB/s`;
        peerCount.innerText = `${torrent.numPeers} Pares conectados`;

        // Búfer mínimo 300KB antes de intentar reproducir
        if (!reproductorMontado && (torrent.downloaded > 300 * 1024 || torrent.progress > 0.01)) {
          reproductorMontado = true;
          console.log("▶️ Búfer inicial acumulado. Montando reproductor P2P...");

          file.renderTo(videoPlayer, {
            autoplay: false // Tomamos el control nosotros
          }, function (err, elem) {
            if (err) {
              console.error("❌ Error al renderizar el video:", err);
              return;
            }
            
            console.log("🎬 Reproductor inyectado. Esperando confirmación de fotogramas...");

            // ESCUCHAMOS CUANDO EL NAVEGADOR ESTÉ LISTO
            elem.addEventListener('canplay', function() {
              console.log("🔋 Navegador listo. Intentando reproducir...");
              const playPromise = elem.play();
              
              if (playPromise !== undefined) {
                playPromise.then(() => {
                  console.log("▶️ Reproducción iniciada perfectamente con sonido.");
                }).catch(error => {
                  // Si falla el sonido por expiración del token de clic, forzamos MUTE
                  console.warn("⚠️ El navegador bloqueó el autoplay por sonido. Silenciando y forzando...", error);
                  elem.muted = true;
                  elem.play();
                });
              }
            }, { once: true }); // Solo lo ejecutamos la primera vez
          });
        }
      });

      torrent.on('wire', function () {
        peerCount.innerText = `${torrent.numPeers} Pares conectados`;
      });

    } else {
      console.error("❌ No se encontró ningún archivo de video en este torrent.");
    }
  });
}