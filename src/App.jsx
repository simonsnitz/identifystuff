import { useState } from 'react'
import data from './data.json'
import CodonsQuestionPage from './CodonsQuestionPage.jsx'
import TreesQuestionPage from './TreesQuestionPage.jsx'

const TOPIC_KEYS = ['codons', 'trees', 'mushrooms', 'metabolites']
const ENABLED = new Set(['codons', 'trees'])

export default function App() {
  const [topic, setTopic] = useState(null)

  if (topic === 'codons') {
    return <CodonsQuestionPage onExit={() => setTopic(null)} />
  }
  if (topic === 'trees') {
    return <TreesQuestionPage onExit={() => setTopic(null)} />
  }

  return (
    <main className="home">
      <h1>what would you like to learn?</h1>
      <div className="tile-grid">
        {TOPIC_KEYS.map((key) => {
          const enabled = ENABLED.has(key)
          return (
            <button
              key={key}
              className="tile"
              type="button"
              onClick={() => setTopic(key)}
              disabled={!enabled}
              title={!enabled ? 'Coming soon' : undefined}
            >
              {data.topics[key].label}
            </button>
          )
        })}
      </div>
    </main>
  )
}
