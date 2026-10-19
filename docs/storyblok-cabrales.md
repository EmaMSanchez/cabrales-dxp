# Storyblok: Story `cabrales` (Space existente, región `eu`)

Ruta pública `/` y vista previa opcional `/cabrales`. No crear `cafe/home` ni duplicar `hero-section` / `scene-item`. En el contenido actual de `cabrales`, `default-page` contiene un `hero-section` con los videos y los textos vacíos; `scenes` y los campos editoriales no vinieron en la respuesta consultada. **Antes de agregarlos en la Block Library compartida, revisar el esquema desde Storyblok y coordinar el cambio, porque afecta a otras Stories del Space.** El frontend admite esos campos aunque aún estén ausentes.

## Campos del mismo `hero-section`

| Campo | Tipo | Uso / valor sugerido |
| --- | --- | --- |
| `scroll_video` | Asset | Subir el MP4 unificado, una sola pieza. Si está vacío: `/videos/cafe-recorrido.mp4`. |
| `scroll_poster_image`, `poster_image` | Asset | Póster del recorrido de scroll. Prioridad: `scroll_poster_image`, después `poster_image`, después `/images/cafe-poster.webp`. El póster local del loop es independiente: `/images/cafe-loop-poster.webp`. |
| `intro_title` | Text | «Del grano a tu taza», título compartido por el loop y el inicio del recorrido. |
| `intro_subtitle` | Textarea | «Una experiencia que comienza con el origen del café». Se ve debajo del título desde el loop y permanece al iniciar el tramo de scroll. |
| `scroll_hint` | Text | «Deslizá para descubrir», indicador presente desde el loop. |
| `credit_text` | Text | Crédito compartido por el loop/recorrido y el footer. Si falta o está vacío: «by 1810». El frontend ya lo admite, pero **no se creó todavía** en el esquema compartido; coordinar antes de agregarlo al `hero-section`. |
| `object_position_desktop`, `object_position_mobile` | Text | Por ejemplo `50% 50%`; encuadre con `object-fit: cover`. |
| `scenes` | Blocks | Bloques `scene-item` existentes; si no hay escenas válidas, se usan 5 locales. Si cargás 3, se muestran **solo 3**. |
| `cta_text`, `cta_link` | Text, Link | La CTA editorial requiere ambos. El botón «Comprar» del header usa `cta_link` si tiene URL válida aunque `cta_text` esté vacío; sin enlace, queda visible pero deshabilitado. No poner enlaces ficticios. |
| `intro_video` | Asset | Video ambiental del inicio del escenario, en loop. Si está vacío: `/videos/cafe-loop.mp4`. No afecta a `scroll_video`. |

## Escenario integrado: loop y recorrido

El loop y el recorrido comparten **un mismo escenario fijo**: el loop ocupa la posición inicial y el primer desplazamiento activa el video de `scroll_video`, con una transición ligada a los primeros 180 px de scroll (hasta el 25 % de la altura visible en pantallas bajas). Al volver arriba, el video de scroll retrocede a su inicio y el loop vuelve a reproducirse. No hay una pantalla completa intermedia, CTA superpuesto ni controles de video. Se puede seguir hacia `#historia` desplazándose normalmente incluso sin JavaScript.

Los originales anteriores y nuevos se conservan **sin modificar** en `media/originals/`. El loop actual proviene de `Cabrales_loop_paquete_corregido.mp4` (1,96 s): el fallback `/videos/cafe-loop.mp4` comienza en el segundo 0,5 y contiene dos ciclos de 1,46 s en un solo MP4 (2,92 s). En cada ciclo se funden los últimos 11 fotogramas (≈0,46 s) hacia el inicio para suavizar ambas uniones; el reproductor solo reinicia al terminar los dos ciclos. `/images/cafe-loop-poster.webp` representa el primer fotograma **del fallback nuevo**. El recorrido web `/videos/cafe-recorrido.mp4` es una derivación optimizada de `media/originals/VideoFinal.mp4`: H.264 High/yuv420p, 1280×720, 24 fps, 561 fotogramas en 23,375 s, sin audio, fotogramas clave cada 12 cuadros y faststart. Se codificó con libx264 `-preset slow -crf 22 -g 12 -keyint_min 12 -sc_threshold 0 -movflags +faststart`; pesa 7,9 MB en vez de los 16,3 MB del original intacto, con SSIM 0,991 y el mismo montaje. Su póster `/images/cafe-poster.webp` se extrajo del original. Si `intro_video`, `scroll_video` o los pósters están cargados en Storyblok, tienen prioridad y se reproducen como fueron publicados: estas derivaciones son **solo** los fallbacks locales. Con movimiento reducido, ahorro de datos o sin JavaScript se muestra el póster y la continuación editorial sin cargar ninguno de los videos; al ocultar la pestaña se pausa el loop.

El loop muestra «Una experiencia en movimiento», `intro_title` («Del grano a tu taza» si está vacío), `intro_subtitle` («Una experiencia que comienza con el origen del café»), `scroll_hint` («Deslizá para descubrir») y `credit_text` («by 1810» si está vacío). Son los **mismos elementos** que permanecen durante la transición inicial, sin repetir el título. El indicador y el crédito comparten una sola línea también en móvil. El título, subtítulo, indicador y crédito dan prioridad a Storyblok; la ceja es local. **No** se alteró la Block Library compartida.

El header transparente usa el logo blanco recibido `public/images/cabrales-logo-blanco.png`, sin placa clara y con una sombra leve para asegurar contraste sobre el video. La palabra «Cabrales» concentra más peso visual que la taza; por eso el logo tiene una compensación vertical adaptada a escritorio, móvil y pantallas bajas para centrar **su dibujo** frente a la navegación o al botón «Menú», sin mover esos controles. El logo marrón anterior y su fuente recibida permanecen intactos; el favicon PNG/ICO y el icono táctil siguen usando la taza de esa versión marrón. «Inicio» va a `#inicio` y «Sobre nosotros» a `#historia`, la continuación conceptual; no hay una página corporativa adicional. El header se ve en el loop y se oculta desde el primer desplazamiento por el video. La sección que comienza con la ceja amarilla «Después del último fotograma» es el límite editorial: cuando ya no queda video en pantalla, allí y en lo que sigue solo reaparece al subir y se oculta al bajar. Al volver al tramo de video se oculta; al llegar al inicio se muestra. En móvil usa un menú nativo y, sin JavaScript, los enlaces permanecen disponibles. Todo proviene de la única Story `cabrales` y fallbacks locales; no se agregan campos al esquema compartido.

## Propuesta de tiempos iniciales para `scene-item`

Los hitos originales se verificaron frente a `VideoFinal.mp4`: mantiene el mismo montaje de **23,375 s** y las ventanas del paquete, granos, macro, taza y cierre. Los porcentajes de `start_progress` y `end_progress` son del **tiempo del video**, no del largo del scroll. Se puede ajustar copy y tramos al publicar en Storyblok; el recorrido del video siempre es bidireccional y permanece pausado.

| Fotograma real | Tiempo aprox. | Porcentaje | `headline` provisional | `text_position` |
| --- | --- | --- | --- | --- |
| Paquete frontal | 0–3,5 s | 0–15 | Super Cabrales Espresso | left |
| Apertura, interior y granos | 3,5–6,8 s | 15–29 | Un mundo en su interior | right |
| Grano en macro | 6,8–8,4 s | 29–36 | Cada grano, de cerca | right |
| Transición y taza cenital | 8,4–17 s | 36–72 | Del grano al espresso | left |
| Taza de perfil y paquete | 17–23,375 s | 72–100 | El momento de disfrutar | left |

Campos de cada `scene-item`: `headline`, `subheadline`, `start_progress`, `end_progress`, `text_position` (`left`, `center`, `right`) y `text_theme` (`light` = texto claro; `dark` = placa clara con texto oscuro). No hay escenas adicionales inventadas cuando la lista del CMS tiene menos de cinco entradas válidas. La distancia de scroll da aire al corto momento macro mediante hitos internos medidos en el MP4, sin variar la velocidad del video cuando se detiene el scroll. Si se sustituye el video por **otro montaje**, será necesario volver a medir esos hitos en el código y reajustar las escenas.

Los cinco textos locales usan subtítulos breves y destacan una expresión clave por titular con peso tipográfico, sin interpretar HTML de Storyblok. El último, «El momento de disfrutar», se sitúa sobre el espacio libre **por encima de la taza** con ajustes para portátil, móvil y pantallas bajas; no modifica la posición de las otras escenas. Si hay `scene-item` válidos en el CMS, sus textos y posiciones tienen prioridad y no se les impone este énfasis o desplazamiento local.

## Continuación editorial

`opening_title`/`opening_image`, `detail_title`/`detail_text`/`detail_image`, `closing_title`/`closing_text`/`closing_image` se leen desde **el mismo** `hero-section`. Cada campo presente reemplaza su fallback individual; los vacíos usan textos e imágenes del video (`cafe-granos.webp`, `cafe-grano-detalle.webp`, `cafe-final.webp`). Las imágenes de apertura y cierre se renovaron desde `VideoFinal.mp4` para no mostrar el paquete anterior; el primer plano del grano sigue siendo el fotograma enfocado de ≈7,95 s del original previo `Super_Cabrales_scroll_GSAP.mp4`, sin envase visible. `detail_image` de Storyblok conserva la prioridad. Si ni siquiera hay imagen local utilizable, se oculta esa sección. No hay bloque editorial nuevo en `body`. El segmento tipográfico después del video es una invitación conceptual, no una afirmación sobre ingredientes, certificaciones o prestaciones.

El título de «Cada detalle cuenta» comparte el encendido progresivo por palabras de «Cada plano nos acerca al café…» sin desplazar ni borrar esa primera frase; si Storyblok publica otro `detail_title`, el efecto se aplica a ese texto. Con movimiento reducido o sin JavaScript, ambos títulos se leen completos y sin animación. El footer usa a la izquierda el mismo logo **blanco sobre fondo transparente** del header, sin placa clara y enlazado al inicio; a la derecha hay un bloque con el crédito `credit_text` y, debajo, una copia intacta del `WHITE-LOGO.svg` recibido (`public/images/1810-white-logo.svg`), alineado verticalmente con el logo Cabrales también en móvil. El SVG se carga como imagen externa local, no se inserta código SVG en la página. Un único valor de `credit_text` actualiza los dos créditos (video y footer), sin nuevas consultas al CMS; la página 404 conserva el fallback «by 1810». Se retiraron las dos frases anteriores y el enlace de retorno redundante. La descripción conceptual y `noindex, nofollow` de los metadatos permanecen intactos.

## Entornos y Visual Editor

- Local: `.env` con `STORYBLOK_DELIVERY_API_TOKEN` **Preview** y región `eu`. Solo `astro dev` pide `draft`.
- Netlify: variable del sitio `STORYBLOK_DELIVERY_API_TOKEN` con token **Public** (solo contenido publicado), sin compartir ni publicar el token en el navegador. La ruta SSR consulta exclusivamente `cdn/stories/cabrales` con `version: published`.
- Para previsualizar este frontend desde Storyblok, añadir un **entorno de preview específico** con URL de este sitio, o configurar el Real Path de la Story `cabrales` como `/` si corresponde; no sustituir la URL global que utiliza el proyecto del avión. En local, `https://localhost:4321/` permite previsualizar el borrador con el token local.
- Publicar la Story para que Netlify muestre los cambios. Los tokens Delivery leen contenido; editar requiere permisos de la cuenta en Storyblok.

**Sello del envase:** «MAESTROS TOSTADORES» en el plano inicial es correcto según lo confirmado para este proyecto. No hay que modificar el video ni regenerar el póster por ese texto; la experiencia mantiene el material fuente sin alterar etiquetas mediante CSS.
