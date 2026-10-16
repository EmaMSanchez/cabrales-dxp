# Storyblok: Story `cabrales` (Space existente, región `eu`)

Ruta pública `/` y vista previa opcional `/cabrales`. No crear `cafe/home` ni duplicar `hero-section` / `scene-item`. En el contenido actual de `cabrales`, `default-page` contiene un `hero-section` con los videos y los textos vacíos; `scenes` y los campos editoriales no vinieron en la respuesta consultada. **Antes de agregarlos en la Block Library compartida, revisar el esquema desde Storyblok y coordinar el cambio, porque afecta a otras Stories del Space.** El frontend admite esos campos aunque aún estén ausentes.

## Campos del mismo `hero-section`

| Campo | Tipo | Uso / valor sugerido |
| --- | --- | --- |
| `scroll_video` | Asset | Subir el MP4 unificado, una sola pieza. Si está vacío: `/videos/cafe-recorrido.mp4`. |
| `scroll_poster_image`, `poster_image` | Asset | Primer fotograma. Prioridad: `scroll_poster_image`, después `poster_image`, después `/images/cafe-poster.webp`. |
| `intro_title` | Text | «Del grano a tu taza». |
| `intro_subtitle` | Textarea | «Una experiencia que comienza con el origen del café». |
| `scroll_hint` | Text | «Deslizá para descubrir». |
| `object_position_desktop`, `object_position_mobile` | Text | Por ejemplo `50% 50%`; encuadre con `object-fit: cover`. |
| `scenes` | Blocks | Bloques `scene-item` existentes; si no hay escenas válidas, se usan 5 locales. Si cargás 3, se muestran **solo 3**. |
| `cta_text`, `cta_link` | Text, Link | Mostrar únicamente si **ambos** tienen contenido y URL válida. No poner enlaces ficticios. |
| `intro_video` | Asset | No se usa: este proyecto no necesita loop ni un segundo video. |

### Propuesta de tiempos iniciales para `scene-item`

Los tiempos se midieron sobre el archivo original de **23,375 s**. Los porcentajes de `start_progress` y `end_progress` son del **tiempo del video**, no del largo del scroll. Se puede ajustar copy y tramos al publicar en Storyblok; el recorrido del video siempre es bidireccional y permanece pausado.

| Fotograma real | Tiempo aprox. | Porcentaje | `headline` provisional | `text_position` |
| --- | --- | --- | --- | --- |
| Paquete frontal | 0–3,5 s | 0–15 | Super Cabrales Espresso | left |
| Apertura, interior y granos | 3,5–6,8 s | 15–29 | Un mundo en su interior | right |
| Grano en macro | 6,8–8,4 s | 29–36 | Cada grano, de cerca | right |
| Transición y taza cenital | 8,4–17 s | 36–72 | Del grano al espresso | left |
| Taza de perfil y paquete | 17–23,375 s | 72–100 | El momento de disfrutar | left |

Campos de cada `scene-item`: `headline`, `subheadline`, `start_progress`, `end_progress`, `text_position` (`left`, `center`, `right`) y `text_theme` (`light` = texto claro; `dark` = placa clara con texto oscuro). No hay escenas adicionales inventadas cuando la lista del CMS tiene menos de cinco entradas válidas. La distancia de scroll da aire al corto momento macro mediante hitos internos medidos en el MP4, sin variar la velocidad del video cuando se detiene el scroll. Si se sustituye el video por **otro montaje**, será necesario volver a medir esos hitos en el código y reajustar las escenas.

## Continuación editorial

`opening_title`/`opening_image`, `detail_title`/`detail_text`/`detail_image`, `closing_title`/`closing_text`/`closing_image` se leen desde **el mismo** `hero-section`. Cada campo presente reemplaza su fallback individual; los vacíos usan textos e imágenes del video (`cafe-granos.webp`, `cafe-macro.webp`, `cafe-final.webp`). Si ni siquiera hay imagen local utilizable, se oculta esa sección. No hay bloque editorial nuevo en `body`. El segmento tipográfico después del video es una invitación conceptual, no una afirmación sobre ingredientes, certificaciones o prestaciones.

## Entornos y Visual Editor

- Local: `.env` con `STORYBLOK_DELIVERY_API_TOKEN` **Preview** y región `eu`. Solo `astro dev` pide `draft`.
- Netlify: variable del sitio `STORYBLOK_DELIVERY_API_TOKEN` con token **Public** (solo contenido publicado), sin compartir ni publicar el token en el navegador. La ruta SSR consulta exclusivamente `cdn/stories/cabrales` con `version: published`.
- Para previsualizar este frontend desde Storyblok, añadir un **entorno de preview específico** con URL de este sitio, o configurar el Real Path de la Story `cabrales` como `/` si corresponde; no sustituir la URL global que utiliza el proyecto del avión. En local, `https://localhost:4321/` permite previsualizar el borrador con el token local.
- Publicar la Story para que Netlify muestre los cambios. Los tokens Delivery leen contenido; editar requiere permisos de la cuenta en Storyblok.

**Sello del envase:** «MAESTROS TOSTADORES» en el plano inicial es correcto según lo confirmado para este proyecto. No hay que modificar el video ni regenerar el póster por ese texto; la experiencia mantiene el material fuente sin alterar etiquetas mediante CSS.
