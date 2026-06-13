import { forwardRef } from 'react'
import PhoneInputLib from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

// Renders as a styled unified input: [🇵🇭 +63 ▼][number    ]
export default function PhoneInput({ value, onChange, placeholder = '917 123 4567', required }) {
  return (
    <div className="phone-input-container">
      <PhoneInputLib
        defaultCountry="PH"
        value={value ?? ''}
        onChange={val => onChange(val ?? '')}
        inputComponent={NativeInput}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}

const NativeInput = forwardRef(function NativeInput(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className="phone-native-input"
    />
  )
})
