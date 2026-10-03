# Configuración Global de Jowy

## Idioma
- Siempre responder en español

## Quién es el usuario
- **Nombre**: Jowy (marca: YOWIPROD)
- **Canal YouTube**: @YOWIPROD (1 canal)
- **Nivel**: Principiante en automatización, aprendiendo activamente
- **SO**: Windows 10 Home (sin Docker)
- **Herramientas**: n8n v2.10.4, Node.js v25.6.1, FFmpeg v8.0.1, Python 3.12.10, Canva Pro
- **Adobe CC**: Premiere Pro 2025 v25.6.4, After Effects 2025, Media Encoder 2025, Photoshop 2025

## Cómo comunicarse con Jowy
- Usa lenguaje simple y claro, evita jerga técnica sin explicarla
- Cuando expliques código, describe el "por qué" no solo el "qué"
- Da ejemplos concretos, preferentemente con sus archivos y rutas reales
- Si hay varias opciones, recomienda la más simple primero

## Rutas principales
| Recurso | Ruta |
|---------|------|
| Espacio de trabajo | `C:\Users\Jowy\Claude y me\` |
| Material videos | `E:\RainTube\` |
| n8n data | `C:\RainTube\n8n-data\` |
| adb-mcp (Premiere) | `C:\Users\Jowy\adb-mcp\` |
| After Effects MCP | `C:\Users\Jowy\after-effects-mcp\` |

## Suite de Video YOWIPROD — Estado actual

### Conexión Adobe MCP — FUNCIONAL
- **Premiere Pro**: via UXP plugin + proxy WebSocket (adb-mcp) ✅
- **After Effects**: via bridge JSX (after-effects-mcp) ✅
- Ver memoria `project_premiere_connection.md` para pasos de arranque

### Estrategia: MCP + Computer Use
- **MCP** (80%): crear proyecto, importar, timeline, efectos, transiciones, exportar
- **Computer Use** (20%): funciones IA de Adobe (Speech-to-Text, Auto Reframe, Enhance Speech, Scene Edit Detection, Generative Extend)
- Computer Use via `mcp__Claude_in_Chrome__computer`

### Próximo paso pendiente
**Probar flujo completo con video real**: crear proyecto → importar → editar → exportar via MCP
Después: probar Computer Use para IA de Premiere Pro

### Skills disponibles
`/edit-video` `/batch-video` `/auto-subs` `/scene-split` `/thumb-gen` `/video-preview` `/brand-kit` `/video-publish` `/video-export` `/ayuda-ffmpeg` `/generar-seo`
