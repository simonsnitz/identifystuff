import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import data from './data.json'

const NEXT_QUESTION_DELAY_MS = 350
const FLASH_MS = 300
// Avoid repeating any of the last N tree species back-to-back.
const RECENT_LIMIT = 3

function shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pickN(arr, n) {
  return shuffle(arr).slice(0, n)
}

function TreeImages({ tree }) {
  return (
    <div className="tree-images" title={tree.name}>
      <img
        className="tree-image tree-leaf"
        src={`/trees/${tree.slug}.jpg`}
        alt={`${tree.name} leaf`}
      />
      <img
        className="tree-image tree-bark"
        src={`/trees/${tree.slug}-bark.jpg`}
        alt={`${tree.name} bark`}
      />
    </div>
  )
}

function renderItem(tree, kind) {
  if (kind === 'tree-image') return <TreeImages tree={tree} />
  if (kind === 'tree-name') return <span>{tree.name}</span>
  return null
}

export default function TreesQuestionPage({ onExit }) {
  const topic = data.topics.trees
  const species = useMemo(() => topic.species, [topic.species])

  // reverse=false: leaf image → name (default). reverse=true: name → leaf image.
  const [reverse, setReverse] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [question, setQuestion] = useState(null)
  const [selected, setSelected] = useState(0)
  const [verdict, setVerdict] = useState(null)

  const questionKind = reverse ? 'tree-name' : 'tree-image'
  const answerKind = reverse ? 'tree-image' : 'tree-name'

  const recentRef = useRef([])

  const generateQuestion = useCallback(() => {
    if (species.length < 4) return null
    // Re-roll up to a few times if we'd repeat a recent species.
    let correct
    for (let attempt = 0; attempt < 12; attempt++) {
      correct = species[Math.floor(Math.random() * species.length)]
      if (!recentRef.current.includes(correct.slug)) break
    }
    recentRef.current = [correct.slug, ...recentRef.current].slice(0, RECENT_LIMIT)

    const distractors = pickN(
      species.filter((s) => s.slug !== correct.slug),
      3,
    )
    const options = shuffle([correct, ...distractors])
    const correctIndex = options.findIndex((s) => s.slug === correct.slug)
    return { questionKind, answerKind, questionItem: correct, options, correctIndex }
  }, [species, questionKind, answerKind])

  const newQuestion = useCallback(() => {
    setQuestion(generateQuestion())
    setSelected(0)
    setVerdict(null)
  }, [generateQuestion])

  useEffect(() => {
    newQuestion()
  }, [newQuestion])

  const submit = useCallback(
    (idx) => {
      if (!question || verdict) return
      const choice = idx ?? selected
      const correct = choice === question.correctIndex
      setVerdict({ index: choice, correct })
      if (correct) {
        setTimeout(newQuestion, NEXT_QUESTION_DELAY_MS)
      } else {
        setTimeout(() => setVerdict(null), FLASH_MS)
      }
    },
    [question, selected, verdict, newQuestion],
  )

  useEffect(() => {
    function onKey(e) {
      if (!question) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        setSelected((s) => (s % 2 === 0 ? s + 1 : s - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => (s + 2) % 4)
      } else if (e.key === 'Enter' || e.key === 'Shift') {
        e.preventDefault()
        submit()
      } else if (e.key === 'Escape') {
        if (sidebarOpen) setSidebarOpen(false)
        else onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, submit, onExit, sidebarOpen])

  const promptText = reverse
    ? 'Which images match this tree?'
    : 'Which tree do these images belong to?'

  return (
    <div className={`quiz-layout${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="sidebar-toggle"
        aria-label={sidebarOpen ? 'Close preferences' : 'Open preferences'}
        onClick={() => setSidebarOpen((v) => !v)}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <div
        className="sidebar-backdrop"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className="sidebar">
        <button className="back-link" type="button" onClick={onExit}>
          ← back
        </button>
        <h2>preferences</h2>

        <fieldset className="pref">
          <legend>direction</legend>
          <p className="pref-desc">{promptText}</p>
          <div className="switch-row">
            <span className={!reverse ? 'switch-label active' : 'switch-label'}>
              images → name
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={reverse}
              className={`switch${reverse ? ' switch-on' : ''}`}
              onClick={() => setReverse((r) => !r)}
            >
              <span className="switch-thumb" />
            </button>
            <span className={reverse ? 'switch-label active' : 'switch-label'}>
              name → images
            </span>
          </div>
        </fieldset>

        <div className="hint">
          <div>← → ↑ ↓ to move</div>
          <div>Enter or Shift to select</div>
          <div>Esc to go back</div>
        </div>
      </aside>

      <section className="quiz">
        <p className="prompt">{promptText}</p>
        <div
          className={`question-display${question ? ` question-${question.questionKind}` : ''}`}
        >
          {!question ? '—' : renderItem(question.questionItem, question.questionKind)}
        </div>

        <div className="options">
          {question?.options.map((opt, i) => {
            const isSelected = i === selected
            const isVerdict = verdict && verdict.index === i
            const cls = [
              'option',
              `option-${question.answerKind}`,
              isSelected ? 'option-selected' : '',
              isVerdict && verdict.correct ? 'flash-correct' : '',
              isVerdict && !verdict.correct ? 'flash-wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => {
                  setSelected(i)
                  submit(i)
                }}
              >
                {renderItem(opt, question.answerKind)}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
