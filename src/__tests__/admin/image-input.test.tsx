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

  it('renders the dropzone with region semantics + headline + Browse Button', () => {
    render(<ImageInput value={null} onChange={() => {}} />)
    expect(screen.getByRole('region', { name: /image upload/i })).toBeInTheDocument()
    // Headline copy is shortened — Browse Button now carries the click affordance
    expect(screen.getByText(/drop an image here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
    // Region MUST NOT also be a button (dual-role anti-pattern: a single
    // landing zone should not announce as both region AND button to AT).
    expect(
      screen.queryByRole('button', { name: /image upload/i }),
    ).toBeNull()
  })

  it('accepts a valid image drop and calls uploadImage + onChange', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const file = makeFile('ok.jpg', 'image/jpeg', 1024)
    const region = screen.getByRole('region', { name: /image upload/i })
    fireEvent.drop(region, { dataTransfer: buildDataTransfer([file]) })
    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledWith(file))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://example.com/ok.jpg'),
    )
  })

  it('rejects oversize drop with inline aria-live error', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const big = makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024)
    const region = screen.getByRole('region', { name: /image upload/i })
    fireEvent.drop(region, { dataTransfer: buildDataTransfer([big]) })
    expect(await screen.findByText(/image too large\. max 2 mb\./i)).toBeInTheDocument()
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects wrong-type drop with inline aria-live error', async () => {
    const onChange = vi.fn()
    render(<ImageInput value={null} onChange={onChange} />)
    const pdf = makeFile('nope.pdf', 'application/pdf', 1024)
    const region = screen.getByRole('region', { name: /image upload/i })
    fireEvent.drop(region, { dataTransfer: buildDataTransfer([pdf]) })
    expect(
      await screen.findByText(/unsupported format\. use jpg, png, or webp\./i),
    ).toBeInTheDocument()
    expect(uploadImageMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Browse Button is keyboard-reachable and activates with Enter (regression)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ImageInput value={null} onChange={() => {}} />)
    const hiddenInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(hiddenInput).not.toBeNull()
    const clickSpy = vi.spyOn(hiddenInput, 'click')
    const browse = screen.getByRole('button', { name: /browse files/i })
    browse.focus()
    expect(browse).toHaveFocus()
    await user.keyboard('{Enter}')
    // Enter on a focused native button dispatches click, which fires the
    // Browse Button's onClick, which calls fileRef.current.click() — the
    // actual regression contract. The OS file picker itself cannot be
    // observed in jsdom but the hidden-input click is the proxy.
    expect(clickSpy).toHaveBeenCalled()
  })

  it('clicking Browse Button triggers the hidden file input (regression)', async () => {
    const user = userEvent.setup()
    const { container } = render(<ImageInput value={null} onChange={() => {}} />)
    const hiddenInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(hiddenInput).not.toBeNull()
    const clickSpy = vi.spyOn(hiddenInput, 'click')
    await user.click(screen.getByRole('button', { name: /browse files/i }))
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
    const region = screen.getByRole('region', { name: /image upload/i })
    // First: bad drop
    const pdf = makeFile('nope.pdf', 'application/pdf', 1024)
    fireEvent.drop(region, { dataTransfer: buildDataTransfer([pdf]) })
    expect(
      await screen.findByText(/unsupported format\. use jpg, png, or webp\./i),
    ).toBeInTheDocument()
    // Then: good drop
    const ok = makeFile('ok.webp', 'image/webp', 1024)
    fireEvent.drop(region, { dataTransfer: buildDataTransfer([ok]) })
    await waitFor(() =>
      expect(
        screen.queryByText(/unsupported format\. use jpg, png, or webp\./i),
      ).toBeNull(),
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })
})
