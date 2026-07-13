/**
 * SentencePiece adapter. Loads the exact `sentencepiece.model` shipped in
 * the litert-community/embeddinggemma-300m repo, so browser tokenisation
 * matches the checkpoint's training tokenisation.
 */
export async function loadSentencePiece(buffer) {
  const mod = await import('@sctg/sentencepiece-js')
  const SentencePieceProcessor =
    mod.SentencePieceProcessor ?? mod.default?.SentencePieceProcessor ?? mod.default
  const sp = new SentencePieceProcessor()

  const bytes = new Uint8Array(buffer)
  if (typeof sp.loadFromSerializedProto === 'function') {
    await sp.loadFromSerializedProto(bytes)
  } else if (typeof sp.loadFromB64StringModel === 'function') {
    await sp.loadFromB64StringModel(uint8ToBase64(bytes))
  } else if (typeof sp.load === 'function') {
    // last resort: some builds only load from a URL
    const url = URL.createObjectURL(new Blob([bytes]))
    await sp.load(url)
    URL.revokeObjectURL(url)
  } else {
    throw new Error('Unsupported sentencepiece-js build: no load method found')
  }

  return {
    encodeIds(text) {
      const ids = sp.encodeIds(text)
      return Array.from(ids)
    },
  }
}

function uint8ToBase64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
