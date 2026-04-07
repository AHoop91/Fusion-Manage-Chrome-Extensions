import { describe, expect, it } from 'vitest'
import { assertAllowedAttachmentDownloadUrl, isAllowedAttachmentDownloadUrl } from '../services/urlValidation.service'

describe('bom/downloader urlValidation.service', () => {
  it('accepts trusted AWS https URLs', () => {
    expect(isAllowedAttachmentDownloadUrl('https://bucket.s3.amazonaws.com/file.dwf')).toBe(true)
    expect(assertAllowedAttachmentDownloadUrl('https://bucket.s3.amazonaws.com/file.dwf')).toBe(
      'https://bucket.s3.amazonaws.com/file.dwf'
    )
  })

  it('rejects untrusted or unsafe download URLs', () => {
    expect(isAllowedAttachmentDownloadUrl('http://bucket.s3.amazonaws.com/file.dwf')).toBe(false)
    expect(isAllowedAttachmentDownloadUrl('https://example.com/file.dwf')).toBe(false)
    expect(isAllowedAttachmentDownloadUrl('https://user:pass@bucket.s3.amazonaws.com/file.dwf')).toBe(false)
    expect(isAllowedAttachmentDownloadUrl('https://bucket.s3.amazonaws.com:8443/file.dwf')).toBe(false)
    expect(() => assertAllowedAttachmentDownloadUrl('https://example.com/file.dwf')).toThrow(
      'Attachment download URL must be a trusted HTTPS AWS host.'
    )
  })
})
