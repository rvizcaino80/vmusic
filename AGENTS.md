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

## Ejemplos

```bash
git commit -m "feat: agregar filtro por artista"
git commit -m "fix: corregir error al cargar archivos MP3"
git commit -m "refactor: simplificar logica del reproductor"
```

## Changelog

El changelog se edita **MANUALMENTE** antes de cada release.

Cuando ejecutes `npm run release`, el script te pedirá que edites `src/renderer/public/changelog.json` y agregues una descripción en lenguaje para usuarios, no técnico.

### Ejemplos de descripciones para usuarios:

| ✅ Correcto (usuario)                          | ❌ Incorrecto (técnico)            |
| ---------------------------------------------- | ---------------------------------- |
| "Panel para importar archivos MP3 manualmente" | "Agregar componente AddMp3.vue"    |
| "Nuevo panel para ver registro de cambios"     | "Implementar sistema de changelog" |
| "Corrección de error al reproducir"            | "Fix bug en player.js"             |

### Proceso de release:

1. Hacer commits con el formato correcto
2. Ejecutar `npm run release [patch|minor|major]`
3. Editar `changelog.json` manualmente con descripciones para usuarios
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
