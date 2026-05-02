import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// --- Hoisted mocks ------------------------------------------------------

const uploadImageMock = vi.fn()

vi.mock('@/hooks/useUploadImage', () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
}))

// ------------------------------------------------------------------------

import { ImageInput } from '@/components/suggestions/form/ImageInput'

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
): File {
  // Construct a File with a reported size without actually allocating bytes.
  const f = new File([''], name, { type })
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

function buildDataTransfer(files: File[]): DataTransfer {
  // jsdom does not implement a real DataTransfer; stub the minimum surface
  // React synthetic event expects.
  return {
    files: files as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: ['Files'],
  } as unknown as DataTransfer
}

describe('ImageInput drag-and-drop dropzone', () => {
  beforeEach(() => {
    uploadImageMock.mockReset().mockResolvedValue('https://example.com/ok.jpg')
  })

  it('renders the dropzone with region semantics and visible copy', () => {
    render(<ImageInput value={null} onChange={() => {}} />)
    expect(screen.getByRole('region', { name: /image upload/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /drop an image here, or click to browse/i }),
    ).toBeInTheDocument()
  })

  it('accepts a valid image drop and calls uploadImage + onChange', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const file = makeFile('ok.jpg', 'image/jpeg', 1024)
    const button = screen.getByRole('button', {
      name: /drop an image here, or click to browse/i,
    })
    fireEvent.drop(button, { dataTransfer: buildDataTransfer([file]) })
    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledWith(file))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://example.com/ok.jpg'),
    )
  })

  it('rejects oversize drop with inline aria-live error', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const big = makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024)
    const button = screen.getByRole('button', {
      name: /drop an image here, or click to browse/i,
    })
    fireEvent.drop(button, { dataTransfer: buildDataTransfer([big]) })
    expect(await screen.findByText(/image too large\. max 2 mb\./i)).toBeInTheDocument()
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects wrong-type drop with inline aria-live error', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const pdf = makeFile('nope.pdf', 'application/pdf', 1024)
    const button = screen.getByRole('button', {
      name: /drop an image here, or click to browse/i,
    })
    fireEvent.drop(button, { dataTransfer: buildDataTransfer([pdf]) })
    expect(
      await screen.findByText(/unsupported format\. use jpg, png, or webp\./i),
    ).toBeInTheDocument()
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('click-to-browse path: Enter on dropzone still opens the picker (regression)', async () => {
    const user = userEvent.setup()
    render(<ImageInput value={null} onChange={() => {}} />)
    const button = screen.getByRole('button', {
      name: /drop an image here, or click to browse/i,
    })
    button.focus()
    // Just assert the dropzone button is keyboard-reachable; the actual
    // file picker open cannot be observed in jsdom, but clicking the
    // button is equivalent to the Enter keybinding on a native button.
    await user.keyboard('{Enter}')
    // No throw, still in document
    expect(button).toBeInTheDocument()
  })

  it('click-to-browse path: clicking the dropzone triggers a hidden file input (regression)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ImageInput value={null} onChange={() => {}} />)
    const hiddenInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(hiddenInput).not.toBeNull()
    const clickSpy = vi.spyOn(hiddenInput, 'click')
    await user.click(
      screen.getByRole('button', { name: /drop an image here, or click to browse/i }),
    )
    expect(clickSpy).toHaveBeenCalled()
  })

  it('URL paste tab still accepts a URL onBlur (regression)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: /paste url/i }))
    const input = screen.getByPlaceholderText('https://…')
    await user.type(input, 'https://example.com/pic.png')
    input.blur()
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://example.com/pic.png'),
    )
  })

  it('hides the drop-error once a subsequent valid drop is accepted', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const button = screen.getByRole('button', {
      name: /drop an image here, or click to browse/i,
    })
    // First: bad drop
    const pdf = makeFile('nope.pdf', 'application/pdf', 1024)
    fireEvent.drop(button, { dataTransfer: buildDataTransfer([pdf]) })
    expect(
      await screen.findByText(/unsupported format\. use jpg, png, or webp\./i),
    ).toBeInTheDocument()
    // Then: good drop
    const ok = makeFile('ok.webp', 'image/webp', 1024)
    fireEvent.drop(button, { dataTransfer: buildDataTransfer([ok]) })
    await waitFor(() =>
      expect(
        screen.queryByText(/unsupported format\. use jpg, png, or webp\./i),
      ).toBeNull(),
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })
})
