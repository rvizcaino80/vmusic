# Guidelines para Commits

## Formato

```
tipo: descripcion
```

## Tipos permitidos

| Tipo     | Uso                                        |
| -------- | ------------------------------------------ |
| feat     | Nueva funcionalidad                        |
| fix      | Corrección de bug                          |
| perf     | Mejora de rendimiento                      |
| refactor | Cambio de código sin cambiar funcionalidad |
| docs     | Documentación                              |
| chore    | Tareas de mantenimiento                    |
| test     | Tests                                      |
| style    | Cambios de estilo                          |
| build    | Cambios de build                           |

## Reglas

1. **Idioma**: Escribe en español
2. **Formato**: `tipo: descripcion`
3. **Longitud**: Máximo 70 caracteres
4. **Sin punto final**
5. **User-facing**: Agrega `[user-facing]` al inicio de la descripción si el cambio debe aparecer en el changelog para los usuarios

## Etiqueta [user-facing]

Usa `[user-facing]` **SOLO** para commits que incluyan cambios que el usuario final puede ver, tocar o percibir directamente en la interfaz o comportamiento de la aplicación.

### Criterios estrictos para usar [user-facing]:

| ✅ SÍ usar `[user-facing]`                                          | ❌ NO usar `[user-facing]`                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Nuevas funcionalidades visibles (botones, paneles, columnas, menús) | Cambios internos de código (refactors, optimizaciones)           |
| Correcciones de bugs que el usuario experimentaba                   | Fixes de bugs técnicos que no afectan la experiencia del usuario |
| Mejoras de UI/UX (nuevos diseños, animaciones, layouts)             | Cambios en scripts de build o CI/CD                              |
| Nuevas opciones de configuración                                    | Actualización de dependencias o librerías                        |
| Cambios en comportamiento de la app                                 | Cambios en documentación interna                                 |
| Correcciones de errores visibles                                    | Cambios en tests o cobertura                                     |

### Ejemplos correctos:

Los mensajes deben describir **qué cambia para el usuario**, no la implementación técnica:

```bash
# ✅ Nuevas funcionalidades visibles (descripción orientada al usuario)
git commit -m "feat: [user-facing] ver contador de reproducciones de cada canción en la biblioteca"
git commit -m "feat: [user-facing] las canciones con menos reproducciones suenan primero en modo aleatorio"
git commit -m "feat: [user-facing] nueva columna para ver cuántas veces se ha reproducido cada canción"
git commit -m "feat: [user-facing] agregar panel de estadísticas de uso"
git commit -m "feat: [user-facing] nuevo modo de visualización para el público"

# ✅ Correcciones de bugs que el usuario veía
git commit -m "fix: [user-facing] corregir error que impedía reproducir archivos MP3"
git commit -m "fix: [user-facing] reparar cierre inesperado al cargar playlist"
git commit -m "fix: [user-facing] el CD ahora gira en la dirección correcta (como un disco real)"
```

### Regla para mensajes user-facing:

| ✅ Correcto (orientado al usuario)                | ❌ Incorrecto (orientado al técnico)           |
| ------------------------------------------------- | ---------------------------------------------- |
| "Ver contador de reproducciones en la biblioteca" | "Agregar campo playCount al modelo Song"       |
| "Las canciones menos reproducidas suenan primero" | "Ordenar playlist aleatorio por playCount ASC" |
| "Corregir dirección de rotación del CD"           | "Cambiar rotate(360deg) a rotate(-360deg)"     |
| "Nuevo botón para importar MP3"                   | "Crear componente AddMp3.vue"                  |

> **Regla:** El mensaje debe responder a "¿Qué nuevo puede hacer el usuario ahora?" o "¿Qué problema se solucionó para el usuario?"

### Ejemplos incorrectos (NO usar `[user-facing]`):

```bash
# ❌ Cambios internos - sin user-facing
git commit -m "feat: actualizar script release para usar etiqueta user-facing"
git commit -m "feat: refactor interno del reproductor"
git commit -m "refactor: simplificar lógica de filtrado"
git commit -m "chore: actualizar dependencias de desarrollo"
git commit -m "test: agregar tests para el player"
git commit -m "build: optimizar configuración de vite"
git commit -m "docs: actualizar comentarios en el código"
```

### Regla de oro:

> **Si el usuario no puede verlo, tocarlo o notarlo al usar la app, NO lleva `[user-facing]`**

## Ejemplos

```bash
git commit -m "feat: agregar filtro por artista"
git commit -m "fix: corregir error al cargar archivos MP3"
git commit -m "refactor: simplificar logica del reproductor"
```

## Changelog

El changelog se actualiza **automáticamente** desde los commits al ejecutar `npm run release`.

**Solo se incluyen commits con `[user-facing]`** en el changelog.

Cuando ejecutes `npm run release`, el script automáticamente genera el changelog a partir de los commits marcados con `[user-facing]`.

### Ejemplos de descripciones para usuarios:

| ✅ Correcto (usuario)                          | ❌ Incorrecto (técnico)            |
| ---------------------------------------------- | ---------------------------------- |
| "Panel para importar archivos MP3 manualmente" | "Agregar componente AddMp3.vue"    |
| "Nuevo panel para ver registro de cambios"     | "Implementar sistema de changelog" |
| "Corrección de error al reproducir"            | "Fix bug en player.js"             |

### Proceso de release:

1. Hacer commits con el formato correcto
2. Ejecutar `npm run release [patch|minor|major]`
3. El script genera el changelog automáticamente desde los commits `[user-facing]`
4. Presionar ENTER para continuar
5. El script hará build y publish automáticamente

## Push y Release

**NO** hagas push ni release automáticamente. Solo ejecuta estos comandos cuando el usuario lo indique explícitamente.

### Regla:

- ✅ Esperar instrucción explícita: "haz push", "haz release", "publica", etc.
- ❌ NO hacer push/release automático después de commits

### Estructura del changelog.json:

```json
{
  "versions": [
    {
      "version": "1.2.0",
      "date": "2026-04-14",
      "changes": {
        "new": ["Descripción para el usuario"],
        "fix": ["Descripción de corrección"]
      }
    }
  ]
}
```
