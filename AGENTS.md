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

Usa `[user-facing]` para commits que incluyan cambios visibles para el usuario final (nuevas funcionalidades, mejoras significativas, correcciones importantes).

### Ejemplos:

```bash
git commit -m "feat: [user-facing] agregar contador de reproducciones a canciones"
git commit -m "fix: [user-facing] corregir error al reproducir archivos MP3"
git commit -m "feat: agregar refactor interno del reproductor"  # Sin user-facing
git commit -m "chore: actualizar dependencias de desarrollo"      # Sin user-facing
```

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
