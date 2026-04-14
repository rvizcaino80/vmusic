# Guidelines para Commits

## Formato

```
tipo: descripcion
```

## Tipos permitidos

| Tipo     | Categoria en Changelog | Uso                                         |
| -------- | ---------------------- | ------------------------------------------- |
| feat     | Nuevas funciones       | Nueva funcionalidad                         |
| fix      | Correcciones           | Bug fixes                                   |
| perf     | Mejoras de rendimiento | Optimizaciones                              |
| refactor | Refactorizacion        | Cambios de codigo sin cambiar funcionalidad |
| docs     | -                      | Documentacion (ignorado)                    |
| chore    | -                      | Tareas de mantenimiento (ignorado)          |
| test     | -                      | Tests (ignorado)                            |
| style    | -                      | Cambios de estilo (ignorado)                |
| build    | -                      | Cambios de build (ignorado)                 |

## Reglas

1. **Idioma**: Escribe TODO en español
2. **Formato**: `tipo: descripcion` (sin mayuscula inicial)
3. **Longitud**: Maximo 70 caracteres en la descripcion
4. **Sin punto final**: No uses punto al final

## Ejemplos correctos

```bash
git commit -m "feat: agregar filtro por artista"
git commit -m "fix: corregir error al cargar archivos MP3"
git commit -m "perf: optimizar carga de la biblioteca"
git commit -m "refactor: simplificar logica del reproductor"
```

## Ejemplos incorrectos

```bash
# Incorrecto - en ingles
git commit -m "feat: add new feature"

# Incorrecto - mayuscula inicial
git commit -m "feat: Agregar funcion"

# Incorrecto - punto final
git commit -m "feat: agregar funcion."

# Incorrecto - sin tipo
git commit -m "agregar funcion"
```

## Configurar plantilla de commit

```bash
git config commit.template .commit-msg-template
```

## Instalar validacion de commits (opcional)

```bash
cp scripts/verify-commit-msg.js .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

## Commits visibles al usuario

Para que un commit aparezca en el changelog que ven los usuarios, debe incluir la flag `[user-facing]`.

### Ejemplos

```bash
# Va al changelog (visible al usuario)
git commit -m "feat: [user-facing] agregar modo oscuro"
git commit -m "fix: [user-facing] corregir error al guardar playlist"

# No va al changelog (tecnico/interno)
git commit -m "refactor: simplificar logica del reproductor"
git commit -m "chore: actualizar dependencias"
git commit -m "fix: corregir ruta del script de release"
```
