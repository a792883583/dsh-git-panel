# dsh-git-panel

[中文](README.md) · [English](README.en.md)

Un plugin de panel de Git para la GUI web de DSH: gestión de ramas (cambiar / traer cambios / obtener / renombrar / eliminar / fusionar) más un gráfico de commits estilo GitLens.

## Características

- **Panel de ramas** (lado derecho del chat):
  - Ramas locales: rama actual resaltada, `↑adelante / ↓detrás` respecto a la rama remota, **doble clic para cambiar** (doble clic en la rama actual para traer cambios)
  - Ramas remotas: **doble clic para cambiar a** (crea automáticamente una rama de seguimiento local)
  - Menú contextual: **renombrar / eliminar / fusionar en la rama actual** (las ramas remotas ofrecen eliminar rama remota)
  - **Traer cambios** de la rama actual con un clic, **obtener todo** (`git fetch --all --prune`)
- **Chip de rama** (encima del cuadro de entrada): muestra la rama actual; haz clic para abrir la lista de ramas locales y cambiar rápidamente
- **Gráfico de Git**: carriles del DAG de commits, encabezado de tres columnas (Carriles / Commit / Rama); la columna de commits se puede redimensionar desde ambos lados (ancho persistente); haz clic en un nodo para ver los detalles del commit; renderizado virtualizado — solo se dibuja el área visible, por lo que los repositorios grandes se desplazan con fluidez
- **Multilingüe**: sigue el idioma de la interfaz web de DSH (chino / inglés); los navegadores en español reciben automáticamente el texto en español; por defecto chino simplificado
- Sigue el directorio de trabajo de la sesión actual: se reenlaza automáticamente al cambiar de sesión de proyecto
- Tema claro / oscuro siguiendo la GUI web de DSH

## Instalación

```sh
# Desarrollo local / antes de la publicación en npm
dsh plugin --profile web add link:/path/to/dsh-git-panel

# Después de publicar en npm
dsh plugin --profile web add dsh-git-panel
```

Reinicia `dsh web`, abre una sesión de proyecto vinculada a un repositorio git y el panel de Git aparece en el lado derecho del chat.

## Desarrollo

```sh
npm install
npm run typecheck     # tsc --noEmit
npm run build         # esbuild → lib/index.js (host) + lib/client.js (browser)
npm test              # scripts/test-e2e.sh: pruebas de extremo a extremo en un repo temporal
```

### Arquitectura

- **Mitad host** (`src/index.ts` / `src/host/`): guardia de workspace + `ctx.subprocess` ejecutando comandos git reales, expuestos como rutas JSON `/git-panel/*` a través de `ctx.webServer.register`. Límite de seguridad: git solo se ejecuta dentro de raíces de workspace registradas.
- **Mitad navegador** (`src/client/`): localiza la cuadrícula del frame del shell a través del padre de `[class*="sidebarCol"]` (o `[data-dsh-frame]`), añade la columna derecha y sincroniza los tracks de la cuadrícula; React renderiza la lista de ramas y el gráfico; `i18n.ts` mantiene el texto en zh / en / es y cambia automáticamente con los idiomas de la plataforma y del navegador.
- La salida de build sigue la convención de fábrica de cierre `window.__ModuleLoader__.load({ id, factory })`; los módulos externos (react / módulos de plataforma @deepseek-ai) provienen de la tabla de módulos del cargador.

### Rutas

| Ruta | Método | Descripción |
|---|---|---|
| `/git-panel/branches` | POST | Vista de ramas (actual / locales / remotas + adelante / detrás) |
| `/git-panel/graph` | POST | DAG de commits + mapeo de puntas de rama |
| `/git-panel/switch` | POST | Cambiar de rama (las remotas crean rama de seguimiento local) |
| `/git-panel/pull` | POST | Traer cambios de la rama actual |
| `/git-panel/fetch` | POST | Obtener todos los remotos (prune) |
| `/git-panel/rename` | POST | Renombrar una rama |
| `/git-panel/delete` | POST | Eliminar una rama local |
| `/git-panel/delete-remote` | POST | Eliminar una rama remota |
| `/git-panel/merge` | POST | Fusionar una rama en la rama actual |

## Licencia

MIT
