# 🌐 Web Limpia (Clean Web MVP)

> Un prototipo funcional de arquitectura web basada en **Privacidad**, **Micropagos Automáticos con Nano (XNO)** y **Soberanía del Usuario**, eliminando la necesidad de publicidad invasiva, rastreo de datos y paywalls tradicionales.

---

## 🚀 Características Principales

1. **Batería de Navegación (Extensión Web):** Billetera local no custodial que gestiona llaves criptográficas directamente en el navegador (Manifest V3) usando `nanocurrency-web`.
2. **Micropagos Instantáneos:** Transacciones directas P2P sin comisiones intermedias ($0.00$) mediante la red de **Nano (XNO)**.
3. **Métricas Éticas y Directorio Orgánico:** Registro transparente de interacciones/lecturas activas mediante metadatos estáticos y un indexador sin cookies ni seguimiento de usuarios.
4. **Experimentos Interactivos:** Casos de uso demostrativos para cobro por tiempo de atención, reproducción de video, música y propinas/likes.

---

## 🏗️ Arquitectura del Sistema

* **Capa Monetaria:** Red Nano (XNO) + Nodos RPC / API `nano.to`
* **Cliente / Extensión:** Chrome / Opera / Brave / Edge (Manifest V3)
* **Indexador & Base de Datos:** Google Apps Script + Google Sheets (o backend REST)
* **Frontend Web:** HTML5 + Vanilla JS (Compatible con IPFS)

---

## 🛠️ Guía de Instalación Rápida (5 Minutos)

### 1. Cargar la Extensión en el Navegador

1. Clona este repositorio o descarga el archivo ZIP:
   ```bash
   git clone [https://github.com/TU_USUARIO/clean-web-mvp.git](https://github.com/TU_USUARIO/clean-web-mvp.git)
   ```
2. Abre tu navegador (Chrome, Opera, Brave o Edge) e ingresa a `chrome://extensions/` o `opera://extensions/`.
3. Activa el **Modo Desarrollador** (Developer Mode) en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** (Load unpacked) y selecciona la carpeta `/extension`.
5. *(Opcional)* Edita `extension/background.js` e inserta tu clave API en la variable `NANO_TO_API_KEY`.

### 2. Ejecutar la Suite Web de Pruebas

1. Abre el archivo `web-suite/index.html` en tu navegador para interactuar con el buscador.
2. Ingresa a `experimento_video.html`, `experimento_galeria.html` o `experimento_musica.html` para probar las demostraciones de micropagos en tiempo real.

---

## 🧪 Experimentos Incluidos

| Archivo | Caso de Uso | Mecanismo de Monetización |
| :--- | :--- | :--- |
| `experimento_video.html` | Video a Demanda | Micropago directo al hacer clic en "Reproducir Video". |
| `experimento_galeria.html` | Galería de Arte / Fotos | Sistema de Likes y Propinas instantáneas al creador. |
| `experimento_musica.html` | Streaming de Audio | Micropago imperceptible al dar Play a las pistas. |
| `constructor.html` | Panel de Creadores | Emisión del manifiesto `cleanweb.json` y registro en el indexador. |

---

## 🛡️ Principios de Privacidad

* **Cero Cookies de Rastreo:** No recopila ni guarda información personal de navegación.
* **Firma Local:** Las semillas y claves privadas nunca salen del almacenamiento local del usuario (`chrome.storage.local`).
* **Descentralización:** Preparado para distribución en **IPFS** (InterPlanetary File System).

---

## 📜 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Siéntete libre de modificarlo, contribuir o adaptarlo.