export default function SceneOverlay({ scenes }) {
  return (
    <>
      <div className="coffee-scenes" aria-hidden="true">
        {scenes.map((scene, index) => (
          <div
            className={`coffee-scene coffee-scene--${scene.position} coffee-scene--${scene.theme}`}
            data-coffee-scene={index}
            key={`${scene.start}-${index}`}
            style={{ opacity: 0 }}
          >
            <span className="coffee-scene__number">{String(index + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</span>
            <p className="coffee-scene__title">{scene.headline}</p>
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
