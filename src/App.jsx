import data from './data.json'

const TOPIC_KEYS = ['codons', 'trees', 'mushrooms', 'metabolites']

export default function App() {
  return (
    <main className="home">
      <h1>what would you like to learn?</h1>
      <div className="tile-grid">
        {TOPIC_KEYS.map((key) => (
          <button key={key} className="tile" type="button">
            {data.topics[key].label}
          </button>
        ))}
      </div>
    </main>
  )
}
