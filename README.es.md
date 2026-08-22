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
- **Barra de escritura** (parte superior del panel, bajo las pestañas):
  - **Confirmar (commit)**: escriba un mensaje y pulse Enter → `git add -A && git commit -m`
  - **Empujar (push)**: `git push` de la rama actual con un clic
  - **Guardar / recuperar (stash)**: `git stash push` (mensaje opcional) / `git stash pop`
  - **Estado**: muestra el número de archivos modificados (`git status --porcelain`)
- **Cambios + diff**: los archivos modificados sin confirmar se listan bajo la barra de escritura (código de estado + ruta); haga clic en un archivo para ver su diff completo contra HEAD — eche un vistazo antes de confirmar
- **Acciones sobre commits del gráfico**: haga clic en un nodo de commit del gráfico para **cherry-pick a la rama actual** o **revertirlo** (`git revert --no-edit`)
- **Multilingüe**: sigue el idioma de la interfaz web de DSH (chino / inglés); los navegadores en español reciben automáticamente el texto en español; por defecto chino simplificado
- Sigue el directorio de trabajo de la sesión actual: se reenlaza automáticamente al cambiar de sesión de proyecto
- Tema claro / oscuro siguiendo la GUI web de DSH

## Capturas de pantalla

**Panel de ramas** (ramas locales/remotas, adelante/detrás, doble clic para cambiar, menú contextual):

![Panel de ramas](docs/branches.png)

**Chip de rama** (cambio rápido de rama encima del cuadro de entrada):

![Chip de rama](docs/chip.png)

**Gráfico de commits** (columnas redimensionables, scroll virtualizado):

![Gráfico de commits](docs/graph.png)

## Instalación

```sh
dsh plugin --profile web add dsh-git-panel
```

Reinicia `dsh web`, abre una sesión de proyecto vinculada a un repositorio git y el panel de Git aparece en el lado derecho del chat.

> Para desarrollo local, instala mediante un enlace: `dsh plugin --profile web add link:/path/to/dsh-git-panel`. Tras editar el código, ejecuta `npm run build` y actualiza la página para ver los cambios.

## Licencia

MIT
