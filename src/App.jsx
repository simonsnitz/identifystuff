import { useState } from 'react'
import data from './data.json'
import CodonsQuestionPage from './CodonsQuestionPage.jsx'

const TOPIC_KEYS = ['codons', 'trees', 'mushrooms', 'metabolites']

export default function App() {
  const [topic, setTopic] = useState(null)

  if (topic === 'codons') {
    return <CodonsQuestionPage onExit={() => setTopic(null)} />
  }

  return (
    <main className="home">
      <h1>what would you like to learn?</h1>
      <div className="tile-grid">
        {TOPIC_KEYS.map((key) => (
          <button
            key={key}
            className="tile"
            type="button"
            onClick={() => setTopic(key)}
            disabled={key !== 'codons'}
            title={key !== 'codons' ? 'Coming soon' : undefined}
          >
            {data.topics[key].label}
          </button>
        ))}
      </div>
    </main>
  )
}
