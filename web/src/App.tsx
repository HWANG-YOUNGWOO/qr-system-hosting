import { useState, useRef, useEffect } from 'react'
import './App.css'
import 'intl-tel-input/build/css/intlTelInput.css'

// use the local declaration in src/types/intel-tel-input.d.ts
// Local instance type compatible with declaration in src/types
type IntlTelInputInstance = {
  isValidNumber?: () => boolean | null
  destroy?: () => void
  getNumber?: () => string | undefined
  getSelectedCountryData?: () => { iso2?: string; dialCode?: string } | undefined
}

function App() {
  // phone state intentionally omitted: input is uncontrolled and managed by intl-tel-input
  const [testMode, setTestMode] = useState(false)
  const allowTestMode = import.meta.env.VITE_ALLOW_TWILIO_TEST === 'true'
  const [status, setStatus] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const itiRef = useRef<IntlTelInputInstance | null>(null)
  const usernameRef = useRef<HTMLInputElement | null>(null)

  // utils.js 스크립트 로딩 완료 여부를 추적하는 상태
  const [itiUtilsLoaded, setItiUtilsLoaded] = useState(false)
  const debugPhoneFlow = import.meta.env.VITE_DEBUG_PHONE_FLOW === 'true'

  useEffect(() => {
    let mounted = true
    let createdUtilsScript = false
    let utilsEl: HTMLScriptElement | null = null

    const init = async () => {
      // Ensure utils.js is loaded before initializing intlTelInput so isValidNumber/getNumber are available.
      try {
        utilsEl = document.querySelector('script[data-iti-utils]') as HTMLScriptElement | null
        if (!utilsEl) {
          // Try ESM dynamic import first (local then CDN). If that fails, fall back to script injection.
          const localPath = '/vendor/intl-tel-input/utils.js'
          const cdnPath = 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/25.11.3/js/utils.js'

          const attachModuleToWindow = (mod: unknown) => {
            // module may export default or named exports; the UMD expects a global intlTelInputUtils
            const m = mod as Record<string, unknown> | undefined
            const exported = m && ((m['default'] as unknown) ?? m)
            ;(window as unknown as { intlTelInputUtils?: unknown }).intlTelInputUtils = exported
            createdUtilsScript = true
            return true
          }

          // try dynamic import (ESM) local -> CDN
          try {
            try {
              const mod = await import(localPath)
              attachModuleToWindow(mod)
            } catch {
              const mod = await import(cdnPath)
              attachModuleToWindow(mod)
            }
            // mark that utils are available
            utilsEl = document.querySelector('script[data-iti-utils]') as HTMLScriptElement | null
          } catch {
            // dynamic import failed (CSP, 404 as module, or other). fallback to script tag injection
            const loadScript = (src: string) => {
              return new Promise<HTMLScriptElement>((resolve, reject) => {
                const s = document.createElement('script')
                s.src = src
                s.async = true
                s.setAttribute('data-iti-utils', '1')
                s.onload = () => resolve(s)
                s.onerror = () => reject(new Error(src + ' load failed'))
                document.head.appendChild(s)
              })
            }
            try {
              utilsEl = await loadScript(localPath)
              createdUtilsScript = true
            } catch {
              console.warn('Local utils.js not found or import failed, falling back to CDN script')
              utilsEl = await loadScript(cdnPath)
              createdUtilsScript = true
            }
          }
        }
        if (!mounted) return
        console.log('intl-tel-input utils.js loaded. (proactive)')
        setItiUtilsLoaded(true)
      } catch (err) {
        console.warn('Failed to load intl-tel-input utils.js', err)
        // continue and initialize anyway; validation will fail until utils are available
      }

      if (!mounted || !inputRef.current) return

      // Ensure main UMD build is loaded first (try local then CDN), then utils is already loaded above.
      // This runtime approach avoids relying on the bundler to include the UMD build.
      const mainLocal = '/vendor/intl-tel-input/intlTelInput.js'
      const mainCdn = 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/25.11.3/js/intlTelInput.min.js'
      const ensureScript = (src: string) => {
        return new Promise<HTMLScriptElement>((resolve, reject) => {
          // if already present, resolve immediately
          const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
          if (existing) return resolve(existing)
          const s = document.createElement('script')
          s.src = src
          s.async = true
          s.onload = () => resolve(s)
          s.onerror = () => reject(new Error(src + ' load failed'))
          document.head.appendChild(s)
        })
      }

      try {
        // try local main first, fall back to CDN main
        try {
          await ensureScript(mainLocal)
        } catch (errLocalMain) {
          console.warn('local intlTelInput.js not found, falling back to CDN', errLocalMain)
          await ensureScript(mainCdn)
        }
      } catch (errMain) {
        console.warn('Failed to load intl-tel-input main script', errMain)
      }

      // Now initialize via global provided by UMD build
      type GlobalItiFn = (el: HTMLInputElement, opts?: Partial<Record<string, unknown>>) => IntlTelInputInstance
      const globalIti = (window as unknown as { intlTelInput?: GlobalItiFn }).intlTelInput
      if (typeof globalIti === 'function') {
        itiRef.current = globalIti(inputRef.current as HTMLInputElement, {
          initialCountry: 'auto',
          separateDialCode: true,
          geoIpLookup: ((success: (iso2: string) => void) => { success('pl') })
        } as unknown as Partial<Record<string, unknown>>)
      } else {
        console.warn('intlTelInput global is not available; initialization skipped')
      }
    }

    init()

    return () => {
      mounted = false
      try {
        if (itiRef.current && typeof (itiRef.current as { destroy?: () => void }).destroy === 'function') {
          ;(itiRef.current as { destroy: () => void }).destroy()
        }
      } catch (err) { console.debug('iti destroy err', err) }
      // do not remove the utils script if it was already present (other pages may use it)
      if (createdUtilsScript && utilsEl && utilsEl.parentNode) {
        // keep the script to avoid re-downloading on quick remounts — optional: uncomment to remove
        // utilsEl.parentNode.removeChild(utilsEl)
      }
    }
  }, [])

  function validatePhone() {
    try {
      const iti = itiRef.current
      // intl-tel-input의 내장 유효성 검사 기능을 직접 사용합니다.
      // utils.js가 로드되면 isValidNumber 메서드를 사용할 수 있습니다.
      if (iti) {
        if (typeof iti.isValidNumber === 'function') {
          // prefer the library's validation when available
          return iti.isValidNumber() ?? false
        }
        // if isValidNumber is not available but getNumber is, consider non-empty e164 as valid
        if (typeof iti.getNumber === 'function') {
          const val = iti.getNumber() || ''
          return val.trim().length > 0
        }
      }
      // isValidNumber/getNumber를 사용할 수 없는 경우 안전하게 false를 반환합니다.
      console.warn('validatePhone: intl-tel-input validation methods are not available.');
      return false
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
    // 전화번호 유효성 검사 (intl-tel-input)
    // 먼저 utils.js가 로드되었는지 확인
    if (!itiUtilsLoaded) {
      const msg = '전화번호 형식을 확인 중입니다. 잠시 후 다시 시도해 주세요.'
      setPhoneError(msg)
      setStatus(msg)
      return
    }

    // validatePhone가 false여도 getNumber()로 E.164를 얻을 수 있으면 진행합니다.
    const iti = itiRef.current as IntlTelInputInstance | null
    let e164Candidate = ''
      if (iti && typeof iti.getNumber === 'function') {
        e164Candidate = iti.getNumber() || ''
      }
      // If intl-tel-input didn't return an E.164, attempt to compose one from selected country data
      // plus the current raw input value (useful when separateDialCode is true and the input shows
      // the national number only). This is a safe, conservative construction for debugging.
    if (!e164Candidate && iti && typeof (iti as unknown as { getSelectedCountryData?: unknown }).getSelectedCountryData === 'function' && inputRef.current) {
        try {
          const sel = (iti as unknown as { getSelectedCountryData?: () => { dialCode?: string } }).getSelectedCountryData?.()
          const raw = (inputRef.current.value || '').trim()
          // If the user typed a full +... number, accept it as-is (strip spaces)
          if (raw.startsWith('+')) {
            e164Candidate = raw.replace(/\s+/g, '')
          } else {
            const dial = sel && sel.dialCode ? String(sel.dialCode) : ''
            const national = raw.replace(/[^0-9]/g, '')
            if (dial) {
              e164Candidate = '+' + dial + national
            } else if (national.length >= 7 && national.length <= 15) {
              e164Candidate = '+' + national
            }
          }
        } catch (err) {
          console.debug('e164 compose fallback err', err)
        }
      }
    // Debugging: optionally log validation state when debug flag is enabled
    if (debugPhoneFlow) {
      try {
        console.debug('handleSend debug:', {
          itiUtilsLoaded,
          validatePhone: validatePhone(),
          e164Candidate,
          itiRef: itiRef.current,
          rawInputValue: inputRef.current ? inputRef.current.value : undefined,
          displayName: username,
        })
      } catch (err) {
        console.debug('handleSend debug log error', err)
      }
    }

    if (!validatePhone() && !e164Candidate) {
      // Do not permissively coerce phone numbers in production.
      // Only allow the previous permissive fallback when explicit debug flag is enabled.
      const raw = inputRef.current ? (inputRef.current.value || '').trim() : ''
      let fallbackE164 = ''
      if (debugPhoneFlow && raw) {
        if (raw.startsWith('+')) {
          fallbackE164 = raw.replace(/\s+/g, '')
        } else {
          const digits = raw.replace(/[^0-9]/g, '')
          if (digits.length >= 7 && digits.length <= 15) {
            fallbackE164 = '+' + digits
          }
        }
      }

      if (fallbackE164) {
        if (debugPhoneFlow) console.info('handleSend: using debug fallback E.164 derived from raw input:', fallbackE164)
        e164Candidate = fallbackE164
      } else {
        const msg = '전화번호를 입력해 주세요.'
        setPhoneError(msg)
        setStatus(msg)
        inputRef.current?.focus()
        return
      }
    }
  setStatus('전송 중...')
  // 3) 서버에 사용자 조회를 위임: 서버(sendOtp)가 users_by_phone을 확인하므로
  // 클라이언트에서는 단순히 E.164를 준비하여 호출합니다.
  let e164 = ''
  try {
    const iti = itiRef.current as unknown as { getNumber?: () => string }
    if (e164Candidate) {
      e164 = e164Candidate
    } else if (iti && typeof iti.getNumber === 'function') {
      e164 = iti.getNumber() || ''
    }
  console.info('handleSend: e164 used for sendOtp:', e164, 'displayName:', username)
    if (!e164) {
      const msg = '국가번호에 맞는 올바른 전화번호를 입력해 주세요.'
      setPhoneError(msg)
      setStatus(msg)
      inputRef.current?.focus()
      return
    }
  } catch (err) {
    console.error('e164 build error', err)
    setStatus('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    return
  }
    // clear field-level errors on success path
    setUsernameError('')
    setPhoneError('')

    // Call backend sendOtp callable function
    try {
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('./firebase')
      // intl-tel-input provides selected country data (dialCode) and an E.164 number.
      // Extract country calling code and national number without using libphonenumber-js.
  const selected = itiRef.current && typeof itiRef.current.getSelectedCountryData === 'function' ? itiRef.current.getSelectedCountryData() : undefined
  const dial = selected && selected.dialCode ? String(selected.dialCode) : ''
      const countryCodeToSend = dial || ''
      // Remove leading '+' and country dial code from e164 to get the national number
      let national = ''
      if (e164.startsWith('+')) {
        const withoutPlus = e164.slice(1)
        if (dial && withoutPlus.startsWith(dial)) {
          national = withoutPlus.slice(dial.length)
        } else {
          // fallback: remove the first 1-3 digits as a probable country code
          const m = withoutPlus.match(/^\d{1,3}/)
          national = m ? withoutPlus.slice(m[0].length) : withoutPlus
        }
      } else {
        national = e164
      }
    const sendOtpFn = httpsCallable(functions, 'sendOtp')
  console.info('calling sendOtp', { countryCodeToSend, phoneNumber: national, testModeFlag: testMode, displayName: username })
  // also log a concise single-line message for DevTools to easily see phone+name
  console.info(`sendOtp requested — phone: ${countryCodeToSend}-${national}, name: ${username}`)
  const resp = await sendOtpFn({ countryCode: countryCodeToSend, phoneNumber: national, testModeFlag: testMode, displayName: username.trim() })
  const data = (resp.data ?? {}) as { messageKey?: string; message?: string }
  if (data.messageKey === 'auth.otpSent') {
        setStatus(testMode ? '테스트 모드: 코드(123456)가 전송되었습니다.' : '인증 코드가 전송되었습니다.')
      } else if (data.messageKey === 'auth.rateLimited') {
        setStatus('요청이 제한되었습니다. 잠시 후 다시 시도해 주세요.')
      } else if (data.messageKey === 'auth.notRegistered') {
        setStatus('등록된 전화번호가 아닙니다.')
      } else {
        setStatus(String(data.message || data.messageKey || '서버 오류가 발생했습니다.'))
      }
    } catch (err) {
      console.error('sendOtp call failed', err)
      setStatus('서버 호출에 실패했습니다. 콘솔 로그를 확인하세요.')
    }
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

        <button className="btn" type="submit">인증코드 요청</button>

        {status && <div className="status">{status}</div>}
      </form>
    </div>
  )
}

export default App
