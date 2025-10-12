declare module 'intl-tel-input' {
  interface AllOptions {
    utilsScript?: string
    initialCountry?: string
    separateDialCode?: boolean
    // Provide the common success/failure signature where success receives an iso2 code.
    geoIpLookup?: (success: (iso2: string) => void, failure?: () => void) => void
  }

  function intlTelInput(
    input: HTMLInputElement,
    options?: Partial<AllOptions>
  ): {
    isValidNumber(): boolean
    destroy(): void
    getNumber?(): string
  }

  export default intlTelInput
}
