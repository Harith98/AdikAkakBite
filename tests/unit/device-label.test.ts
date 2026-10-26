import { describe, it, expect } from 'vitest'
import { describeDevice } from '@/lib/device-label'

describe('describeDevice', () => {
  it('names phones, tablets and computers with their browser', () => {
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe(
      'iPhone · Home Screen app'
    )
    expect(describeDevice('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36')).toBe(
      'Android · Samsung Internet'
    )
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0')).toBe(
      'Windows · Edge'
    )
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15')).toBe('Mac · Safari')
  })

  it('copes with nothing to go on', () => {
    expect(describeDevice(null)).toBe('Unknown device')
    expect(describeDevice('curl/8.0')).toBe('Device')
  })
})
