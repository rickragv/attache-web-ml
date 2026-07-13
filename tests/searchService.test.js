import { describe, it, expect } from 'vitest'
import { detectLocale } from '../src/services/searchService.js'
import { docFromUpload } from '../src/services/corpusService.js'

describe('detectLocale', () => {
  it('classifies pure Hindi as hi', () => {
    expect(detectLocale('रिफ़ंड की स्थिति कैसे देखें')).toBe('hi')
  })
  it('classifies English as en', () => {
    expect(detectLocale('where is my refund')).toBe('en')
  })
  it('classifies Hinglish with Latin-majority as en, Devanagari-majority as hi', () => {
    expect(detectLocale('refund status check karna hai please help')).toBe('en')
    expect(detectLocale('UPI मैंडेट की स्थिति कैसे देखें')).toBe('hi')
  })
})

describe('docFromUpload', () => {
  it('derives title from first heading when no frontmatter', () => {
    const doc = docFromUpload('notes.md', '# Dispute playbook\n\nSteps here.')
    expect(doc.title).toBe('Dispute playbook')
    expect(doc.source).toBe('upload')
    expect(doc.collection).toBe('your-documents')
  })

  it('respects frontmatter title and detects Hindi bodies', () => {
    const doc = docFromUpload('x.md', '---\ntitle: "मेरा नोट"\n---\nयह हिन्दी में लिखा गया दस्तावेज़ है।')
    expect(doc.title).toBe('मेरा नोट')
    expect(doc.locale).toBe('hi')
  })

  it('generates unique, url-safe ids', () => {
    const a = docFromUpload('My File (v2).md', 'text')
    expect(a.id).toMatch(/^user-my-file-v2-/)
  })
})
