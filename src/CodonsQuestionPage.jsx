import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SmilesDrawer from 'smiles-drawer'
import data from './data.json'

// Reuse one drawer per pixel size — Drawer instances are cheap but creating a
// fresh one for every render is wasteful.
const drawerCache = new Map()
function getDrawer(size) {
  let d = drawerCache.get(size)
  if (!d) {
    d = new SmilesDrawer.Drawer({ width: size, height: size, padding: 10, bondThickness: 1 })
    drawerCache.set(size, d)
  }
  return d
}

const NEXT_QUESTION_DELAY_MS = 350
const FLASH_MS = 300
// Avoid repeating any of the last N question subjects.
const RECENT_LIMIT = 3

const DISPLAYS = [
  { value: 'three', label: '3-letter (Phe)' },
  { value: 'one', label: '1-letter (F)' },
  { value: 'name', label: 'Full name' },
]

// The three formats anything can be rendered as. The user picks one for the
// question side and a different one for the answer side.
const FORMATS = [
  { value: 'codon', label: 'codon', noun: 'codon' },
  { value: 'aa-text', label: 'amino acid name', noun: 'amino acid' },
  { value: 'aa-image', label: 'structure', noun: 'structure' },
]

const FORMAT_BY_VALUE = Object.fromEntries(FORMATS.map((f) => [f.value, f]))

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

// Codons are stored RNA-style (U) — convert to DNA (T) for display.
function toDNA(codon) {
  return codon.replace(/U/g, 'T')
}

function AminoAcidImage({ aa }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !aa.smiles) return
    const canvas = canvasRef.current
    const size = canvas.width
    SmilesDrawer.parse(
      aa.smiles,
      (tree) => getDrawer(size).draw(tree, canvas, 'light', false),
      (err) => console.warn('SMILES parse failed for', aa.three, err),
    )
  }, [aa.smiles, aa.three])
  // 240px canvas pixel size; CSS rules cap visual height/width per context.
  return (
    <canvas
      ref={canvasRef}
      className="aa-image"
      width={240}
      height={240}
      title={aa.name}
      aria-label={aa.name}
    />
  )
}

// Render any item (codon string or amino-acid object) in a given format.
function renderItem(item, kind, display) {
  if (kind === 'codon') return toDNA(item)
  if (kind === 'aa-text') return item[display]
  if (kind === 'aa-image') return <AminoAcidImage aa={item} />
  return null
}

export default function CodonsQuestionPage({ onExit }) {
  const topic = data.topics.codons
  const [display, setDisplay] = useState('three')
  const [questionKind, setQuestionKind] = useState('codon')
  const [answerKind, setAnswerKind] = useState('aa-text')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [question, setQuestion] = useState(null)
  const [selected, setSelected] = useState(0)
  const [verdict, setVerdict] = useState(null) // { index, correct }

  const aminoAcids = topic.aminoAcids
  // Sliding window of recent question signatures so we don't repeat the
  // same prompt back-to-back. The signature is keyed by what's *visible*
  // (the codon string in codon-prompt modes, the amino acid in aa-prompt modes).
  const recentRef = useRef([])

  // Flat list of {codon, aa} for sampling distractor codons.
  const allCodons = useMemo(
    () => aminoAcids.flatMap((aa) => aa.codons.map((codon) => ({ codon, aa }))),
    [aminoAcids],
  )

  // Setters that keep the two kinds different.
  const chooseQuestionKind = (k) => {
    setQuestionKind(k)
    if (answerKind === k) {
      setAnswerKind(FORMATS.find((f) => f.value !== k).value)
    }
  }
  const chooseAnswerKind = (k) => {
    setAnswerKind(k)
    if (questionKind === k) {
      setQuestionKind(FORMATS.find((f) => f.value !== k).value)
    }
  }

  const generateQuestion = useCallback(() => {
    if (aminoAcids.length < 4) return null
    // If either side renders as a structure, exclude Stop (no image).
    const usesImage = questionKind === 'aa-image' || answerKind === 'aa-image'
    const pool = usesImage
      ? aminoAcids.filter((aa) => aa.three !== 'Stop')
      : aminoAcids

    // Re-roll up to a few times if we'd repeat a recent question.
    let correctAA, correctCodon, sig
    for (let attempt = 0; attempt < 12; attempt++) {
      correctAA = pool[Math.floor(Math.random() * pool.length)]
      correctCodon = correctAA.codons[Math.floor(Math.random() * correctAA.codons.length)]
      sig = questionKind === 'codon' ? `codon:${correctCodon}` : `aa:${correctAA.three}`
      if (!recentRef.current.includes(sig)) break
    }
    recentRef.current = [sig, ...recentRef.current].slice(0, RECENT_LIMIT)

    const questionItem = questionKind === 'codon' ? correctCodon : correctAA

    let options, correctIndex
    if (answerKind === 'codon') {
      // Distractor codons must come from OTHER amino acids so only one option matches.
      const distractors = pickN(
        allCodons.filter((x) => x.aa.three !== correctAA.three),
        3,
      ).map((x) => x.codon)
      options = shuffle([correctCodon, ...distractors])
      correctIndex = options.indexOf(correctCodon)
    } else {
      const distractors = pickN(
        pool.filter((aa) => aa.three !== correctAA.three),
        3,
      )
      options = shuffle([correctAA, ...distractors])
      correctIndex = options.findIndex((aa) => aa.three === correctAA.three)
    }

    return { questionKind, answerKind, questionItem, options, correctIndex }
  }, [aminoAcids, allCodons, questionKind, answerKind])

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

  const promptText = `Given this ${FORMAT_BY_VALUE[questionKind].noun}, which ${FORMAT_BY_VALUE[answerKind].noun} matches?`

  // The text-display preference only matters when something is rendered as aa-text.
  const showDisplayPref = questionKind === 'aa-text' || answerKind === 'aa-text'

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
          <legend>question format</legend>
          <p className="pref-desc">what's shown as the prompt</p>
          {FORMATS.map((f) => (
            <label key={f.value} className="pref-row">
              <input
                type="radio"
                name="question-kind"
                value={f.value}
                checked={questionKind === f.value}
                onChange={() => chooseQuestionKind(f.value)}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="pref">
          <legend>answer format</legend>
          <p className="pref-desc">what the four options look like</p>
          {FORMATS.map((f) => {
            const disabled = f.value === questionKind
            return (
              <label
                key={f.value}
                className={`pref-row${disabled ? ' pref-row-disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="answer-kind"
                  value={f.value}
                  checked={answerKind === f.value}
                  disabled={disabled}
                  onChange={() => chooseAnswerKind(f.value)}
                />
                <span>{f.label}</span>
              </label>
            )
          })}
        </fieldset>

        {showDisplayPref && (
          <fieldset className="pref">
            <legend>amino acid text</legend>
            {DISPLAYS.map((d) => (
              <label key={d.value} className="pref-row">
                <input
                  type="radio"
                  name="display"
                  value={d.value}
                  checked={display === d.value}
                  onChange={() => setDisplay(d.value)}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </fieldset>
        )}

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
          {!question ? '—' : renderItem(question.questionItem, question.questionKind, display)}
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
                {renderItem(opt, question.answerKind, display)}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
