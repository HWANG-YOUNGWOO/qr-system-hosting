import { useState, useRef, useEffect } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import './App.css'
import 'intl-tel-input/build/css/intlTelInput.css'
import intlTelInput from 'intl-tel-input'

type IntlTelInputInstance = {
  isValidNumber?: () => boolean
  getNumber?: () => string
  getSelectedCountryData?: () => { iso2?: string } | null
  destroy?: () => void
}

function App() {
  const [phone, setPhone] = useState('')
  const [testMode, setTestMode] = useState(false)
  const allowTestMode = import.meta.env.VITE_ALLOW_TWILIO_TEST === 'true'
  const [status, setStatus] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const itiRef = useRef<IntlTelInputInstance | null>(null)
  const usernameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      // Use CDN utils script for formatting/validation
      itiRef.current = intlTelInput(inputRef.current as HTMLInputElement, ({
        utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/25.11.2/js/utils.js',
        initialCountry: 'auto',
        separateDialCode: true,
        // provide country hint via success callback; cast options to any to avoid strict lib typing here
        geoIpLookup: ((success: (iso2: string) => void) => { success('pl') })
      } as unknown as Partial<Record<string, unknown>>))
    }
    return () => {
      if (!itiRef.current) return
      try {
        ;(itiRef.current as { destroy: () => void }).destroy()
      } catch (err) { console.debug('iti destroy err', err) }
    }
  }, [])

  function validatePhone() {
    try {
      const iti = itiRef.current
      // Prefer getNumber() from intl-tel-input (should return E.164 when utils loaded)
      if (iti && typeof iti.getNumber === 'function') {
        try {
          const num = iti.getNumber()
          if (num) {
            const parsed = parsePhoneNumberFromString(num)
            return !!(parsed && parsed.isValid())
          }
        } catch {
          // continue to fallback
        }
      }
      // fallback: try parsing raw input using selected country from intl-tel-input or without
      const raw = phone || ''
      if (!raw) return false
      try {
        const country = iti && typeof iti.getSelectedCountryData === 'function' ? (iti.getSelectedCountryData()?.iso2 as string | undefined) : undefined
        const parsed = country ? parsePhoneNumberFromString(raw, country) : parsePhoneNumberFromString(raw)
        return !!(parsed && parsed.isValid())
      } catch {
        return false
      }
    } catch (err) {
      console.debug('validatePhone error', err)
      return false
    }
  }

  function validateName(name: string) {
    // allow Korean, English letters, spaces and basic punctuation; at least 2 chars when trimmed
    if (!name) return false
    const s = name.trim()
    if (s.length < 2) return false
    // simple character whitelist: hangul, latin letters, digits, space, hyphen
    return /^[\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9 -]+$/.test(s)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setStatus('')
    // 1) 이름 길이 검사
    if (!username || username.trim().length < 2) {
      const msg = '이름은 최소 2글자 이상 입력해야 합니다.'
      setUsernameError(msg)
      setStatus(msg)
      usernameRef.current?.focus()
      return
    }
    // 2) 이름 문자 검사
    if (!validateName(username)) {
      const msg = '이름에 허용되지 않은 문자가 포함되어 있습니다.'
      setUsernameError(msg)
      setStatus(msg)
      usernameRef.current?.focus()
      return
    }
    // 3) 전화번호 비어있는지 검사
    if (!phone || phone.trim() === '') {
      const msg = '전화번호를 입력해 주세요.'
      setPhoneError(msg)
      setStatus(msg)
      inputRef.current?.focus()
      return
    }
    // 4) 전화번호 유효성 검사 (intl-tel-input)
    if (!validatePhone()) {
      const msg = '국가번호에 맞는 올바른 전화번호를 입력해 주세요.'
      setPhoneError(msg)
      setStatus(msg)
      inputRef.current?.focus()
      return
    }
    setStatus('전송 중...')
    // 3) Firestore에서 사용자 조회 (country+phone 조합으로 문서 키를 가정)
    try {
      // lazy-import firestore functions to avoid top-level dependency in tests
      const { doc, getDoc } = await import('firebase/firestore')
      const { db } = await import('./firebase')
      // prefer E.164 formatted number from intl-tel-input if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let e164 = ((itiRef.current as any)?.getNumber ? (itiRef.current as any).getNumber() : null) || ''
      // if intl-tel-input did not provide a value, try parsing the raw input using libphonenumber-js
      if (!e164 || e164 === '') {
        const raw = phone || ''
        const parsed = parsePhoneNumberFromString(raw)
        if (parsed && parsed.isValid()) {
          e164 = parsed.number
        }
      }
      // if still no e164, try parsing with selected country (if any)
      if (!e164) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iti = (itiRef.current as any)
        const raw = phone || ''
        const country = iti && typeof iti.getSelectedCountryData === 'function' ? (iti.getSelectedCountryData()?.iso2 as string | undefined) : undefined
        try {
          const parsed = country ? parsePhoneNumberFromString(raw, country) : parsePhoneNumberFromString(raw)
          if (parsed && parsed.isValid()) {
            e164 = parsed.number
          }
        } catch {
          // ignore
        }
      }
      // if still no e164, treat as invalid
      if (!e164) {
        setStatus('국가번호에 맞는 올바른 전화번호를 입력해 주세요.')
        return
      }
      const docId = e164
      const userDocRef = doc(db, 'users', docId)
      const snap = await getDoc(userDocRef)
      if (!snap.exists()) {
        // 사용자 미등록 -> 처리 중단
        const msg = '등록된 전화번호가 아닙니다.'
        setPhoneError(msg)
        setStatus(msg)
        inputRef.current?.focus()
        return
      }
      const raw = snap.data()
      if (!raw || typeof raw !== 'object') {
        setStatus('')
        return
      }
      const dataName = (raw as { name?: unknown }).name
      if (String(dataName || '').trim() !== username.trim()) {
        const msg = '입력한 이름과 등록된 사용자명이 일치하지 않습니다.'
        setUsernameError(msg)
        setStatus(msg)
        usernameRef.current?.focus()
        return
      }
    } catch (err) {
      console.debug('firestore lookup err', err)
      setStatus('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    // clear field-level errors on success path
    setUsernameError('')
    setPhoneError('')

    // Mocked send: in real app call Firebase function to trigger Twilio
    await new Promise((r) => setTimeout(r, 700))
    setStatus(testMode ? '테스트 모드: 코드(123456)가 전송되었습니다.' : '인증 코드가 전송되었습니다.')
  }

  return (
    <div className="login-root">
      <form className="login-card" onSubmit={handleSend} aria-label="login-form">
        <h1 className="title">로그인</h1>
        <label className="label">사용자 이름</label>
        <input
          aria-label="username"
          ref={usernameRef}
          id="username"
          className={`input ${usernameError ? 'error' : ''}`}
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameError('') }}
          placeholder="예: 홍길동"
          aria-describedby={usernameError ? 'username-error' : undefined}
        />
        {usernameError && <div id="username-error" className="error-text" role="alert">{usernameError}</div>}

        <label className="label">전화번호</label>
        <input
          aria-label="phone"
            id="phone"
            className={`input ${phoneError ? 'error' : ''}`}
            ref={inputRef}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
            placeholder="예: +48123456789"
            aria-describedby={phoneError ? 'phone-error' : undefined}
        />
        {phoneError && <div id="phone-error" className="error-text" role="alert">{phoneError}</div>}

        {allowTestMode && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
            />
            테스트 모드
          </label>
        )}

        <button className="btn" type="submit">인증 코드 전송</button>

        {status && <div className="status">{status}</div>}
      </form>
    </div>
  )
}

export default App
