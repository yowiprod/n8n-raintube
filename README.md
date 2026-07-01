# RainTube — Automatización de YouTube (YOWIPROD)

Sistema de automatización para publicar vídeos de relajación de 8 horas (sonidos de lluvia y agua en lugares exóticos) en YouTube, con generación automática de Shorts.

## Qué hace

- **Descarga** audio de 8 horas desde un catálogo de podcast (acast).
- **Genera** el vídeo con FFmpeg: pantalla negra 1920×1080 + audio, 8 horas.
- **Publica** en YouTube vía API (OAuth2) con SEO optimizado (título, descripción, tags ES/EN).
- **Crea Shorts** verticales de 3 minutos (1080×1920) con fade de audio, a partir del mismo material.

Todo orquestado con **n8n** (workflows con webhooks) en local (Windows 10).

## Convención de títulos

`[Lluvia/Agua] + [Lugar exótico] + 8 Horas + [emoji] + Dormir, Estudiar y Relajarse`

A partir del EP27 los títulos pasan a inglés: `Rain in [Place] 8 Hours [emoji] Sleep, Study and Relax`.

Solo lugares con temática de **lluvia o agua** (nada de "ventilador" ni "ruido blanco" en el título).

## Estructura

| Ruta | Contenido |
|------|-----------|
| `config/seo-ep*.json` | SEO de cada episodio (título, descripción, tags ES/EN, texto de thumbnail) |
| `config/acast-catalog.json` | Catálogo de audios fuente (103 episodios) |
| `config/rutas.json` | Rutas del proyecto |
| `config/add-ep*.py` | Scripts para añadir un episodio a los workflows de n8n |
| `config/*.js` | Scripts históricos de ajuste de workflows |
| `config/wf*_current.json` | Snapshots de los workflows de n8n |
| `logs/*.json` | Historial de vídeos y shorts publicados |

## Workflows n8n

- **Publicar Vídeo YouTube** (`webhook: raintube`) — flujo de vídeo de 8 h.
- **Crear y Subir Shorts** (`webhook: raintube-shorts`) — genera y sube shorts.

Se disparan con `POST` al webhook: `{"episodio": N}` o `{"episodio": N, "short": 1|2}`.

## Configuración local (claves)

Las claves API **no** están en el repositorio. Se cargan desde un archivo `.env` local (excluido en `.gitignore`):

```
N8N_API_KEY=...
PEXELS=...
PIXABAY=...
FREESOUND_API_KEY=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
```

Los scripts leen `N8N_API_KEY` de la variable de entorno. Para ejecutarlos:

```bash
# Windows (cmd)
set N8N_API_KEY=tu_clave
python config/add-epN.py

# Git Bash
export N8N_API_KEY=tu_clave
python config/add-epN.py
```

## Notas técnicas

- FFmpeg debe ejecutarse con `spawn()` (no `execSync`) en los nodos Code de n8n para no bloquear el heartbeat del runner.
- Los nodos Code deben usar `console.log()` (no `process.stdout.write()`, que crashea el sandbox).
- El OAuth de YouTube (app en modo testing) expira cada ~7 días; hay que reconectar la credencial en n8n.
- Los nodos de descarga y FFmpeg tienen lógica *skip-if-exists*: si el archivo ya existe, se omite el paso (permite reintentar uploads sin re-renderizar).
