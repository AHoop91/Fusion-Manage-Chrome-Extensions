// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createAttachmentDownloadController } from '../services/download.service'

describe('bom/downloader download.service controller', () => {
  it('waits while paused and resumes pending work when resumed', async () => {
    const controller = createAttachmentDownloadController()
    let released = false

    controller.pause()
    const pending = controller.waitIfPaused().then(() => {
      released = true
    })

    await Promise.resolve()
    expect(released).toBe(false)

    controller.resume()
    await pending
    expect(released).toBe(true)
    expect(controller.isPaused()).toBe(false)
  })

  it('aborts tracked controllers and rejects paused waits when cancelled', async () => {
    const controller = createAttachmentDownloadController()
    const abortController = new AbortController()

    controller.trackAbortController(abortController)
    controller.pause()

    const pending = controller.waitIfPaused()
    controller.cancel()

    await expect(pending).rejects.toThrow('Attachment download was cancelled.')
    expect(abortController.signal.aborted).toBe(true)
    expect(controller.isCancelled()).toBe(true)
  })

  it('immediately aborts newly tracked controllers after cancellation', () => {
    const controller = createAttachmentDownloadController()
    controller.cancel()

    const abortController = new AbortController()
    controller.trackAbortController(abortController)

    expect(abortController.signal.aborted).toBe(true)
  })
})
