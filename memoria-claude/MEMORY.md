# RainTube - Proyecto de Automatizacion YouTube

## Estado
- FASE 0: Completada (Node.js v25.6.1, npm v11.9.0, n8n v2.10.4, FFmpeg v8.0.1)
- FASE 1: En progreso (usuario creando cuentas API)
- Workflows creados: 4 JSONs en E:\RainTube\config\

## Rutas Criticas
- FFmpeg: C:\Users\Jowy\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe
- n8n data: C:\RainTube\n8n-data\
- Material: E:\RainTube\ (downloads, processing, output, thumbnails, logs, config)
- Start script: C:\RainTube\n8n-data\start-n8n.bat
- Workflows JSON: E:\RainTube\config\workflow-*.json

## Workflows Creados
1. workflow-1-obtener-material.json - Claude genera tema + Pexels/Pixabay buscan videos + Freesound audio
2. workflow-2-procesar-video.json - FFmpeg concat + loop video/audio + render final
3. workflow-3-metadata-thumbnail.json - Claude SEO metadata + FFmpeg thumbnail
4. workflow-4-publicar-youtube.json - YouTube upload + thumbnail + log

## APIs Necesarias
- Pexels: API Key (header Authorization)
- Pixabay: API Key (query param)
- Freesound: API Key (query param token)
- Anthropic: API Key (header x-api-key)
- YouTube: OAuth 2.0 access token

## Preferencias del Usuario
- Principiante en automatizacion
- Windows 10, no usa Docker
- Tiene Canva Pro
- Disco E: para archivos grandes (446 GB libres)
- Comunicacion en espanol
