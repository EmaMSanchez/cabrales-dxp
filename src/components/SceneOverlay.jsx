function headlineWithEmphasis(headline, highlight) {
  if (!highlight) return headline;
  const start = headline.indexOf(highlight);
  if (start < 0) return headline;
  return <>{headline.slice(0, start)}<strong>{highlight}</strong>{headline.slice(start + highlight.length)}</>;
}

export default function SceneOverlay({ scenes }) {
  return (
    <>
      <div className="coffee-scenes" aria-hidden="true">
        {scenes.map((scene, index) => (
          <div
            className={`coffee-scene coffee-scene--${scene.position} coffee-scene--${scene.theme}${scene.highlight ? ' coffee-scene--emphasized' : ''}${scene.placement === 'above-cup' ? ' coffee-scene--above-cup' : ''}`}
            data-coffee-scene={index}
            key={`${scene.start}-${index}`}
            style={{ opacity: 0 }}
          >
            <p className="coffee-scene__title">{headlineWithEmphasis(scene.headline, scene.highlight)}</p>
            {scene.subheadline && <p className="coffee-scene__subtitle">{scene.subheadline}</p>}
          </div>
        ))}
      </div>
      <div className="visually-hidden">
        <h2>El recorrido, escena por escena</h2>
        <ol>
          {scenes.map((scene, index) => (
            <li key={`${scene.start}-description-${index}`}>
              {scene.headline}. {scene.subheadline}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
